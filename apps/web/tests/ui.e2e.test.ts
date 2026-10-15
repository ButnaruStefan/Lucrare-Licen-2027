/**
 * Testele interfetei, in Chrome real, cu API simulat (vezi mock-api.ts).
 *
 * Verifica trei lucruri:
 *   1. fluxurile functioneaza (lista, formular cu erori, navigare, scanare in curs, filtre);
 *   2. accesibilitatea interfetei: axe-core NU gaseste nicio problema pe paginile noastre
 *      (in modul luminos si in cel intunecat), iar focusul si tastatura functioneaza corect;
 *   3. securitatea: un fragment HTML rau intentionat din pagina scanata e afisat ca text.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HOSTILE_HTML, makeScan, mockApi, PROJECT } from './mock-api';

const channel = process.env.BROWSER_CHANNEL ?? 'chrome';
const SCAN_ID = makeScan().id;

let vite: ViteDevServer;
let baseUrl: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  vite = await createServer({
    configFile: new URL('../vite.config.ts', import.meta.url).pathname,
    root: new URL('..', import.meta.url).pathname,
    server: { port: 5199, strictPort: false },
    logLevel: 'silent',
  });
  await vite.listen();
  baseUrl = vite.resolvedUrls!.local[0]!.replace(/\/$/, '');
  browser = await chromium.launch({ channel: channel === 'chromium' ? undefined : channel });

  // Incalzire: la prima deschidere (mai ales dupa `npm install`), Vite isi pregateste bibliotecile
  // si poate reincarca pagina. Facem asta o data aici, ca reincarcarea sa nu cada in mijlocul
  // unui test si sa-l faca sa pice la intamplare.
  const warmup = await browser.newPage();
  await mockApi(warmup);
  await warmup.goto(`${baseUrl}/`);
  await warmup.waitForLoadState('networkidle');
  await warmup.getByRole('link', { name: PROJECT.name }).waitFor();
  await warmup.close();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

beforeEach(async () => {
  context = await browser.newContext({ locale: 'ro-RO', viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
});

afterEach(async () => {
  await context.close();
});

/** Ruleaza axe-core pe pagina curenta si returneaza regulile incalcate. */
async function axeViolations(p: Page = page) {
  const results = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
}

describe('pagina de proiecte', () => {
  it('afiseaza proiectele si nu are probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/`);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Proiecte' }).isVisible(),
    ).resolves.toBe(true);
    await page.getByRole('link', { name: PROJECT.name }).waitFor();
    expect(await page.title()).toBe('Proiecte — W4A');
    expect(await axeViolations()).toEqual([]);
  });

  it('arata erorile serverului langa campuri si muta focusul pe primul camp gresit', async () => {
    await mockApi(page, {
      createProject: {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datele trimise nu sunt valide.',
            details: [
              { field: 'name', message: 'Numele este obligatoriu.' },
              { field: 'baseUrl', message: 'Sunt acceptate doar adrese http:// sau https://.' },
            ],
          },
        },
      },
    });
    await page.goto(`${baseUrl}/`);
    await page.getByRole('button', { name: 'Adaugă proiectul' }).click();

    const name = page.getByLabel('Nume', { exact: true });
    await page.getByText('Numele este obligatoriu.').waitFor();
    expect(await name.getAttribute('aria-invalid')).toBe('true');
    // Mesajul de eroare e legat de camp (cititorul de ecran il citeste impreuna cu eticheta)
    const describedBy = (await name.getAttribute('aria-describedby')) ?? '';
    const errorText = await page.locator(`[id="${describedBy.split(' ').pop()}"]`).innerText();
    expect(errorText).toContain('Numele este obligatoriu.');
    await expect.poll(() => name.evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await axeViolations()).toEqual([]);
  });

  it('dupa crearea proiectului navigheaza la el si muta focusul pe titlu', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/`);
    await page.getByLabel('Nume', { exact: true }).fill(PROJECT.name);
    await page.getByLabel('Adresa site-ului').fill(PROJECT.baseUrl);
    await page.getByRole('button', { name: 'Adaugă proiectul' }).click();

    await page.waitForURL(`**/proiecte/${PROJECT.id}`);
    const heading = page.getByRole('heading', { level: 1, name: PROJECT.name });
    await heading.waitFor();
    await expect.poll(() => heading.evaluate((el) => el === document.activeElement)).toBe(true);
  });
});

describe('pagina proiectului', () => {
  it('afiseaza formularul de scanare si istoricul, fara probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/proiecte/${PROJECT.id}`);

    await page.getByRole('button', { name: 'Scanează pagina' }).waitFor();
    await page.getByRole('cell', { name: 'Finalizată' }).waitFor();
    expect(await axeViolations()).toEqual([]);
  });
});

