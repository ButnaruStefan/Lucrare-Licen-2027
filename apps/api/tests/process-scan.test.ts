/**
 * Teste pentru robustetea procesarii unei scanari (pe baza de date de test).
 *
 * Simuleaza un browser care nu mai raspunde deloc (ca dupa o actualizare automata a lui Chrome
 * in timp ce ruleaza) si un DNS care nu raspunde: scanarea nu trebuie sa ramana "running"
 * la nesfarsit.
 */
import type { Browser } from 'playwright';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scanConfigSchema } from '@ro-a11y/shared';
import { createLogger } from '../src/lib/logger';
import { defaultScanTimeLimitMs, processScan } from '../src/scans/process-scan';
import { claimNextScan } from '../src/scans/queue';
import { resetDatabase, testDb } from './helpers/test-db';

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

/** Un "browser" care accepta cereri, dar nu raspunde niciodata. */
const hungBrowser = {
  newContext: () => new Promise(() => {}),
  isConnected: () => true,
} as unknown as Browser;

async function queueScan(pageUrl = 'http://localhost:4000/broken/') {
  const project = await testDb.project.create({
    data: { name: 'Demo', baseUrl: new URL('/', pageUrl).toString() },
  });
  await testDb.scan.create({
    data: {
      projectId: project.id,
      pageUrl,
      config: scanConfigSchema.parse({}),
    },
  });
  return (await claimNextScan(testDb))!;
}

describe('processScan cu un browser blocat', () => {
  it('marcheaza scanarea "failed" (SCAN_TIMEOUT) dupa limita si cere repornirea browserului', async () => {
    const scan = await queueScan();
    const start = Date.now();

    const result = await processScan(
      {
        db: testDb,
        browser: hungBrowser,
        browserVersion: 'Chrome test',
        guardOptions: { allowedLocalOrigins: ['http://localhost:4000'] },
        logger: createLogger('silent'),
        scanTimeLimitMs: 300,
      },
      scan,
    );

    expect(result).toEqual({ browserHealthy: false });
    expect(Date.now() - start).toBeLessThan(5_000);
    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'SCAN_TIMEOUT' });
    expect(row.finishedAt).not.toBeNull();
  });

  it('limita acopera si verificarea adresei: un DNS care nu raspunde nu blocheaza scanarea', async () => {
    const scan = await queueScan('https://exemplu.ro/');

    const result = await processScan(
      {
        db: testDb,
        browser: hungBrowser,
        browserVersion: 'Chrome test',
        guardOptions: { resolve: () => new Promise(() => {}) },
        logger: createLogger('silent'),
        scanTimeLimitMs: 300,
      },
      scan,
    );

    expect(result).toEqual({ browserHealthy: false });
    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'SCAN_TIMEOUT' });
  });

  it('limita implicita lasa timp pentru incarcare si analiza (90 s pentru 30 s de incarcare)', () => {
    expect(defaultScanTimeLimitMs(30_000)).toBe(90_000);
  });
});
