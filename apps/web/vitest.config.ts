/**
 * Configurarea testelor interfetei (Vitest). Testele pornesc propriul server Vite si
 * deschid Chrome, deci ruleaza in mediul Node (nu intr-un browser simulat).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
