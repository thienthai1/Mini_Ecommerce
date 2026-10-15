import { issueSignedToken, presignUrl } from '@vercel/blob';
import type { HandleUploadPresignedBody } from '@vercel/blob/client';
import { adminId } from '@/lib/auth';
import { db } from '@/lib/db';
import { blobCredentials, imageTypes, maxImageSize } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ folder: string }> }) {
  try {
    const { folder } = await context.params;
    if (folder !== 'products' && folder !== 'slips') return new Response('Not found', { status: 404 });
    const body = await request.json() as HandleUploadPresignedBody;
    if (body.type !== 'blob.generate-presigned-url') throw new Error('Invalid upload event');

    const { pathname: requestedPathname, clientPayload } = body.payload;
    const extension = requestedPathname.match(/\.(jpg|png|webp)$/)?.[1];
    if (!extension || !new RegExp(`^${folder}/[a-f0-9-]{36}\\.${extension}$`).test(requestedPathname)) throw new Error('Invalid pathname');

    if (folder === 'products') {
      if (!await adminId()) throw new Error('Unauthorized');
    } else {
      const code = clientPayload || '';
      if (!/^[a-f0-9]{32}$/.test(code)) throw new Error('Invalid order');
      const order = await db().order.findUnique({ where: { code }, select: { status: true } });
      if (!order || !['AWAITING_SLIP', 'REJECTED'].includes(order.status)) throw new Error('Order cannot accept a slip');
    }

    const validUntil = Date.now() + 5 * 60 * 1000;
    const signedToken = await issueSignedToken({
      ...blobCredentials(folder),
      pathname: requestedPathname,
      operations: ['put'],
      validUntil,
    });
    const presignedUrlPayload = await presignUrl(signedToken, {
      operation: 'put',
      pathname: requestedPathname,
      access: folder === 'products' ? 'public' : 'private',
      allowedContentTypes: imageTypes,
      maximumSizeInBytes: maxImageSize,
      validUntil,
    });

    return Response.json({ type: body.type, presignedUrlPayload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    let safeMessage = message;
    for (const secret of [process.env.BLOB_PRODUCTS_READ_WRITE_TOKEN, process.env.BLOB_SLIPS_READ_WRITE_TOKEN, process.env.VERCEL_OIDC_TOKEN]) {
      if (secret) safeMessage = safeMessage.replaceAll(secret, '[redacted]');
    }
    safeMessage = safeMessage.replace(/postgres(?:ql)?:\/\/\S+/gi, '[database URL]');
    const code = message.startsWith('Blob store for ') ? 'storage_not_configured'
      : message === 'Unauthorized' ? 'admin_session_expired'
      : message === 'Invalid pathname' ? 'invalid_pathname'
      : message === 'Invalid order' || message === 'Order cannot accept a slip' ? 'order_not_eligible'
      : 'blob_upload_failed';
    console.error('[blob-upload]', {
      folder: (await context.params).folder,
      code,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: safeMessage,
      hasProductsStoreId: Boolean(process.env.BLOB_PRODUCTS_STORE_ID),
      hasSlipsStoreId: Boolean(process.env.BLOB_SLIPS_STORE_ID),
      hasProductsWebhookPublicKey: Boolean(process.env.BLOB_PRODUCTS_WEBHOOK_PUBLIC_KEY),
      hasSlipsWebhookPublicKey: Boolean(process.env.BLOB_SLIPS_WEBHOOK_PUBLIC_KEY),
    });
    return Response.json({ error: 'Upload denied', code }, {
      status: code === 'admin_session_expired' ? 401 : code === 'storage_not_configured' ? 503 : 400,
    });
  }
}
