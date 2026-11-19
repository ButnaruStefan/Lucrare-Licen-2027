/**
 * Testele verificarii aspectului paginii, cu browser real (Chrome). Fiecare pagina de test are
 * un singur defect de aranjare, construit intentionat, iar verificarea trebuie sa gaseasca exact
 * acel semnal, la latimile corecte:
 *
 *   1. o pagina responsive corecta nu da niciun semnal;
 *   2. un container cu latime fixa (1200 px) face pagina sa se derulezeze pe orizontala;
 *   3. aceeasi pagina, cu derularea ascunsa (overflow-x: hidden), taie textul la margine;
 *   4. titlul si meniul (pozitionat absolut) se suprapun sub o anumita latime;
 *   5. meniul cu inaltime fixa si overflow: hidden isi pierde linkurile cand se rupe pe doua randuri;
 *   6. o suprapunere voita (text peste imagine, la toate latimile) nu e raportata, nici textul
 *      taiat voit cu "...";
 *   7. media queries suprapuse (max-width: 768px si min-width: 768px) si breakpoint-urile;
 *   8. lipsa meta viewport;
 *   9. tot fluxul (coada -> worker -> baza de date) cu doar verificarea aspectului: fara axe-core,
 *      cu semnalele si capturile lor salvate.
 *
 * Are nevoie de browserul din BROWSER_CHANNEL (implicit Google Chrome instalat).
 */
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFixturesServer } from '@ro-a11y/fixtures';
import { createLogger } from '../src/lib/logger';
import { BROWSER_CHANNELS, launchBrowser, type BrowserChannel } from '../src/scanner/browser';
import { auditLayout, type LayoutAuditResult } from '../src/scanner/layout-audit';
import { MAX_WIDTH, MIN_WIDTH } from '../src/scanner/layout-rules';
import { processScan } from '../src/scans/process-scan';
import { claimNextScan } from '../src/scans/queue';
import { resetDatabase, testDb } from './helpers/test-db';

const channel = (process.env.BROWSER_CHANNEL ?? 'chrome') as BrowserChannel;
if (!BROWSER_CHANNELS.includes(channel)) throw new Error(`BROWSER_CHANNEL invalid: ${channel}`);

let browser: Browser;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  browser = await launchBrowser(channel);
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
});

afterEach(async () => {
  await context?.close();
});

const HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin: 0; font: 16px/1.5 sans-serif; } * { box-sizing: border-box; }</style>`;

async function audit(html: string): Promise<LayoutAuditResult> {
  await page.setContent(html);
  return auditLayout(page);
}

function kinds(result: LayoutAuditResult): string[] {
  return result.issues.map((i) => i.kind);
}

describe('verificarea aspectului', () => {
  it('o pagina responsive corecta nu da semnale si fereastra revine la dimensiunea initiala', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}
      <style>
        header { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
        nav { display: flex; flex-wrap: wrap; gap: 12px; }
        main { max-width: 900px; margin: 0 auto; padding: 16px; }
        img { max-width: 100%; height: auto; display: block; }
      </style></head><body>
      <header><strong>Primăria demo</strong>
        <nav><a href="#">Acasă</a><a href="#">Servicii</a><a href="#">Anunțuri</a><a href="#">Contact</a></nav>
      </header>
      <main><h1>Bine ați venit</h1>
        <p>Text obișnuit, care se rearanjează pe ecrane mici fără să iasă din pagină.</p>
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='300'/%3E" alt="">
      </main></body></html>`);

    expect(result.issues).toEqual([]);
    expect(result.widths[0]).toBe(MAX_WIDTH);
    expect(result.widths.at(-1)).toBe(MIN_WIDTH);
    expect(result.partial).toBe(false);
    expect(result.metaViewport).toContain('device-width');
    expect(page.viewportSize()).toEqual({ width: 1366, height: 768 });
  }, 60_000);

  it('un container cu latime fixa face pagina sa se deruleze pe orizontala', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}</head><body>
      <p>Început</p>
      <div id="lat" style="width: 1200px; height: 100px; background: #ccd">Tabel cu lățime fixă</div>
      </body></html>`);

    const scroll = result.issues.find((i) => i.kind === 'derulare-orizontala')!;
    expect(scroll).toBeDefined();
    expect(scroll.level).toBe('visible');
    // 1220 px: incape (1200 px + bara de derulare); sub 1200 px: nu mai incape
    expect(scroll.widthMax).toBeLessThan(1220);
    expect(scroll.widthMax).toBeGreaterThanOrEqual(1160);
    expect(scroll.widthMin).toBe(MIN_WIDTH);
    expect(scroll.elements.map((e) => e.selector)).toEqual(['#lat']);
    expect(scroll.details.overflowPx).toBeGreaterThan(0);
    // Captura la latimea problemei, cu chenarul containerului si marginea ferestrei
    expect(scroll.image).not.toBeNull();
    expect(scroll.image!.data.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // JPEG
    expect(scroll.boxes).toHaveLength(1);
    expect(scroll.details.edgeX).toBeGreaterThan(0);
    // O singura problema: paragraful din container nu e raportat separat
    expect(kinds(result).filter((k) => k === 'derulare-orizontala')).toHaveLength(1);
  }, 60_000);

  it('cu derularea ascunsa (overflow-x: hidden), textul e taiat la marginea paginii', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}
      <style>body { overflow-x: hidden; }</style></head><body>
      <p id="lung" style="width: 1000px">Acest paragraf are o lățime fixă de 1000 de pixeli, deci pe un ecran mai îngust o parte din rânduri nu se mai vede deloc.</p>
      </body></html>`);

    expect(kinds(result)).not.toContain('derulare-orizontala');
    const cut = result.issues.find((i) => i.kind === 'taiat-la-marginea-paginii')!;
    expect(cut).toBeDefined();
    expect(cut.level).toBe('visible');
    expect(cut.elements[0]!.selector).toBe('#lung');
    expect(cut.widthMax).toBeLessThan(1000);
    expect(cut.widthMin).toBe(MIN_WIDTH);
  }, 60_000);

  it('titlul si meniul pozitionat absolut se suprapun sub o anumita latime', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}
      <style>
        header { position: relative; height: 60px; }
        h1 { margin: 0; font-size: 24px; line-height: 60px; padding-left: 16px; white-space: nowrap; }
        nav { position: absolute; right: 16px; top: 18px; white-space: nowrap; }
        nav a { margin-left: 16px; }
      </style></head><body>
      <header><h1 id="titlu">Primăria Comunei Exemplu</h1>
        <nav><a id="m1" href="#">Servicii publice</a><a href="#">Anunțuri</a><a href="#">Contact</a></nav>
      </header></body></html>`);

    const collisions = result.issues.filter((i) => i.kind === 'elemente-suprapuse');
    expect(collisions.length).toBeGreaterThan(0);
    const first = collisions[0]!;
    expect(first.level).toBe('visible'); // text peste text
    expect(first.elements.map((e) => e.selector)).toContain('#titlu');
    expect(first.widthMax).toBeLessThan(MAX_WIDTH);
    expect(first.details.overlap!.width).toBeGreaterThan(0);
    expect(first.image).not.toBeNull();
    expect(first.boxes).toHaveLength(2);
  }, 60_000);

  it('meniul cu inaltime fixa si overflow: hidden isi pierde linkurile pe ecran ingust', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}
      <style>
        nav { height: 40px; overflow: hidden; display: flex; flex-wrap: wrap; gap: 0 24px; padding: 8px; }
      </style></head><body>
      <nav><a href="#">Acasă</a><a href="#">Despre primărie</a><a href="#">Servicii publice</a>
        <a href="#">Anunțuri și licitații</a><a id="ultim" href="#">Contact</a></nav>
      <main><p>Conținut</p></main></body></html>`);

    const cut = result.issues.filter((i) => i.kind === 'iese-din-container');
    expect(cut.length).toBeGreaterThan(0);
    expect(cut.every((i) => i.level === 'visible')).toBe(true); // linkuri: nu mai pot fi apasate
    expect(cut.flatMap((i) => i.elements.map((e) => e.selector))).toContain('#ultim');
  }, 60_000);

  it('suprapunerea voita (la toate latimile) si textul taiat voit cu "..." nu sunt raportate', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}
      <style>
        .hero { position: relative; }
        .hero img { width: 100%; height: 300px; display: block; }
        .hero h2 { position: absolute; left: 16px; bottom: 16px; margin: 0; }
        .scurt { width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style></head><body>
      <div class="hero"><img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/%3E"><h2>Titlu peste imagine</h2></div>
      <p class="scurt">Un titlu de articol foarte lung, tăiat voit cu puncte de suspensie</p>
      </body></html>`);

    expect(result.issues).toEqual([]);
  }, 60_000);

  it('gaseste media queries suprapuse si verifica latimile din jurul breakpoint-urilor', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head>${HEAD}
      <style>
        @media (max-width: 768px) { p { color: #333; } }
        @media (min-width: 768px) { p { color: #000; } }
        @media (min-width: 1024px) and (max-width: 1279.98px) { p { font-weight: bold; } }
      </style></head><body><p>Text</p></body></html>`);

    const clash = result.issues.find((i) => i.kind === 'media-queries-suprapuse')!;
    expect(clash).toBeDefined();
    expect(clash.widthMin).toBe(768);
    expect(clash.widthMax).toBe(768);
    expect(clash.details.rules!.map((r) => r.text)).toEqual([
      '(max-width: 768px)',
      '(min-width: 768px)',
    ]);
    // Fara alte suprapuneri: 1279.98 px nu se suprapune cu nimic
    expect(kinds(result).filter((k) => k === 'media-queries-suprapuse')).toHaveLength(1);
    expect(result.breakpoints.map((b) => `${b.feature}:${b.px}`)).toEqual(
      expect.arrayContaining([
        'max-width:768',
        'min-width:768',
        'min-width:1024',
        'max-width:1279.98',
      ]),
    );
    expect(result.widths).toEqual(expect.arrayContaining([767, 768, 769, 1023, 1024, 1279]));
  }, 60_000);

  it('lipsa meta viewport e semnalata', async () => {
    const result = await audit(`<!doctype html><html lang="ro"><head><meta charset="utf-8"></head>
      <body><p>Pagină fără meta viewport</p></body></html>`);

    expect(result.metaViewport).toBeNull();
    expect(result.issues).toMatchObject([
      { kind: 'fara-meta-viewport', level: 'visible', widthMin: null, elements: [], image: null },
    ]);
  }, 60_000);
});

