/**
 * Testele capturii pentru harta problemelor, cu browser real (Chrome):
 *
 *   1. captura site-ului de antrenament e WebP, cat pagina, iar chenarele calculate cad EXACT
 *      peste elemente: verificam culoarea pixelilor din captura in chenarul butonului albastru
 *      (B08, fundal #002b7f) si al iconitei albe din subsol (B10);
 *   2. o pagina cu efecte la derulare (meniu fix, panou lipit, sectiune care apare doar pe
 *      ecran): imbinarile nu se potrivesc, deci ecranele raman separate; fara goluri, sectiunea
 *      apare la culoarea reala, meniul fix o singura data, chenarele in coordonatele ecranului,
 *      iar contrastul textului estompat e re-verificat pe ecran si trece;
 *   3. calculul pozitiilor: Shadow DOM, element ascuns, element dintr-un iframe, selector invalid;
 *   4. o pagina statica nu asteapta efecte (nici cand un buton fix "inapoi sus" apare la derulare)
 *      si e aratata ca o singura imagine continua (imbinarile se potrivesc), iar una foarte lunga
 *      e taiata la limita capturii si marcata "taiata";
 *   5. tot fluxul (coada -> worker -> baza de date) salveaza captura si pozitiile.
 *
 * Are nevoie de browserul din BROWSER_CHANNEL (implicit Google Chrome instalat).
 */
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { scanConfigSchema } from '@ro-a11y/shared';
import { createFixturesServer } from '@ro-a11y/fixtures';
import { createLogger } from '../src/lib/logger';
import { createRequestGuard } from '../src/safety/url-guard';
import {
  BROWSER_CHANNELS,
  describeBrowser,
  launchBrowser,
  type BrowserChannel,
} from '../src/scanner/browser';
import { AxeBuilder } from '@axe-core/playwright';
import {
  capturePage,
  ELEMENT_BOXES_SCRIPT,
  MAX_CAPTURE_HEIGHT,
  SEAM_TOLERANCE,
} from '../src/scanner/capture';
import {
  applyContrastRecheck,
  contrastTargets,
  recheckContrast,
  type RecheckedNode,
} from '../src/scanner/contrast-recheck';
import { scanPage } from '../src/scanner/page-scan';
import { processScan } from '../src/scans/process-scan';
import { claimNextScan } from '../src/scans/queue';
import { resetDatabase, testDb } from './helpers/test-db';

const channel = (process.env.BROWSER_CHANNEL ?? 'chrome') as BrowserChannel;
if (!BROWSER_CHANNELS.includes(channel)) throw new Error(`BROWSER_CHANNEL invalid: ${channel}`);

const config = scanConfigSchema.parse({ timeoutMs: 15_000 });

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

/** Culoarea unui pixel din imagine, citita de browser (decodeaza WebP-ul intr-un canvas). */
async function pixelsAt(image: Buffer, points: Array<[number, number]>): Promise<number[][]> {
  const page = await browser.newPage();
  try {
    // Script text (ruleaza in browser, unde exista Image si canvas)
    return await page.evaluate<number[][]>(`(async () => {
      const img = new Image();
      img.src = "data:image/webp;base64,${image.toString('base64')}";
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ${JSON.stringify(points)}.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)));
    })()`);
  } finally {
    await page.close();
  }
}

/** Culorile sunt aproape egale (WebP comprima cu mici pierderi). */
function closeTo(actual: number[], expected: number[], tolerance = 16) {
  expect(
    actual.every((v, i) => Math.abs(v - expected[i]!) <= tolerance),
    `${actual}`,
  ).toBe(true);
}

