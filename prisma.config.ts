import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Prefer Neon's direct connection for migrations; fall back for other PostgreSQL providers.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? env('DATABASE_URL') },
});
