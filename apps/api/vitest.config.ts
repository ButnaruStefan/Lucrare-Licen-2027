/**
 * Configurarea testelor (Vitest).
 *
 * Testele care folosesc baza de date lucrează pe o bază SEPARATĂ, `ro_a11y_test`, ca datele
 * de lucru din `ro_a11y` să nu fie niciodată atinse. Adresa poate fi schimbată cu variabila
 * TEST_DATABASE_URL. Înainte de teste, `global-setup.ts` creează baza (dacă lipsește) și îi
 * aplică migrațiile.
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
    // Fișierele de test împart aceeași bază de date, deci rulează pe rând, nu în paralel.
    fileParallelism: false,
  },
});