describe('tot fluxul, doar cu verificarea aspectului', () => {
  let fixtures: Server;
  let origin: string;

  beforeAll(async () => {
    fixtures = createFixturesServer();
    fixtures.listen(0, '127.0.0.1');
    await once(fixtures, 'listening');
    origin = `http://localhost:${(fixtures.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    fixtures?.close();
    await testDb.$disconnect();
  });

  beforeEach(resetDatabase);

  it('salveaza semnalele si capturile, fara rezultate axe-core', async () => {
    const project = await testDb.project.create({
      data: { name: 'Aspect', baseUrl: `${origin}/aspect/` },
    });
    const scan = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: `${origin}/aspect/`,
        config: { checks: { accessibility: false, layout: true }, timeoutMs: 15_000 },
      },
    });
    const claimed = (await claimNextScan(testDb))!;
    expect(claimed.config.checks).toEqual({ accessibility: false, layout: true });

    await processScan(
      {
        db: testDb,
        browser,
        browserVersion: 'test',
        guardOptions: { allowedLocalOrigins: [origin] },
        logger: createLogger('silent'),
      },
      claimed,
    );

    const saved = await testDb.scan.findUniqueOrThrow({
      where: { id: scan.id },
      include: { layout: { include: { issues: true } }, ruleResults: true, screenshot: true },
    });
    expect(saved.status).toBe('completed');
    expect(saved.engineName).toBeNull();
    expect(saved.rawAxeResult).toBeNull();
    expect(saved.ruleResults).toEqual([]);
    expect(saved.screenshot).toBeNull();
    expect(saved.layout!.error).toBeNull();
    expect(saved.layout!.widths.length).toBeGreaterThanOrEqual(19);
    const issueKinds = saved.layout!.issues.map((i) => i.kind);
    expect(issueKinds).toEqual(
      expect.arrayContaining([
        'derulare-orizontala',
        'elemente-suprapuse',
        'media-queries-suprapuse',
      ]),
    );
    const withImage = saved.layout!.issues.find((i) => i.image !== null)!;
    expect(withImage.imageFormat).toBe('jpeg');
    expect(withImage.imageViewport).toBeGreaterThanOrEqual(MIN_WIDTH);
  }, 120_000);
});
