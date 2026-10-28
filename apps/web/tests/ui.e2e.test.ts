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
    // Pe un calculator incarcat, actualizarea formularului si mutarea focusului pot dura mai
    // mult: asteptam explicit fiecare pas, cu o limita generoasa, in loc sa verificam o singura data.
    const patience = { timeout: 10_000 };
    await page.locator('.field__error', { hasText: 'Numele este obligatoriu.' }).waitFor(patience);
    await expect.poll(() => name.getAttribute('aria-invalid'), patience).toBe('true');
    // Mesajul de eroare e legat de camp (cititorul de ecran il citeste impreuna cu eticheta)
    const describedBy = (await name.getAttribute('aria-describedby')) ?? '';
    const errorText = await page.locator(`[id="${describedBy.split(' ').pop()}"]`).innerText();
    expect(errorText).toContain('Numele este obligatoriu.');
    await expect
      .poll(() => name.evaluate((el) => el === document.activeElement), patience)
      .toBe(true);
    expect(await axeViolations()).toEqual([]);
  });

  it('pentru o adresa deja folosita ofera legatura spre proiectul existent', async () => {
    await mockApi(page, {
      createProject: {
        status: 409,
        body: {
          error: {
            code: 'PROJECT_EXISTS',
            message: `Există deja un proiect pentru acest site: „${PROJECT.name}”.`,
            details: [
              {
                field: 'baseUrl',
                message: `Există deja un proiect pentru acest site: „${PROJECT.name}”.`,
              },
            ],
            existingId: PROJECT.id,
          },
        },
      },
    });
    await page.goto(`${baseUrl}/`);
    await page.getByLabel('Nume', { exact: true }).fill('Alt nume');
    await page.getByLabel('Adresa site-ului').fill(PROJECT.baseUrl);
    await page.getByRole('button', { name: 'Adaugă proiectul' }).click();

    const link = page.getByRole('link', { name: 'Deschide proiectul existent' });
    await link.waitFor();
    expect(await link.getAttribute('href')).toBe(`/proiecte/${PROJECT.id}`);
    expect(await axeViolations()).toEqual([]);
  });

  it('avertizeaza (fara sa blocheze) cand numele e deja folosit', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/`);
    await page.getByRole('link', { name: PROJECT.name }).waitFor();
    const name = page.getByLabel('Nume', { exact: true });
    await name.fill(PROJECT.name.toUpperCase());

    await page.getByText('Există deja un proiect cu acest nume').waitFor();
    expect(await name.getAttribute('aria-invalid')).toBeNull();
    expect(await name.getAttribute('aria-describedby')).toContain('avertisment');
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
    // Profilul juridic necompletat: statusul "Neevaluată" si legatura spre chestionar
    await page.getByRole('link', { name: 'Completează profilul juridic' }).waitFor();
    expect(await axeViolations()).toEqual([]);
  });
});

describe('profilul juridic (OUG 112/2018)', () => {
  const profileUrl = () => `${baseUrl}/proiecte/${PROJECT.id}/profil-juridic`;
  const patience = { timeout: 10_000 };

  it('afiseaza intrebarile in functie de raspunsuri, fara probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(profileUrl());

    const first = page.getByRole('group', { name: 'Cine administrează site-ul?' });
    await first.waitFor(patience);
    // La inceput apare doar prima intrebare
    expect(await page.getByRole('group').count()).toBe(1);
    expect(await axeViolations()).toEqual([]);

    // Pentru un ONG apar si intrebarile despre servicii
    await page.getByRole('radio', { name: /fără scop patrimonial/ }).check();
    expect(await page.getByRole('group').count()).toBe(5);
    // Pentru o firma privata nu mai e nevoie de alte intrebari
    await page.getByRole('radio', { name: /firmă privată/ }).check();
    expect(await page.getByRole('group').count()).toBe(1);
  });

  it('o intrebare fara raspuns e semnalata, iar focusul merge pe ea', async () => {
    await mockApi(page);
    await page.goto(profileUrl());
    await page.getByRole('radio', { name: /autoritate sau instituție publică/ }).check(patience);

    await page.getByRole('button', { name: 'Evaluează și salvează' }).click();

    const broadcaster = page.getByRole('group', { name: /radiodifuziune/ });
    await broadcaster.getByText('Alege un răspuns.').waitFor(patience);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('name'));
    expect(focused).toBe('publicBroadcaster');
    expect(await page.getByRole('heading', { name: 'Rezultatul evaluării' }).count()).toBe(0);
  });

  it('evalueaza raspunsurile si arata temeiul, fara probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(profileUrl());
    await page.getByRole('radio', { name: /autoritate sau instituție publică/ }).check(patience);
    await page
      .getByRole('group', { name: /radiodifuziune/ })
      .getByLabel('Nu', { exact: true })
      .check();
    await page.getByRole('radio', { name: 'Publicului larg' }).check();

    await page.getByRole('button', { name: 'Evaluează și salvează' }).click();

    const heading = page.getByRole('heading', { name: 'Rezultatul evaluării' });
    await heading.waitFor(patience);
    await page.waitForFunction(() => document.activeElement?.id === 'rezultat-profil');
    const result = await page.locator('.assessment').innerText();
    expect(result).toContain('Aplicabilă, conform răspunsurilor');
    expect(result).toContain('art. 2 lit. a)');
    expect(result).toContain('De confirmat de un specialist');
    expect(result).toContain('Nu este consultanță juridică');
    expect(await axeViolations()).toEqual([]);
  });

  it('pentru un ONG fara servicii esentiale sau pentru persoane cu dizabilitati arata exceptia', async () => {
    await mockApi(page);
    await page.goto(profileUrl());
    await page.getByRole('radio', { name: /fără scop patrimonial/ }).check(patience);
    await page
      .getByRole('group', { name: /radiodifuziune/ })
      .getByLabel('Nu', { exact: true })
      .check();
    await page
      .getByRole('group', { name: /servicii esențiale/ })
      .getByLabel('Nu', { exact: true })
      .check();
    await page
      .getByRole('group', { name: /dizabilități/ })
      .getByLabel('Nu', { exact: true })
      .check();
    await page.getByRole('radio', { name: 'Publicului larg' }).check();

    await page.getByRole('button', { name: 'Evaluează și salvează' }).click();

    await page.getByRole('heading', { name: 'Rezultatul evaluării' }).waitFor(patience);
    const result = await page.locator('.assessment').innerText();
    expect(result).toContain('Neaplicabilă, conform răspunsurilor');
    expect(result).toContain('art. 1 alin. (3) lit. b)');
    expect(result).toContain('art. 1 alin. (3) lit. c)');
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
    await page.locator('.rule__id', { hasText: 'color-contrast' }).waitFor();
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
    await page.locator('.fold__summary', { hasText: 'Unde apare' }).first().click();

    await page.getByText(HOSTILE_HTML).waitFor();
    expect(await page.locator('.rule img').count()).toBe(0);
    await page.waitForTimeout(300);
    expect(dialogOpened).toBe(false);
    // Si cu regula deschisa, pagina ramane accesibila
    expect(await axeViolations()).toEqual([]);
  });

  it('arata lantul de trasabilitate si remedierea in romana, fara probleme de accesibilitate', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);
    // Titlul regulii apare in romana (din catalogul de remedieri)
    const rule = page.locator('.rule', { hasText: 'Imaginile trebuie să aibă text alternativ' });
    await rule.locator(':scope > details > summary').click();
    // Sectiunile sunt pliate; titlul sectiunii de trasabilitate arata deja rezumatul lantului
    const traceFold = rule.locator('.fold__summary', { hasText: 'Trasabilitate normativă' });
    expect(await traceFold.innerText()).toContain('WCAG 1.1.1 · EN 9.1.1.1 · OUG 112/2018');
    await traceFold.click();

    const trace = rule.getByRole('region', { name: 'Trasabilitate pentru regula image-alt' });
    await trace.waitFor();
    const text = await trace.innerText();
    expect(text).toContain('1.1.1 Conținut non-text');
    expect(text).toContain('Clauza 9.1.1.1');
    expect(text).toContain('Confirmat (2 surse)');
    expect(text).toContain('art. 3 alin. (2) lit. a)');
    expect(text).toContain('art. 5 alin. (1)');
    expect(text).toContain('Neevaluată');
    expect(text).toContain('Nu reprezintă o concluzie juridică');

    // Remedierea: exemplul "inainte / dupa"
    await rule.locator('.fold__summary', { hasText: 'Cum repari' }).click();
    await rule
      .getByText('<img src="sediu.jpg" alt="Intrarea principală în sediul primăriei">')
      .waitFor();
    expect(await axeViolations()).toEqual([]);
  });

  it('sectiunile unui rezultat sunt pliate implicit si se deschid din tastatura', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);
    const rule = page.locator('.rule').first();
    await rule.locator(':scope > details > summary').click();

    const folds = rule.locator('details.fold');
    expect(await folds.count()).toBe(5);
    for (const fold of await folds.all()) {
      expect(await fold.getAttribute('open')).toBeNull();
    }
    // Enter pe titlul sectiunii o deschide
    await rule.locator('.fold__summary', { hasText: 'Cum repari' }).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => rule.locator('details.fold', { hasText: 'Cum repari' }).getAttribute('open'))
      .not.toBeNull();
  });

  it('o regula de buna practica nu are legatura normativa', async () => {
    await mockApi(page);
    await page.goto(`${baseUrl}/scanari/${SCAN_ID}`);
    const rule = page.locator('.rule', { hasText: 'region' });
    await rule.locator(':scope > details > summary').click();
    const traceFold = rule.locator('.fold__summary', { hasText: 'Trasabilitate normativă' });
    expect(await traceFold.innerText()).toContain('Bună practică: fără legătură normativă');
    await traceFold.click();

    await rule.getByText('Fără legătură normativă', { exact: true }).waitFor();
    expect(await rule.getByText('OUG nr. 112/2018').count()).toBe(0);
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
    // Toate sectiunile deschise, ca axe sa verifice tot continutul
    for (const fold of await darkPage.locator('.rule').first().locator('.fold__summary').all()) {
      await fold.click();
    }

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
