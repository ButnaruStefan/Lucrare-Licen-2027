/**
 * Testele capturii pentru harta problemelor, cu browser real (Chrome):
 *
 *   1. captura site-ului de antrenament e WebP, cat pagina, iar chenarele calculate cad EXACT
 *      peste elemente: verificam culoarea pixelilor din captura in chenarul butonului albastru
 *      (B08, fundal #002b7f) si al iconitei albe din subsol (B10);
 *   2. calculul pozitiilor: Shadow DOM, element ascuns, element dintr-un iframe, selector invalid;
 *   3. o pagina foarte lunga e taiata la limita capturii si marcata "taiata";
 *   4. tot fluxul (coada -> worker -> baza de date) salveaza captura si pozitiile.
 *
 * Are nevoie de browserul din BROWSER_CHANNEL (implicit Google Chrome instalat).
 */
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { capturePage, ELEMENT_BOXES_SCRIPT, MAX_CAPTURE_HEIGHT } from '../src/scanner/capture';
import { boxesByTarget } from '../src/scanner/normalize';
import { affectedTargets, scanPage } from '../src/scanner/page-scan';
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
    expect(capture.height).toBe(capture.pageHeight);

    const boxes = boxesByTarget(affectedTargets(outcome.raw), capture.boxes);
    const boxOf = (ruleId: string) => {
      const node = outcome.raw.violations.find((r) => r.id === ruleId)!.nodes[0]!;
      return boxes.get(JSON.stringify(node.target))!;
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

describe('calculul pozitiilor (scriptul rulat in pagina)', () => {
  let page: Page;

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  });

  it('Shadow DOM, element ascuns, iframe si selector invalid', async () => {
    await page.setContent(`
      <div id="gazda"></div>
      <p id="vizibil" style="margin:0;position:absolute;top:1500px;left:40px;width:100px;height:20px">x</p>
      <p id="ascuns" style="display:none">y</p>`);
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
      ])})`,
    );

    expect(boxes).toEqual([
      // Pozitia e fata de coltul paginii, nu al ferestrei (elementul e sub fereastra)
      { x: 40, y: 1500, width: 100, height: 20 },
      null, // ascuns: nu are dimensiune
      expect.objectContaining({ width: 50, height: 10 }), // din Shadow DOM
      null, // dintr-un iframe: nu primeste pozitie
      null, // selector invalid: nu strica restul
    ]);
  });

  it('o pagina foarte lunga e taiata la limita capturii si marcata', async () => {
    await page.setContent('<div style="height:20000px;background:#eee">lunga</div>');
    const capture = await capturePage(page, []);
    expect(capture.height).toBe(MAX_CAPTURE_HEIGHT);
    expect(capture.pageHeight).toBeGreaterThanOrEqual(20_000);
    expect(capture.truncated).toBe(true);
  });
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