describe('captura site-ului de antrenament', () => {
  it('e WebP, cat pagina, iar chenarele cad exact peste elemente (verificat pe pixeli)', async () => {
    const outcome = await scanPage(
      browser,
      `${origin}/broken/`,
      config,
      createRequestGuard({ allowedLocalOrigins: [origin] }),
    );
    if (!outcome.ok) throw new Error(outcome.errorMessage);
    const capture = outcome.capture!;
    expect(capture).not.toBeNull();
    expect(capture.format).toBe('webp');
    expect(capture.image.subarray(0, 4).toString()).toBe('RIFF');
    expect(capture.image.subarray(8, 12).toString()).toBe('WEBP');
    expect(capture.width).toBe(config.viewport.width);
    expect(capture.truncated).toBe(false);
    // Ecranele (cat fereastra) unul sub altul, primul fotografiat de la inceputul paginii
    // Pagina statica: imbinarile se potrivesc, deci e aratata ca o singura imagine continua
    expect(capture.seams.every((d) => d === 0)).toBe(true);
    expect(capture.frameHeight).toBeNull();
    expect(capture.frameOffsets).toEqual([]);
    expect(capture.height).toBe(capture.pageHeight);

    const boxOf = (ruleId: string) => {
      const node = outcome.raw.violations.find((r) => r.id === ruleId)!.nodes[0]!;
      return capture.boxes.get(JSON.stringify(node.target))!;
    };
    const button = boxOf('button-name'); // B08: buton cu fundal #002b7f
    const social = boxOf('link-name'); // B10: patrat alb in subsolul inchis la culoare
    expect(button).not.toBeNull();
    expect(social).not.toBeNull();

    const [buttonPixel, socialPixel] = await pixelsAt(capture.image, [
      [button.x + 4, button.y + 4],
      [social.x + Math.floor(social.width / 2), social.y + Math.floor(social.height / 2)],
    ]);
    closeTo(buttonPixel!, [0x00, 0x2b, 0x7f]);
    closeTo(socialPixel!, [0xff, 0xff, 0xff]);
  }, 60_000);
});

