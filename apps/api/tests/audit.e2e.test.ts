/**
 * Testul complet al unui audit pe mai multe pagini, cu browser real (Chrome) si site-urile
 * de antrenament:
 *
 *   1. descoperirea gaseste paginile din meniu (inclusiv submeniul) si din sitemap.xml,
 *      listeaza serviciile externe si documentele, nu propune paginile interzise de
 *      robots.txt (doar le marcheaza) si exclude
 *      linkurile de tip "iesire/autentificare", mailto:, tel: si ancorele;
 *   2. fluxul intreg: descoperire -> alegerea paginilor (prin API) -> scanarea fiecarei
 *      pagini (worker) -> rezultatele adunate, cu problemele comune din sablonul site-ului.
 *
 * Are nevoie de browserul din BROWSER_CHANNEL (implicit Google Chrome instalat).
 */
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser } from 'playwright';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditResultsSchema, auditSchema, scanConfigSchema } from '@ro-a11y/shared';
import { createFixturesServer } from '@ro-a11y/fixtures';
import { processDiscovery } from '../src/audits/process-discovery';
import { claimNextDiscovery } from '../src/audits/queue';
import { discoverPages } from '../src/discovery/discover';
import { createLogger } from '../src/lib/logger';
import { createRequestGuard } from '../src/safety/url-guard';
import {
  BROWSER_CHANNELS,
  describeBrowser,
  launchBrowser,
  type BrowserChannel,
} from '../src/scanner/browser';
import { processScan } from '../src/scans/process-scan';
import { claimNextScan } from '../src/scans/queue';
import { createTestApp } from './helpers/test-app';
import { resetDatabase, testDb } from './helpers/test-db';

const channel = (process.env.BROWSER_CHANNEL ?? 'chrome') as BrowserChannel;
if (!BROWSER_CHANNELS.includes(channel)) throw new Error(`BROWSER_CHANNEL invalid: ${channel}`);

const config = scanConfigSchema.parse({ timeoutMs: 15_000 });
const logger = createLogger('silent');

let browser: Browser;
let fixtures: Server;
let origin: string;

