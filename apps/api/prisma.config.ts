/**
 * Configurarea uneltei Prisma (folosită de comenzile `prisma migrate` și `prisma generate`).
 * Spune unde e schema, unde se salvează migrațiile, ce script adaugă datele demo
 * (`prisma db seed`) și de unde se ia adresa bazei de date.
 */
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
