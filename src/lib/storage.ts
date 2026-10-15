import 'server-only';
import { get, head } from '@vercel/blob';

export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxImageSize = 5 * 1024 * 1024;

export function blobCredentials(folder: 'products' | 'slips') {
  const token = folder === 'products'
    ? process.env.BLOB_PRODUCTS_READ_WRITE_TOKEN
    : process.env.BLOB_SLIPS_READ_WRITE_TOKEN;
  const storeId = folder === 'products'
    ? process.env.BLOB_PRODUCTS_STORE_ID
    : process.env.BLOB_SLIPS_STORE_ID;
  if (storeId) return { storeId };
  if (token) return { token };

  // The Vercel Blob integration exposes one development token by default.
  // Keep product and slip paths isolated until dedicated store credentials are added.
  const sharedToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (sharedToken) return { token: sharedToken };

  throw new Error(`Blob store for ${folder} is not configured`);
}

export function validImageKey(key: string, folder: 'products' | 'slips') {
  return new RegExp(`^${folder}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(key);
}

export async function verifiedImage(key: string, folder: 'products' | 'slips') {
  if (!validImageKey(key, folder)) throw new Error('Invalid image key');
  const credentials = blobCredentials(folder);
  const metadata = await head(key, credentials);
  if (!metadata || !imageTypes.includes(metadata.contentType) || metadata.size < 1 || metadata.size > maxImageSize) {
    throw new Error('Invalid image');
  }
  const response = await get(key, { ...credentials, access: folder === 'slips' ? 'private' : 'public' });
  if (!response || response.statusCode !== 200 || !response.stream) throw new Error('Image not found');
  const bytes = Buffer.from(await new Response(response.stream).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!(metadata.contentType === 'image/jpeg' && isJpeg || metadata.contentType === 'image/png' && isPng || metadata.contentType === 'image/webp' && isWebp)) {
    throw new Error('Image content does not match type');
  }
  return { bytes, contentType: metadata.contentType };
}
