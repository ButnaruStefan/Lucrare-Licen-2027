/**
 * Ruleaza o singura data, inainte de toate testele:
 *   1. creeaza baza de date de test (`ro_a11y_test`), daca nu exista;
 *   2. ii aplica toate migratiile (`prisma migrate deploy`), ca structura sa fie la zi.
 *
 * Daca PostgreSQL nu e pornit, testele se opresc cu un mesaj clar.
 */
import { execSync } from 'node:child_process';
import pg from 'pg';
import { TEST_DATABASE_URL } from '../../vitest.config';

export default async function setup() {
  const testUrl = new URL(TEST_DATABASE_URL);
  const testDbName = testUrl.pathname.slice(1);

  // Ne conectam la baza principala a utilizatorului ca sa putem crea baza de test.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/ro_a11y';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Nu ma pot conecta la PostgreSQL (${adminUrl.host}). Este pornit? ` +
        `Pe Mac: brew services start postgresql@17. Detalii: ${String(err)}`,
    );
  }
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${testDbName}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: new URL('../..', import.meta.url),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
