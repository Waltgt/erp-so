import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Este archivo lo usa SOLO la CLI de Prisma (migraciones).
// Se conecta como erp_owner. La app en ejecución usa DATABASE_URL (erp_app).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // npx prisma db seed (usa DATABASE_URL de erp_app, ver prisma/seed.ts)
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: env('MIGRATION_DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
