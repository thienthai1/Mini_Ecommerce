import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Prefer the direct Neon connection for migrations and schema checks.
  datasource: { url: env('DATABASE_URL_UNPOOLED') || env('DATABASE_URL') },
});
