import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: '.env.development.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Use the Neon direct connection for Prisma migrations and schema checks.
  datasource: { url: env('DATABASE_URL') },
});
