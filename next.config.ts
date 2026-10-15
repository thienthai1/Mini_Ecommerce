import type { NextConfig } from 'next';

const previewOrigin = process.env.V0_RUNTIME_URL
  ? new URL(process.env.V0_RUNTIME_URL).host
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        ...(previewOrigin ? [previewOrigin] : []),
        '*.vusercontent.net',
        '*.v0.dev',
        '*.v0.app',
      ],
    },
  },
};

export default nextConfig;
