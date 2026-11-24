/**
 * Testul numararii a ce contine pagina (pentru verificarea manuala), cu browser real (Chrome):
 *   - imaginile (inclusiv input type=image, area cu link, role=img), formularele si campurile
 *     lor (fara campuri ascunse si butoane);
 *   - titlurile in ordine, cu nivelul (si aria-level, role=heading), textul scurtat si cele
 *     ascunse marcate;
 *   - o pagina fara imagini si fara formulare da 0 (verificarile lor nu se aplica).
 *
 * Are nevoie de browserul din BROWSER_CHANNEL (implicit Google Chrome instalat).
 */
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BROWSER_CHANNELS, launchBrowser, type BrowserChannel } from '../src/scanner/browser';
import { collectPageFacts } from '../src/scanner/page-facts';

const channel = (process.env.BROWSER_CHANNEL ?? 'chrome') as BrowserChannel;
if (!BROWSER_CHANNELS.includes(channel)) throw new Error(`BROWSER_CHANNEL invalid: ${channel}`);

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launchBrowser(channel);
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

beforeEach(async () => {
  page = await browser.newPage();
});

describe('ce contine pagina', () => {
  it('numara imaginile, formularele, campurile si titlurile, in ordine', async () => {
    await page.setContent(`<!doctype html><html lang="ro"><body>
      <h1>Primăria Valea Verde</h1>
      <img src="data:," alt="Sediul">
      <div role="img" aria-label="Hartă"></div>
      <map name="m"><area href="#" alt="Zona"></map>
      <h2>   Programări
        online </h2>
      <form>
        <input type="hidden" name="token">
        <input name="nume"><input type="email"><select><option>1</option></select><textarea></textarea>
        <input type="checkbox">
        <input type="image" src="data:," alt="Trimite"><button>Trimite</button><input type="submit">
      </form>
      <div role="heading" aria-level="3">Detalii</div>
      <div role="heading">Fără nivel</div>
      <nav hidden><h2>Meniu ascuns</h2></nav>
      <h4>${'Foarte lung '.repeat(20)}</h4>
    </body></html>`);

    const facts = await collectPageFacts(page);

    expect(facts).toMatchObject({ images: 4, forms: 1, formFields: 5, headingsTruncated: false });
    expect(facts!.headings.map((h) => [h.level, h.hidden])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [2, false], // role=heading fara aria-level = nivelul 2
      [2, true], // in meniul ascuns
      [4, false],
    ]);
    expect(facts!.headings[1]!.text).toBe('Programări online');
    expect(facts!.headings[5]!.text.length).toBeLessThanOrEqual(121);
    expect(facts!.headings[5]!.text.endsWith('…')).toBe(true);
  }, 30_000);

  it('o pagina fara imagini si fara formulare da 0', async () => {
    await page.setContent(`<!doctype html><html lang="ro"><body>
      <p>Doar text, <a href="#">un link</a> și <button>un buton</button>.</p>
    </body></html>`);

    expect(await collectPageFacts(page)).toEqual({
      images: 0,
      forms: 0,
      formFields: 0,
      headings: [],
      headingsTruncated: false,
    });
  }, 30_000);
});
