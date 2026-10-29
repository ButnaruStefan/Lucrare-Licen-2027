/**
 * Teste pentru coada de scanari (pe baza de date de test).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scanConfigSchema } from '@ro-a11y/shared';
import type { AxeResults } from 'axe-core';
import type { Database } from '../src/db/prisma';
import { claimNextScan, completeScan, failScan, failStaleScans } from '../src/scans/queue';
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

  it('nu suprascrie o scanare care a apucat sa se termine', async () => {
    const project = await createProject();
    const scan = await testDb.scan.create({
      data: { projectId: project.id, pageUrl: 'https://exemplu.ro/', config, status: 'completed' },
    });

    await failScan(testDb, scan.id, { errorCode: 'SCAN_TIMEOUT', errorMessage: 'Prea lent.' });

    const row = await testDb.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row).toMatchObject({ status: 'completed', errorCode: null });
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

describe('completeScan', () => {
  it('reincearca o data daca baza de date nu ofera la timp o conexiune (P2028)', async () => {
    const project = await createProject();
    const scan = await testDb.scan.create({
      data: { projectId: project.id, pageUrl: 'https://exemplu.ro/', config, status: 'running' },
    });
    let attempts = 0;
    // Prima tranzactie esueaza ca la un calculator incarcat; a doua merge normal.
    const flakyDb = new Proxy(testDb, {
      get(target, prop, receiver) {
        if (prop === '$transaction') {
          return (...args: Parameters<Database['$transaction']>) => {
            attempts += 1;
            if (attempts === 1) {
              return Promise.reject(Object.assign(new Error('timeout'), { code: 'P2028' }));
            }
            return (target.$transaction as (...a: unknown[]) => unknown)(...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as Database;

    await completeScan(flakyDb, scan.id, {
      raw: { testEngine: { version: '4.13.0' } } as AxeResults,
      results: [
        {
          axeRuleId: 'image-alt',
          category: 'violation',
          impact: 'critical',
          title: 't',
          description: 'd',
          docsUrl: 'u',
          axeTags: ['wcag2a', 'wcag111'],
          wcagCriteria: ['1.1.1'],
          elements: [
            { cssSelector: ['img'], htmlSnippet: '<img>', failureSummary: null, fingerprint: 'f1' },
            {
              cssSelector: ['img.b'],
              htmlSnippet: '<img>',
              failureSummary: null,
              fingerprint: 'f2',
            },
          ],
        },
      ],
      finalUrl: 'https://exemplu.ro/',
      httpStatus: 200,
      engineVersion: '4.13.0',
      browserVersion: 'Chrome test',
    });

    expect(attempts).toBe(2);
    const row = await testDb.scan.findUniqueOrThrow({
      where: { id: scan.id },
      include: { ruleResults: { include: { affectedElements: true } } },
    });
    expect(row.status).toBe('completed');
    expect(row.ruleResults).toHaveLength(1);
    expect(row.ruleResults[0]!.affectedElements).toHaveLength(2);
  });
});
