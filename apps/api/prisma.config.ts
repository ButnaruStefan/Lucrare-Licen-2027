/**
 * Configurarea uneltei Prisma (folosita de comenzile `prisma migrate` si `prisma generate`).
 * Spune unde e schema, unde se salveaza migratiile, ce script adauga datele demo
 * (`prisma db seed`) si de unde se ia adresa bazei de date.
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
