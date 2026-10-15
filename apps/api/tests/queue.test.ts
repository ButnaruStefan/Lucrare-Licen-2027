/**
 * Teste pentru coada de scanari (pe baza de date de test).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scanConfigSchema } from '@ro-a11y/shared';
import { claimNextScan, failScan, failStaleScans } from '../src/scans/queue';
import { resetDatabase, testDb } from './helpers/test-db';

const config = scanConfigSchema.parse({});

async function createProject() {
  return testDb.project.create({ data: { name: 'Coada', baseUrl: 'https://exemplu.ro/' } });
}

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

describe('claimNextScan', () => {
  it('returneaza null cand coada e goala', async () => {
    expect(await claimNextScan(testDb)).toBeNull();
  });

  it('rezerva cea mai veche scanare si o trece in "running"', async () => {
    const project = await createProject();
    const old = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/a',
        config,
        createdAt: new Date('2026-01-01'),
      },
    });
    await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/b',
        config,
        createdAt: new Date('2026-06-01'),
      },
    });

    const claimed = await claimNextScan(testDb);

    expect(claimed?.id).toBe(old.id);
    expect(claimed?.config).toEqual(config);
    const row = await testDb.scan.findUniqueOrThrow({ where: { id: old.id } });
    expect(row.status).toBe('running');
    // Ora de start e in UTC, ca restul datelor (diferenta fata de acum: cateva secunde, nu ore)
    expect(Math.abs(row.startedAt!.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('nu da aceeasi scanare la doua cereri simultane', async () => {
    const project = await createProject();
    await testDb.scan.create({
      data: { projectId: project.id, pageUrl: 'https://exemplu.ro/', config },
    });

    const [first, second] = await Promise.all([claimNextScan(testDb), claimNextScan(testDb)]);

    const claimed = [first, second].filter(Boolean);
    expect(claimed).toHaveLength(1);
  });
});

describe('failScan si failStaleScans', () => {
  it('marcheaza scanarea esuata, cu codul si mesajul erorii', async () => {
    const project = await createProject();
    const scan = await testDb.scan.create({
      data: { projectId: project.id, pageUrl: 'https://exemplu.ro/', config, status: 'running' },
    });

    await failScan(testDb, scan.id, {
      errorCode: 'NAVIGATION_TIMEOUT',
      errorMessage: 'Prea lent.',
    });

    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row).toMatchObject({ status: 'failed', errorCode: 'NAVIGATION_TIMEOUT' });
    expect(row.finishedAt).not.toBeNull();
  });

  it('marcheaza "failed" doar scanarile ramase "running" de prea mult timp', async () => {
    const project = await createProject();
    const stale = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/',
        config,
        status: 'running',
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    const fresh = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/',
        config,
        status: 'running',
        startedAt: new Date(),
      },
    });

    expect(await failStaleScans(testDb, 10 * 60 * 1000)).toBe(1);
    expect((await testDb.scan.findUniqueOrThrow({ where: { id: stale.id } })).errorCode).toBe(
      'WORKER_INTERRUPTED',
    );
    expect((await testDb.scan.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe(
      'running',
    );
  });
});
