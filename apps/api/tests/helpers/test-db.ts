/**
 * Ajutoare pentru testele care folosesc baza de date de test.
 *
 * - `testDb`: conexiunea la `ro_a11y_test` (adresa vine din vitest.config.ts).
 * - `resetDatabase()`: golește toate tabelele, ca fiecare test să pornească de la zero
 *   și rezultatul unui test să nu-l influențeze pe altul.
 */
import { createPrismaClient } from '../../src/db/prisma';

export const testDb = createPrismaClient(process.env.DATABASE_URL!);

export async function resetDatabase(): Promise<void> {
  // CASCADE golește și tabelele dependente (scanări, rezultate, elemente).
  await testDb.$executeRawUnsafe('TRUNCATE TABLE "projects" CASCADE');
}