beforeAll(async () => {
  browser = await launchBrowser(channel);
  fixtures = createFixturesServer();
  fixtures.listen(0, '127.0.0.1');
  await once(fixtures, 'listening');
  origin = `http://localhost:${(fixtures.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  await browser?.close();
  fixtures?.close();
  await testDb.$disconnect();
});

beforeEach(resetDatabase);

describe('descoperirea paginilor pe site-urile de antrenament', () => {
  it('gaseste paginile din meniu si din sitemap; listeaza externe si documente; aplica excluderile', async () => {
    const outcome = await discoverPages(
      browser,
      `${origin}/broken/`,
      config,
      createRequestGuard({ allowedLocalOrigins: [origin] }),
      { maxPages: 10, seed: 'test' },
    );
    if (!outcome.ok) throw new Error(outcome.errorMessage);
    const { discovery } = outcome;

    expect(discovery.scope).toBe(`${origin}/broken/`);
    expect(discovery.pages.map((p) => p.url.replace(origin, ''))).toEqual([
      '/broken/',
      '/broken/anunturi.html',
      '/broken/servicii/taxe-locale.html',
      '/broken/servicii/stare-civila.html',
      '/broken/contact.html',
      '/broken/admin/', // interzisa de robots.txt
      '/broken/declaratie-accesibilitate.html', // doar in sitemap.xml
    ]);
    expect(discovery.pages.at(-1)!.region).toBe('sitemap');
    // Site mic: toate paginile permise sunt propuse; cea interzisa de robots.txt nu
    const admin = discovery.pages.find((p) => p.url.endsWith('/admin/'))!;
    expect(admin).toMatchObject({ robotsBlocked: true, proposed: false });
    expect(discovery.pages.filter((p) => p.proposed)).toHaveLength(6);

    expect(discovery.external.map((e) => e.origin)).toEqual(['https://www.ghiseul.ro']);
    expect(discovery.documents).toEqual([
      expect.objectContaining({ extension: 'pdf', label: 'Hotărârea nr. 12/2026 (PDF)' }),
    ]);
    expect(discovery.robots).toEqual({ found: true, blocked: 1 }); // /broken/admin/
    expect(discovery.sitemap.found).toBe(true);
    expect(discovery.excluded).toMatchObject({
      action: 1, // cont/autentificare.html
      non_http: 2, // mailto:, tel:
      outside_scope: 6, // paginile site-ului /accessible/ din sitemap
    });
    expect(discovery.excluded.same_page).toBeGreaterThanOrEqual(2); // #program, #
  }, 60_000);

  it('recunoaste meniul din care face parte fiecare link (submeniul "Servicii")', async () => {
    const outcome = await discoverPages(
      browser,
      `${origin}/accessible/`,
      config,
      createRequestGuard({ allowedLocalOrigins: [origin] }),
      { maxPages: 10, seed: 'test' },
    );
    if (!outcome.ok) throw new Error(outcome.errorMessage);

    const sectionOf = (path: string) =>
      outcome.discovery.pages.find((p) => p.url === `${origin}${path}`)?.section;
    expect(sectionOf('/accessible/servicii/taxe-locale.html')).toBe('Servicii');
    expect(sectionOf('/accessible/servicii/stare-civila.html')).toBe('Servicii');
    expect(sectionOf('/accessible/anunturi.html')).toBe('Anunțuri');
  }, 60_000);
});

describe('auditul complet: descoperire, alegere, scanare, rezultate', () => {
  it('gaseste problemele comune din sablonul site-ului pe toate paginile', async () => {
    const app = createTestApp({
      db: testDb,
      guardOptions: { allowedLocalOrigins: [origin] },
      scanTimeoutMs: 15_000,
    });
    const project = await testDb.project.create({
      data: { name: 'Demo', baseUrl: `${origin}/broken/` },
    });

    // 1. Pornirea auditului si descoperirea (worker)
    const created = await request(app).post(`/api/v1/projects/${project.id}/audits`).send({});
    expect(created.status).toBe(202);
    const claimed = await claimNextDiscovery(testDb);
    await processDiscovery(
      { db: testDb, browser, guardOptions: { allowedLocalOrigins: [origin] }, logger },
      claimed!,
    );
    const discovered = auditSchema.parse(
      (await request(app).get(`/api/v1/audits/${created.body.id}`)).body,
    );
    expect(discovered.status).toBe('awaiting_selection');

    // 2. Utilizatorul confirma paginile propuse
    const proposed = discovered.discovery!.pages.filter((p) => p.proposed).map((p) => p.url);
    const selected = await request(app)
      .post(`/api/v1/audits/${created.body.id}/selection`)
      .send({ urls: proposed });
    expect(selected.status).toBe(200);

    // 3. Worker-ul scaneaza paginile, una cate una
    for (let scan = await claimNextScan(testDb); scan; scan = await claimNextScan(testDb)) {
      await processScan(
        {
          db: testDb,
          browser,
          browserVersion: describeBrowser(browser, channel),
          guardOptions: { allowedLocalOrigins: [origin] },
          logger,
        },
        scan,
      );
    }

    // 4. Rezultatele adunate
    const audit = auditSchema.parse(
      (await request(app).get(`/api/v1/audits/${created.body.id}`)).body,
    );
    expect(audit.status).toBe('completed');
    expect(audit.progress).toEqual({ total: 6, completed: 6, failed: 0 });

    const results = auditResultsSchema.parse(
      (await request(app).get(`/api/v1/audits/${created.body.id}/results`)).body,
    );
    expect(results.pagesScanned).toBe(6);

    const pagesFor = (rule: string) =>
      results.rules.find((r) => r.axeRuleId === rule && r.category === 'violation')?.pages.length;
    // Problemele din sablon: pe toate cele 6 pagini
    expect(pagesFor('html-has-lang')).toBe(6);
    expect(pagesFor('meta-viewport')).toBe(6);
    expect(pagesFor('link-name')).toBe(6);
    // Problemele proprii paginilor: pagina principala + pagina interioara cu aceeasi problema
    expect(pagesFor('image-alt')).toBe(2); // B04 + P01
    expect(pagesFor('select-name')).toBe(2); // B07 + P02
    expect(pagesFor('button-name')).toBe(2); // B08 + P03

    // Problemele comune: acelasi element, pe toate paginile (se repara o singura data)
    const common = (rule: string) => results.commonIssues.find((c) => c.axeRuleId === rule);
    expect(common('link-name')?.pages).toHaveLength(6);
    expect(common('link-name')?.htmlSnippet).toContain('class="social"');
    expect(common('html-has-lang')?.pages).toHaveLength(6);
    expect(common('image-alt')).toBeUndefined(); // imagini diferite pe pagini diferite
  }, 180_000);

  it('pe site-ul accesibil, auditul pe toate paginile nu gaseste nicio problema', async () => {
    const outcome = await discoverPages(
      browser,
      `${origin}/accessible/`,
      config,
      createRequestGuard({ allowedLocalOrigins: [origin] }),
      { maxPages: 10, seed: 'test' },
    );
    if (!outcome.ok) throw new Error(outcome.errorMessage);
    const project = await testDb.project.create({
      data: { name: 'Accesibil', baseUrl: `${origin}/accessible/` },
    });
    const urls = outcome.discovery.pages.filter((p) => p.proposed).map((p) => p.url);
    expect(urls).toHaveLength(6);
    for (const pageUrl of urls) {
      await testDb.scan.create({ data: { projectId: project.id, pageUrl, config } });
    }
    for (let scan = await claimNextScan(testDb); scan; scan = await claimNextScan(testDb)) {
      await processScan(
        {
          db: testDb,
          browser,
          browserVersion: describeBrowser(browser, channel),
          guardOptions: { allowedLocalOrigins: [origin] },
          logger,
        },
        scan,
      );
    }
    const problems = await testDb.ruleResult.findMany({
      where: { category: { in: ['violation', 'incomplete'] } },
      select: { axeRuleId: true, scan: { select: { pageUrl: true } } },
    });
    expect(problems).toEqual([]);
    expect(await testDb.scan.count({ where: { status: 'completed' } })).toBe(6);
  }, 180_000);
});
