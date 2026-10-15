/**
 * Construieste aplicatia pentru teste, cu valori implicite sigure pentru toate dependentele.
 * Fiecare test inlocuieste doar ce il intereseaza, ex. `createTestApp({ checkDatabase: ... })`.
 */
import { createApp, type AppDeps } from '../../src/app';
import type { Database } from '../../src/db/prisma';
import { createLogger } from '../../src/lib/logger';

export function createTestApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    logger: createLogger('silent'),
    db: {} as Database,
    checkDatabase: async () => {},
    // In teste nu facem interogari DNS reale: orice domeniu "exista" pe o adresa publica.
    guardOptions: { resolve: async () => ['93.184.216.34'] },
    scanTimeoutMs: 30_000,
    ...overrides,
  });
}
