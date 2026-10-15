/**
 * Configurarea testelor (Vitest).
 *
 * Testele care folosesc baza de date lucreaza pe o baza SEPARATA, `ro_a11y_test`, ca datele
 * de lucru din `ro_a11y` sa nu fie niciodata atinse. Adresa poate fi schimbata cu variabila
 * TEST_DATABASE_URL. Inainte de teste, `global-setup.ts` creeaza baza (daca lipseste) si ii
 * aplica migratiile.
 */
import { defineConfig } from 'vitest/config';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ro_a11y:ro_a11y@localhost:5432/ro_a11y_test';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
    },
    globalSetup: ['tests/helpers/global-setup.ts'],
    // Fisierele de test impart aceeasi baza de date, deci ruleaza pe rand, nu in paralel.
    fileParallelism: false,
  },
});
