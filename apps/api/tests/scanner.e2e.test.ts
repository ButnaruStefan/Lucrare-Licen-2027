/**
 * Testul complet al scannerului, cu browser real (Chrome) si site-urile de antrenament.
 *
 *   1. Site-ul cu probleme: scannerul trebuie sa gaseasca EXACT regulile din probleme.json
 *      (sursa de adevar, verificata cu axe-core), nici mai mult, nici mai putin.
 *   2. Site-ul accesibil: nicio regula incalcata si niciun rezultat incomplet.
 *   3. Securitatea: o redirectionare spre o adresa interna si o imagine incarcata dintr-o
 *      retea interna sunt blocate in browser.
 *
 * Are nevoie de browserul din BROWSER_CHANNEL (implicit Google Chrome instalat).
 */
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { scanConfigSchema } from '@ro-a11y/shared';
import { createFixturesServer } from '@ro-a11y/fixtures';
import probleme from '@ro-a11y/fixtures/probleme.json' with { type: 'json' };
import { createLogger } from '../src/lib/logger';
import { createRequestGuard } from '../src/safety/url-guard';
import {
  launchBrowser,
  describeBrowser,
  BROWSER_CHANNELS,
  type BrowserChannel,
} from '../src/scanner/browser';
import { scanPage } from '../src/scanner/page-scan';
import { processScan } from '../src/scans/process-scan';
import { claimNextScan } from '../src/scans/queue';
import { resetDatabase, testDb } from './helpers/test-db';

const channel = (process.env.BROWSER_CHANNEL ?? 'chrome') as BrowserChannel;
if (!BROWSER_CHANNELS.includes(channel)) throw new Error(`BROWSER_CHANNEL invalid: ${channel}`);

const config = scanConfigSchema.parse({ timeoutMs: 15_000 });

let browser: Browser;
let fixtures: Server;
let fixturesOrigin: string;

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://localhost:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  browser = await launchBrowser(channel);
  fixtures = createFixturesServer();
  fixturesOrigin = await listen(fixtures);
}, 60_000);

afterAll(async () => {
  await browser?.close();
  fixtures?.close();
  await testDb.$disconnect();
});

beforeEach(resetDatabase);

/** Scaneaza o pagina de antrenament prin tot fluxul real: coada -> worker -> baza de date. */
async function scanThroughQueue(path: string) {
  const project = await testDb.project.create({
    data: { name: 'Demo', baseUrl: `${fixturesOrigin}/` },
  });
  const scan = await testDb.scan.create({
    data: { projectId: project.id, pageUrl: `${fixturesOrigin}${path}`, config },
  });
  const claimed = await claimNextScan(testDb);
  await processScan(
    {
      db: testDb,
      browser,
      browserVersion: describeBrowser(browser, channel),
      guardOptions: { allowedLocalOrigins: [fixturesOrigin] },
      logger: createLogger('silent'),
    },
    claimed!,
  );
  const row = await testDb.scan.findUniqueOrThrow({
    where: { id: scan.id },
    include: { ruleResults: { include: { affectedElements: true } } },
  });
  return row;
}

function rulesIn(row: Awaited<ReturnType<typeof scanThroughQueue>>, category: string) {
  return row.ruleResults
    .filter((r) => r.category === category)
    .map((r) => r.axeRuleId)
    .sort();
}

describe('scannerul pe site-urile de antrenament', () => {
  it('gaseste exact problemele automate din probleme.json pe broken-demo', async () => {
    const row = await scanThroughQueue('/broken/');

    expect(row.status).toBe('completed');
    expect(row.engineVersion).toBe(probleme.verificatCu.motor.replace('axe-core ', ''));

    const expectedViolations = probleme.detectabileAutomat
      .filter((p) => p.categorie === 'violation')
      .flatMap((p) => (Array.isArray(p.regulaAxe) ? p.regulaAxe : [p.regulaAxe]))
      .sort();
    const expectedIncomplete = probleme.detectabileAutomat
      .filter((p) => p.categorie === 'incomplete')
      .flatMap((p) => (Array.isArray(p.regulaAxe) ? p.regulaAxe : [p.regulaAxe]))
      .sort();

    expect(rulesIn(row, 'violation')).toEqual(expectedViolations);
    expect(rulesIn(row, 'incomplete')).toEqual(expectedIncomplete);
  }, 60_000);

  it('leaga fiecare problema de elementul marcat in cod (data-problema)', async () => {
    const row = await scanThroughQueue('/broken/');

    for (const problema of probleme.detectabileAutomat) {
      // B01-B03 sunt pe <html>/<head>, iar B12 e pe toata pagina: nu au data-problema
      if (['B01', 'B02', 'B03', 'B06', 'B12'].includes(problema.id)) continue;
      const html = row.ruleResults
        .filter((r) => r.axeRuleId === problema.regulaAxe && r.category === problema.categorie)
        .flatMap((r) => r.affectedElements.map((e) => e.htmlSnippet))
        .join('\n');
      expect(html, `elementul pentru ${problema.id}`).toContain(`data-problema="${problema.id}"`);
    }
  }, 60_000);

  it('NU raporteaza problemele care pot fi gasite doar manual (M01-M06)', async () => {
    const row = await scanThroughQueue('/broken/');
    const flagged = row.ruleResults
      .filter((r) => r.category === 'violation')
      .flatMap((r) => (r.axeRuleId === 'region' ? [] : r.affectedElements))
      .map((e) => e.htmlSnippet)
      .join('\n');

    for (const problema of probleme.doarVerificareManuala) {
      expect(flagged).not.toContain(`data-problema="${problema.id}"`);
    }
  }, 60_000);

  it('nu gaseste nicio problema pe accessible-demo', async () => {
    const row = await scanThroughQueue('/accessible/');

    expect(row.status).toBe('completed');
    expect(rulesIn(row, 'violation')).toEqual([]);
    expect(rulesIn(row, 'incomplete')).toEqual([]);
    expect(rulesIn(row, 'pass').length).toBeGreaterThan(20);
  }, 60_000);

  it('marcheaza scanarea "failed" (HTTP_ERROR) pentru o pagina inexistenta', async () => {
    const row = await scanThroughQueue('/broken/nu-exista.html');

    expect(row).toMatchObject({ status: 'failed', errorCode: 'HTTP_ERROR', httpStatus: 404 });
    expect(row.ruleResults).toEqual([]);
  }, 60_000);
});