describe('pagina cu efecte la derulare', () => {
  // Fereastra 800 x 600. Pagina: bloc gri (0-800), pista de 2400 px cu un panou lipit de 600 px
  // (800-3200), sectiune albastra care apare doar cand e pe ecran (3200-3800), meniu fix sus.
  const HTML = `<!doctype html><html lang="ro"><head><title>Efecte</title><style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px sans-serif; background: #fff; }
    header { position: fixed; top: 0; left: 0; right: 0; height: 40px; background: #ff00ff; }
    .gri { height: 800px; background: #eeeeee; }
    .pista { height: 2400px; }
    .panou { position: sticky; top: 0; height: 600px; background: #00ffff; }
    .jos { height: 600px; padding: 100px; background: #0000ff; opacity: 0.2; transition: opacity 0.6s; }
    .jos.vazut { opacity: 1; }
    .text { margin: 0; color: #ffffff; }
  </style></head><body>
    <header>Meniu</header>
    <main><div class="gri"></div><div class="pista"><div class="panou">Panou</div></div>
    <section class="jos"><p class="text">Text care apare doar pe ecran</p></section></main>
    <span class="ultim" style="position:absolute;top:3760px;left:20px;width:50px;height:20px;background:#00ff00"></span>
    <script>
      new IntersectionObserver((entries) => entries.forEach((e) =>
        e.target.classList.toggle("vazut", e.isIntersecting))).observe(document.querySelector(".jos"));
    </script>
  </body></html>`;

  it('fara goluri, sectiunea la culoarea reala, meniul fix o data, contrastul re-verificat', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    try {
      const page = await context.newPage();
      await page.setContent(HTML);
      // axe, cu pagina sus, vede textul estompat: contrast insuficient
      const raw = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      const toRecheck = contrastTargets(raw);
      expect([...toRecheck.keys()]).toEqual([JSON.stringify(['p'])]);

      const rechecked = new Map<string, RecheckedNode>();
      const capture = await capturePage(
        page,
        [...toRecheck.values(), ['.ultim']],
        async (entered) => {
          for (const [k, v] of await recheckContrast(page, entered)) rechecked.set(k, v);
        },
      );
      // 7 ecrane de 600 px; ultimul s-a oprit la capatul paginii (3800 - 600 = 3200)
      // Pagina se schimba la derulare: imbinarile nu se potrivesc, ecranele raman separate.
      // Pasul e un ecran minus suprapunerea (600 - 64 = 536); ultimul se opreste la capat (3200).
      expect(capture.seams.some((d) => d > SEAM_TOLERANCE)).toBe(true);
      expect(capture.frameHeight).toBe(600);
      expect(capture.frameOffsets).toEqual([0, 536, 1072, 1608, 2144, 2680, 3200]);
      expect(capture.height).toBe(7 * 600);
      expect(capture.truncated).toBe(false);
      // Pagina reactioneaza la derulare: scannerul a asteptat efectele (cel putin la sectiunea de jos)
      expect(capture.reactiveFrames).toBeGreaterThan(0);

      // Pe ecran, textul are contrastul real (alb pe albastru) si trece
      const applied = applyContrastRecheck(raw, rechecked);
      expect(applied.changed).toBe(1);
      expect(applied.raw.violations).toEqual([]);
      expect(applied.raw.passes[0]!.nodes.map((n) => n.target)).toContainEqual(['p']);

      // Patratul verde se vede doar in ultimul ecran (al 7-lea, derulat la 3200): in imagine e la
      // 6 * 600 + (3760 - 3200) = 4160, nu la 3760 ca in pagina
      const last = capture.boxes.get(JSON.stringify(['.ultim']))!;
      expect(last).toEqual({ x: 20, y: 4160, width: 50, height: 20 });
      const [green] = await pixelsAt(capture.image, [[last.x + 25, last.y + 10]]);
      closeTo(green!, [0x00, 0xff, 0x00]);

      // Chenarul textului: se vede intreg abia in ultimul ecran (derulat la 3200), deci in imagine
      // e la 6 * 600 + (pozitia in pagina - 3200)
      const real = await page.evaluate<{ x: number; y: number }>(
        `(() => { const r = document.querySelector(".text").getBoundingClientRect(); return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY) }; })()`,
      );
      expect(capture.boxes.get(JSON.stringify(['p']))).toMatchObject({
        x: real.x,
        y: 6 * 600 + real.y - 3200,
      });

      const [menu, belowMenu, track, section] = await pixelsAt(capture.image, [
        [400, 10], // meniul fix, in primul ecran
        [400, 600 + 10], // sus in al doilea ecran (derulat la 536): gri, nu meniul (ascuns)
        [400, 5 * 600 + 220], // ecranul derulat la 2680, spre finalul pistei: panoul lipit, nu alb
        [400, 6 * 600 + 500], // ultimul ecran (derulat la 3200), sectiunea de jos: albastru plin
      ]);
      closeTo(menu!, [0xff, 0x00, 0xff]);
      closeTo(belowMenu!, [0xee, 0xee, 0xee]);
      closeTo(track!, [0x00, 0xff, 0xff]);
      closeTo(section!, [0x00, 0x00, 0xff]);

      // Pagina e lasata cum era: meniul fix vizibil, derularea sus
      expect(
        await page.evaluate(
          `[getComputedStyle(document.querySelector("header")).visibility, scrollY]`,
        ),
      ).toEqual(['visible', 0]);
    } finally {
      await context.close();
    }
  }, 60_000);
});

