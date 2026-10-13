/**
 * Conexiunea la baza de date PostgreSQL, prin clientul generat de Prisma.
 *
 * Se creează o singură instanță, folosită de toată aplicația. Adaptorul `PrismaPg`
 * folosește driverul `pg` (node-postgres) pentru conexiunea efectivă.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;

/** Verifică dacă baza de date răspunde, cu cea mai simplă interogare posibilă. */
export async function pingDatabase(db: Database): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}
