/**
 * Conexiunea la baza de date PostgreSQL, prin clientul generat de Prisma.
 *
 * Se creeaza o singura instanta, folosita de toata aplicatia. Adaptorul `PrismaPg`
 * foloseste driverul `pg` (node-postgres) pentru conexiunea efectiva.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;

/** Verifica daca baza de date raspunde, cu cea mai simpla interogare posibila. */
export async function pingDatabase(db: Database): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}
