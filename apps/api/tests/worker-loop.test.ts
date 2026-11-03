/**
 * Teste pentru bucla worker-ului (pe baza de date de test, cu browser si procesare simulate).
 *
 * Verifica regula de baza: worker-ul nu ramane blocat si nu se opreste singur, oricare ar fi
 * problema (procesare agatata, browser care nu porneste, eroare neprevazuta), atat pentru
 * scanari, cat si pentru descoperirea paginilor unui audit.
 */
import type { Browser } from 'playwright';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanConfigSchema } from '@ro-a11y/shared';
import { createLogger } from '../src/lib/logger';
import {
  runWorkerIteration,
  sweepStaleScans,
  type BrowserManager,
  type WorkerLoopDeps,
} from '../src/scans/worker-loop';
import { resetDatabase, testDb } from './helpers/test-db';

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

const fakeBrowser = { isConnected: () => true } as unknown as Browser;

function browsers(overrides: Partial<BrowserManager> = {}): BrowserManager {
  return {
    ensure: vi.fn(async () => ({ browser: fakeBrowser, version: 'Chrome test' })),
    reset: vi.fn(async () => {}),
    ...overrides,
  };
}

function deps(overrides: Partial<WorkerLoopDeps> = {}): WorkerLoopDeps {
  return {
    db: testDb,
    logger: createLogger('silent'),
    browsers: browsers(),
    process: async () => ({ browserHealthy: true }),
    processDiscovery: async () => ({ browserHealthy: true }),
    staleAfterMs: 3 * 60 * 1000,
    ...overrides,
  };
}

async function queueScan() {
  const project = await testDb.project.create({
    data: { name: 'Demo', baseUrl: 'https://exemplu.ro/' },
  });
  return testDb.scan.create({
    data: {
      projectId: project.id,
      pageUrl: 'https://exemplu.ro/',
      config: scanConfigSchema.parse({}),
    },
  });
}

describe('runWorkerIteration', () => {
  it('fara scanari in coada: raspunde "idle"', async () => {
    expect(await runWorkerIteration(deps())).toBe('idle');
  });

  it('o procesare agatata e oprita de ceasul de paza: scanarea esueaza, browserul e repornit', async () => {
    const scan = await queueScan();
    const manager = browsers();
    const start = Date.now();

    const result = await runWorkerIteration(
      deps({
        browsers: manager,
        process: () => new Promise(() => {}), // nu se termina niciodata
        watchdogMs: () => 300,
      }),
    );

    expect(result).toBe('watchdog');
    expect(Date.now() - start).toBeLessThan(5_000);
    expect(manager.reset).toHaveBeenCalled();
    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'SCAN_TIMEOUT' });
  });

  it('daca browserul nu porneste, scanarea ramane in coada (nu "running") si worker-ul continua', async () => {
    const scan = await queueScan();
    const manager = browsers({
      ensure: vi.fn(async () => {
        throw new Error('Chrome nu porneste');
      }),
    });

    expect(await runWorkerIteration(deps({ browsers: manager }))).toBe('browser_unavailable');

    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row.status).toBe('queued');
    expect(manager.reset).toHaveBeenCalled();
  });

  it('o eroare neprevazuta nu opreste worker-ul, iar scanarea e marcata esuata', async () => {
    const scan = await queueScan();

    const result = await runWorkerIteration(
      deps({
        process: async () => {
          throw new Error('neprevazut');
        },
      }),
    );

    expect(result).toBe('error');
    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'INTERNAL_ERROR' });
  });

  it('un browser raportat blocat de procesare e repornit inainte de urmatoarea scanare', async () => {
    await queueScan();
    const manager = browsers();

    const result = await runWorkerIteration(
      deps({ browsers: manager, process: async () => ({ browserHealthy: false }) }),
    );

    expect(result).toBe('processed');
    expect(manager.reset).toHaveBeenCalled();
  });
});

async function queueDiscovery() {
  const project = await testDb.project.create({
    data: { name: 'Audit', baseUrl: 'https://audit.exemplu.ro/' },
  });
  return testDb.audit.create({
    data: {
      projectId: project.id,
      startUrl: 'https://audit.exemplu.ro/',
      maxPages: 10,
      config: scanConfigSchema.parse({}),
      catalogVersion: 'test',
    },
  });
}

describe('runWorkerIteration: descoperirea paginilor', () => {
  it('descoperirea are prioritate fata de scanari (utilizatorul asteapta lista)', async () => {
    const scan = await queueScan();
    const audit = await queueDiscovery();
    const processDiscovery = vi.fn(async () => ({ browserHealthy: true }));
    const process = vi.fn(async () => ({ browserHealthy: true }));

    expect(await runWorkerIteration(deps({ process, processDiscovery }))).toBe('processed');

    expect(processDiscovery).toHaveBeenCalledWith(
      fakeBrowser,
      expect.objectContaining({ id: audit.id }),
    );
    expect(process).not.toHaveBeenCalled();
    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row.status).toBe('queued');
  });

  it('o descoperire agatata e oprita de ceasul de paza: auditul esueaza, browserul e repornit', async () => {
    const audit = await queueDiscovery();
    const manager = browsers();

    const result = await runWorkerIteration(
      deps({
        browsers: manager,
        processDiscovery: () => new Promise(() => {}),
        watchdogMs: () => 300,
      }),
    );

    expect(result).toBe('watchdog');
    expect(manager.reset).toHaveBeenCalled();
    const row = await testDb.audit.findUniqueOrThrow({ where: { id: audit.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'DISCOVERY_TIMEOUT' });
  });

  it('o descoperire ramasa "discovering" prea mult (worker oprit brusc) e marcata esuata', async () => {
    const audit = await queueDiscovery();
    await testDb.audit.update({
      where: { id: audit.id },
      data: { status: 'discovering', discoveryStartedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    expect(await sweepStaleScans(deps(), true)).toBe(1);

    const row = await testDb.audit.findUniqueOrThrow({ where: { id: audit.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'WORKER_INTERRUPTED' });
  });
});