describe('protectia SSRF in browser', () => {
  let trap: Server;
  let trapOrigin: string;
  let trapHits = 0;
  let attacker: Server;
  let attackerOrigin: string;

  beforeAll(async () => {
    // "Capcana": un server intern pe care scannerul NU are voie sa-l atinga.
    trap = createServer((_req, res) => {
      trapHits += 1;
      res.end('secret intern');
    });
    trapOrigin = await listen(trap);

    // Site-ul "atacatorului" (permis), care incearca sa trimita browserul spre capcana.
    attacker = createServer((req, res) => {
      const html = (body: string) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<!doctype html><html lang="ro"><head><title>Test</title></head>` +
            `<body><main><h1>Test</h1>${body}</main></body></html>`,
        );
      };
      switch (req.url) {
        case '/redirect': // redirectionare directa spre capcana
          res.writeHead(302, { Location: `${trapOrigin}/admin` });
          return res.end();
        case '/redirect-safe': // redirectionare permisa, pe acelasi site
          res.writeHead(302, { Location: '/pagina-noua' });
          return res.end();
        case '/pixel-redirect': // imagine care redirectioneaza spre capcana
          res.writeHead(302, { Location: `${trapOrigin}/pixel.png` });
          return res.end();
        case '/pagina-noua':
          return html('<p>Pagina dupa redirectionare</p>');
        case '/imagine-redirectionata':
          return html('<img src="/pixel-redirect" alt="pixel">');
        case '/js-redirect': // pagina care, din JavaScript, trimite browserul spre capcana
          return html(`<script>location.href = '${trapOrigin}/admin';</script>`);
        default: // pagina care incarca o imagine direct din capcana
          return html(`<img src="${trapOrigin}/pixel.png" alt="pixel">`);
      }
    });
    attackerOrigin = await listen(attacker);
  });

  afterAll(() => {
    trap?.close();
    attacker?.close();
  });

  // Doar site-ul atacatorului e permis; capcana e pe localhost, deci e blocata.
  const guardFor = () => createRequestGuard({ allowedLocalOrigins: [attackerOrigin] });

  it('blocheaza o redirectionare spre o adresa interna', async () => {
    trapHits = 0;
    const outcome = await scanPage(browser, `${attackerOrigin}/redirect`, config, guardFor());

    expect(outcome).toMatchObject({ ok: false, errorCode: 'UNSAFE_URL' });
    expect(outcome.blockedRequests).toContain(`${trapOrigin}/admin`);
    expect(trapHits).toBe(0);
  }, 30_000);

  it('blocheaza resursele incarcate dintr-o retea interna, dar scaneaza pagina', async () => {
    trapHits = 0;
    const outcome = await scanPage(browser, `${attackerOrigin}/`, config, guardFor());

    expect(outcome.ok).toBe(true);
    expect(outcome.blockedRequests).toContain(`${trapOrigin}/pixel.png`);
    expect(trapHits).toBe(0);
  }, 30_000);

  it('urmeaza o redirectionare permisa si pastreaza adresa finala corecta', async () => {
    const outcome = await scanPage(browser, `${attackerOrigin}/redirect-safe`, config, guardFor());

    expect(outcome).toMatchObject({ ok: true, finalUrl: `${attackerOrigin}/pagina-noua` });
  }, 30_000);

  it('blocheaza o imagine care redirectioneaza spre o adresa interna', async () => {
    trapHits = 0;
    const outcome = await scanPage(
      browser,
      `${attackerOrigin}/imagine-redirectionata`,
      config,
      guardFor(),
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.blockedRequests).toContain(`${trapOrigin}/pixel.png`);
    expect(trapHits).toBe(0);
  }, 30_000);

  it('blocheaza o redirectionare facuta din JavaScript spre o adresa interna', async () => {
    trapHits = 0;
    const outcome = await scanPage(browser, `${attackerOrigin}/js-redirect`, config, guardFor());

    expect(outcome).toMatchObject({ ok: false, errorCode: 'UNSAFE_URL' });
    expect(trapHits).toBe(0);
  }, 30_000);
});