describe('calculul pozitiilor (scriptul rulat in pagina)', () => {
  let context: BrowserContext;
  let page: Page;

  // Pagina intr-un context propriu, ca in scanner (lipirea capturii deschide o fila in el)
  beforeEach(async () => {
    context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    page = await context.newPage();
  });

  afterEach(() => context.close());

  it('Shadow DOM, element ascuns, iframe, selector invalid si display: contents', async () => {
    await page.setContent(`
      <div id="gazda"></div>
      <p id="vizibil" style="margin:0;position:absolute;top:1500px;left:40px;width:100px;height:20px">x</p>
      <p id="ascuns" style="display:none">y</p>
      <nav id="continut" style="display:contents"><a href="#" style="position:absolute;top:100px;left:200px;width:80px;height:30px;display:block">a</a></nav>`);
    await page.evaluate(`(() => {
      const root = document.getElementById("gazda").attachShadow({ mode: "open" });
      root.innerHTML = '<a class="in-umbra" href="#" style="display:inline-block;width:50px;height:10px">z</a>';
    })()`);

    const boxes = await page.evaluate(
      `(${ELEMENT_BOXES_SCRIPT})(${JSON.stringify([
        ['#vizibil'],
        ['#ascuns'],
        [['#gazda', 'a.in-umbra']],
        ['iframe', 'p'],
        ['p:::invalid'],
        ['#continut'],
      ])})`,
    );

    expect(boxes).toEqual([
      // Pozitia e fata de coltul paginii, nu al ferestrei; elementul e sub fereastra (nu se vede)
      { x: 40, y: 1500, width: 100, height: 20, view: 'none', oversize: false },
      null, // ascuns: nu are dimensiune
      expect.objectContaining({ width: 50, height: 10, view: 'full' }), // din Shadow DOM
      null, // dintr-un iframe: nu primeste pozitie
      null, // selector invalid: nu strica restul
      // display: contents (fara cutie proprie): dreptunghiul continutului (linkul din el)
      expect.objectContaining({ x: 200, y: 100, width: 80, height: 30, view: 'full' }),
    ]);
  });

  it('o pagina statica nu asteapta degeaba si e aratata ca o singura imagine continua', async () => {
    // Un buton fix "sus" apare la derulare: nu conteaza (e ascuns dupa primul ecran)
    await page.setContent(`
      <style>body { margin: 0; }</style>
      <div style="height:3000px;background:#eee">statica</div>
      <span id="peste" style="position:absolute;top:550px;left:10px;width:30px;height:100px;background:#f00"></span>
      <a id="sus" href="#" style="position:fixed;bottom:10px;right:10px;opacity:0;transition:opacity .3s">Sus</a>
      <script>
        addEventListener("scroll", () => {
          document.getElementById("sus").classList.toggle("activ", scrollY > 100);
          document.getElementById("sus").style.opacity = scrollY > 100 ? "1" : "0";
        });
      </script>`);
    const capture = await capturePage(page, [['#peste']]);
    expect(capture.reactiveFrames).toBe(0);
    expect(capture.seams.every((d) => d === 0)).toBe(true);
    expect(capture.frameHeight).toBeNull();
    expect(capture.height).toBe(3000);
    // Elementul taiat de marginea primului ecran (550-650) are chenarul intreg, fata de pagina
    expect(capture.boxes.get(JSON.stringify(['#peste']))).toEqual({
      x: 10,
      y: 550,
      width: 30,
      height: 100,
    });
    const [top, bottom] = await pixelsAt(capture.image, [
      [25, 560],
      [25, 640],
    ]);
    closeTo(top!, [0xff, 0x00, 0x00]);
    closeTo(bottom!, [0xff, 0x00, 0x00]);
  });

  it('o pagina foarte lunga e taiata la limita capturii si marcata', async () => {
    await page.setContent('<div style="height:20000px;background:#eee">lunga</div>');
    const capture = await capturePage(page, []);
    // Cate ecrane de 600 px incap in limita capturii
    // Cel mult cate ecrane de 600 px incap in limita; pasul e 600 - 64 = 536
    const frames = Math.floor(MAX_CAPTURE_HEIGHT / 600);
    expect(capture.height).toBe((frames - 1) * 536 + 600);
    expect(capture.pageHeight).toBeGreaterThanOrEqual(20_000);
    expect(capture.truncated).toBe(true);
  }, 60_000);
});

describe('tot fluxul: coada -> worker -> baza de date', () => {
  it('salveaza captura si pozitia elementelor impreuna cu rezultatele', async () => {
    const project = await testDb.project.create({ data: { name: 'Demo', baseUrl: `${origin}/` } });
    const scan = await testDb.scan.create({
      data: { projectId: project.id, pageUrl: `${origin}/broken/`, config },
    });
    await processScan(
      {
        db: testDb,
        browser,
        browserVersion: describeBrowser(browser, channel),
        guardOptions: { allowedLocalOrigins: [origin] },
        logger: createLogger('silent'),
      },
      (await claimNextScan(testDb))!,
    );

    const shot = await testDb.scanScreenshot.findUnique({ where: { scanId: scan.id } });
    expect(shot).toMatchObject({ format: 'webp', width: 1366, truncated: false });
    const image = await testDb.affectedElement.findFirst({
      where: { ruleResult: { scanId: scan.id, axeRuleId: 'image-alt' } },
    });
    expect(image).toMatchObject({ boxWidth: 640, boxHeight: 280 }); // <img width="640" height="280">
  }, 60_000);
});
