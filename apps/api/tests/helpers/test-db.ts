/**
 * Ajutoare pentru testele care folosesc baza de date de test.
 *
 * - `testDb`: conexiunea la `ro_a11y_test` (adresa vine din vitest.config.ts).
 * - `resetDatabase()`: goleste toate tabelele, ca fiecare test sa porneasca de la zero
 *   si rezultatul unui test sa nu-l influenteze pe altul.
 */
import { createPrismaClient } from '../../src/db/prisma';

export const testDb = createPrismaClient(process.env.DATABASE_URL!);

export async function resetDatabase(): Promise<void> {
  // CASCADE goleste si tabelele dependente (scanari, rezultate, elemente).
  await testDb.$executeRawUnsafe('TRUNCATE TABLE "projects" CASCADE');
}