describe('pagina scanarii', () => {
  it('afiseaza sumarul si problemele detectate, fara probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);

    await page.getByRole('heading', { name: 'Sumar' }).waitFor();
    await page.getByText('2 reguli afișate').waitFor();
    expect(await page.locator('.rule').count()).toBe(2);
    expect(await axeViolations()).toEqual([]);
  });

  it('filtreaza dupa categorie, cautare si bune practici', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);
    await page.getByText('2 reguli afișate').waitFor();

    await page.getByLabel('Arată și bunele practici').uncheck();
    await page.getByText('1 regulă afișată').waitFor();

    await page.getByRole('radio', { name: /De verificat manual/ }).check();
    await page.getByText('color-contrast', { exact: true }).waitFor();
    expect(page.url()).toContain('categorie=incomplete');

    await page.getByLabel('Caută regulă sau criteriu WCAG').fill('2.4.2');
    await page.getByText('Niciun rezultat pentru filtrele alese.').waitFor();
  });

  it('afiseaza HTML-ul paginii scanate ca text, fara sa-l execute', async () => {
    let dialogOpened = false;
    page.on('dialog', async (dialog) => {
      dialogOpened = true;
      await dialog.dismiss();
    });
    await mockApi(page);
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);
    await page.locator('.rule summary').first().click();

    await page.getByText(HOSTILE_HTML).waitFor();
    expect(await page.locator('.rule img').count()).toBe(0);
    await page.waitForTimeout(300);
    expect(dialogOpened).toBe(false);
    // Si cu regula deschisa, pagina ramane accesibila
    expect(await axeViolations()).toEqual([]);
  });

  it('se actualizeaza singura cat timp scanarea ruleaza', async () => {
    await mockApi(page, {
      scanSequence: [
        makeScan({ status: 'queued', startedAt: null, finishedAt: null, summary: null }),
        makeScan({ status: 'running', finishedAt: null, summary: null }),
        makeScan(),
      ],
    });
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);

    // Starea intermediara poate fi "in asteptare" sau direct "in curs" (in dezvoltare, React
    // face prima cerere de doua ori), important e ca pagina sa ajunga singura la "incheiata".
    await page.getByText(/Scanarea (așteaptă să fie preluată|este în curs)/).waitFor();
    await page.getByText('Scanarea s-a încheiat').waitFor({ timeout: 10_000 });
    await page.getByRole('heading', { name: 'Sumar' }).waitFor();
  }, 20_000);

  it('explica o scanare esuata, fara sa o prezinte ca problema de accesibilitate', async () => {
    await mockApi(page, {
      scanSequence: [
        makeScan({
          status: 'failed',
          summary: null,
          errorCode: 'UNSAFE_URL',
          errorMessage: 'Adresa duce către o rețea internă sau rezervată și nu poate fi scanată.',
        }),
      ],
    });
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);

    await page.getByText('Scanarea nu a putut fi finalizată').waitFor();
    await page.getByText('Un eșec tehnic nu înseamnă că site-ul este inaccesibil.').waitFor();
    expect(await page.getByRole('heading', { name: 'Sumar' }).count()).toBe(0);
    expect(await axeViolations()).toEqual([]);
  });

  it('nu are probleme de accesibilitate nici in modul intunecat', async () => {
    const dark = await browser.newContext({ colorScheme: 'dark', locale: 'ro-RO' });
    const darkPage = await dark.newPage();
    await mockApi(darkPage);
    await darkPage.goto(`${baseUrl}/scanari/${SCAN_ID}`);
    await darkPage.getByText('2 reguli afișate').waitFor();
    await darkPage.locator('.rule summary').first().click();

    expect(await axeViolations(darkPage)).toEqual([]);
    await dark.close();
  });
});

describe('navigare si tastatura', () => {
  it('primul Tab ajunge la legatura "Sari la continutul principal"', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/`);
    await page.getByRole('link', { name: PROJECT.name }).waitFor();

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toBe('Sari la conținutul principal');
  });

  it('o adresa necunoscuta afiseaza pagina "nu exista", fara probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/adresa-inexistenta`);

    await page.getByRole('heading', { level: 1, name: 'Pagina nu există' }).waitFor();
    expect(await axeViolations()).toEqual([]);
  });

  it('pagina "Despre si limitari" nu are probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/despre`);

    await page.getByRole('heading', { level: 1, name: 'Despre și limitări' }).waitFor();
    expect(await axeViolations()).toEqual([]);
  });
});
