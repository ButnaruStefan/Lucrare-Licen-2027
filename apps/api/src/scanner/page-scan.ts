/**
 * Scanarea unei pagini: deschide pagina intr-un browser real (Playwright) si ruleaza axe-core.
 *
 * Pasii:
 *   1. creeaza un "context" de browser nou si izolat (fara cookie-uri sau date de la alte scanari);
 *   2. intercepteaza FIECARE cerere a paginii si o lasa sa treaca doar daca paznicul adreselor
 *      o accepta (protectie SSRF). Redirectionarile sunt urmate de noi, pas cu pas, ca fiecare
 *      adresa noua sa fie verificata (browserul, lasat singur, le-ar urma fara verificare);
 *   3. incarca pagina cu limita de timp, asteapta sa se stabilizeze;
 *   4. ruleaza axe-core cu etichetele profilului ales (ex. WCAG 2.2 AA);
 *   5. inchide contextul, orice s-ar intampla.
 *
 * Nu scrie in baza de date: returneaza rezultatul brut sau motivul esecului.
 */
import { AxeBuilder } from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import { errors, type Browser } from 'playwright';
import type { ScanConfig, WcagProfile } from '@ro-a11y/shared';
import type { RequestGuard } from '../safety/url-guard';

/** Etichetele axe rulate pentru fiecare profil WCAG. */
const PROFILE_TAGS: Record<WcagProfile, string[]> = {
  WCAG_2_1_AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  WCAG_2_2_AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
};

export function axeTagsFor(config: Pick<ScanConfig, 'wcagProfile' | 'includeBestPractices'>) {
  const tags = [...PROFILE_TAGS[config.wcagProfile]];
  if (config.includeBestPractices) tags.push('best-practice');
  return tags;
}

/** Codurile de eroare posibile ale unei scanari esuate.
 *  unSAFE_URL - adresa URL nu este sigura (este de tip localhost sau este o adresa IP)
 *  navigation_TIMEOUT - pagina nu s-a incarcat in timp util
 *  navigation_FAILED - navigarea paginii a esuat
 *  HTTP_ERROR - eroarea HTTP la navigarea paginii
 *  ANALYSIS_FAILED - analiza paginii a esuat
 */
export type ScanErrorCode =
  'UNSAFE_URL' | 'NAVIGATION_TIMEOUT' | 'NAVIGATION_FAILED' | 'HTTP_ERROR' | 'ANALYSIS_FAILED';

// Cele 2 tipuri de rezultate ale unei scanari (fie reusita, fie esuata)
export type PageScanOutcome =
  | {
      ok: true;
      raw: AxeResults;
      finalUrl: string;
      httpStatus: number;
      blockedRequests: string[];
    }
  | {
      ok: false;
      errorCode: ScanErrorCode;
      errorMessage: string;
      finalUrl: string | null;
      httpStatus: number | null;
      blockedRequests: string[];
    };

/** Cat asteptam, cel mult, evenimentul "load" (imagini, stiluri) dupa ce documentul e gata. */
const LOAD_WAIT_MS = 10_000;

/** Cate redirectionari urmam, cel mult, pentru o pagina sau o resursa. */
const MAX_REDIRECTS = 10;

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

export async function scanPage(
  browser: Browser,
  pageUrl: string,
  config: ScanConfig,
  guard: RequestGuard,
): Promise<PageScanOutcome> {
  // Lista cu URL-urile blocate de paznic (pentru diagnosticare)
  const blockedRequests: string[] = [];
  /** Motivul pentru care navigarea paginii principale a fost blocata (daca a fost). */
  let mainNavigationBlocked: string | null = null;
  /** Unde vrea serverul sa redirectioneze pagina principala (o urmam noi, pas cu pas). */
  let pendingMainRedirect: string | null = null;

  const context = await browser.newContext({
    viewport: config.viewport, //dimensiunea ferestrei browserului
    locale: config.locale, //limba browserului
    acceptDownloads: false, //nu descarcam fisiere
    serviceWorkers: 'block', //blocam worker-ii (serviciile web)
  });

  try {
    // Fiecare cerere HTTP a paginii trece prin paznic.
    //
    // Atentie la redirectionari: daca browserul face singur cererea, el urmeaza redirectionarile
    // serverului FARA sa mai treaca prin acest filtru (o pagina publica ar putea redirectiona
    // spre http://127.0.0.1/admin). De aceea facem noi cererea, cu redirectionarile oprite
    // (maxRedirects: 0), si tratam fiecare redirectionare separat:
    //   - pagina principala: oprim cererea si navigam noi spre noua adresa (cererea noua trece
    //     din nou prin paznic, iar adresa paginii ramane corecta pentru resursele ei);
    //   - resurse (imagini, stiluri, iframe-uri): urmam noi lantul, verificand fiecare pas.
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      const isMainNavigation =
        request.isNavigationRequest() && request.frame().parentFrame() === null;

      //Functia de la Paznic verifica daca URL-ul este sigur
      const check = await guard(url);
      if (!check.ok) {
        blockedRequests.push(url); //punem intr-un array URL-urile blocate pt diagnostic
        if (isMainNavigation) mainNavigationBlocked = check.message;
        return route.abort('blockedbyclient'); //punem intr-un alt array motivul pt care a fost blocata cererea
      }

      try {
        let response = await route.fetch({ maxRedirects: 0, timeout: config.timeoutMs }); //0 pt ca noi facem redirectionarile manual
        let location = response.headers()['location']; //header-ul de la raspunsul HTTP care ne indica daca s-a facut o redirectionare

        if (isRedirect(response.status()) && location && isMainNavigation) {
          pendingMainRedirect = new URL(location, url).toString(); //se salveaza redirectarea pt a fi dusa mai tarziu la final
          return await route.abort('aborted'); //se opreste cererea de la pagina principala pt a nu face redirectarile automat
        }

        let currentUrl = url;
        for (let hop = 0; isRedirect(response.status()) && location; hop++) {
          const nextUrl = new URL(location, currentUrl).toString();
          const nextCheck = await guard(nextUrl);
          if (hop >= MAX_REDIRECTS || !nextCheck.ok) {
            if (!nextCheck.ok) blockedRequests.push(nextUrl);
            return await route.abort('blockedbyclient');
          }
          response = await context.request.fetch(nextUrl, {
            maxRedirects: 0,
            timeout: config.timeoutMs,
          });
          currentUrl = nextUrl;
          location = response.headers()['location'];
        }
        return await route.fulfill({ response });
      } catch {
        return route.abort('failed').catch(() => {});
      }
    });
    // Conexiunile WebSocket nu trec prin route(), deci le inchidem pe toate.
    await context.routeWebSocket('**', (ws) => ws.close());

    const page = await context.newPage();
    let response;
    let target = pageUrl;
    for (let hop = 0; ; hop++) {
      pendingMainRedirect = null;
      try {
        response = await page.goto(target, {
          waitUntil: 'domcontentloaded',
          timeout: config.timeoutMs,
        });
        break;
      } catch (err) {
        const finalUrl = page.url() === 'about:blank' ? null : page.url();
        if (mainNavigationBlocked) {
          return fail('UNSAFE_URL', mainNavigationBlocked, finalUrl, null, blockedRequests);
        }
        if (pendingMainRedirect) {
          if (hop >= MAX_REDIRECTS) {
            return fail(
              'NAVIGATION_FAILED',
              'Pagina face prea multe redirecționări.',
              finalUrl,
              null,
              blockedRequests,
            );
          }
          target = pendingMainRedirect; // urmatoarea navigare trece din nou prin paznic
          continue;
        }
        if (err instanceof errors.TimeoutError) {
          return fail(
            'NAVIGATION_TIMEOUT',
            `Pagina nu s-a încărcat în ${Math.round(config.timeoutMs / 1000)} secunde.`,
            finalUrl,
            null,
            blockedRequests,
          );
        }
        return fail(
          'NAVIGATION_FAILED',
          `Pagina nu a putut fi deschisă: ${firstLine(err)}`,
          finalUrl,
          null,
          blockedRequests,
        );
      }
    }

    if (!response) {
      return fail(
        'NAVIGATION_FAILED',
        'Pagina nu a returnat niciun răspuns.',
        page.url(),
        null,
        blockedRequests,
      );
    }
    const httpStatus = response.status();
    if (httpStatus >= 400) {
      return fail(
        'HTTP_ERROR',
        `Serverul a răspuns cu codul ${httpStatus}; pagina nu a fost analizată.`,
        page.url(),
        httpStatus,
        blockedRequests,
      );
    }

    // Lasam pagina sa termine de incarcat imaginile si stilurile, dar fara sa asteptam la nesfarsit.
    await page.waitForLoadState('load', { timeout: LOAD_WAIT_MS }).catch(() => {});
    if (config.settleMs > 0) await page.waitForTimeout(config.settleMs);

    // Pagina a incercat, din JavaScript, sa navigheze spre o adresa interzisa.
    if (mainNavigationBlocked) {
      return fail('UNSAFE_URL', mainNavigationBlocked, page.url(), httpStatus, blockedRequests);
    }

    let raw: AxeResults;
    try {
      raw = await new AxeBuilder({ page }).withTags(axeTagsFor(config)).analyze();
    } catch (err) {
      return fail(
        'ANALYSIS_FAILED',
        `Analiza axe-core a eșuat: ${firstLine(err)}`,
        page.url(),
        httpStatus,
        blockedRequests,
      );
    }

    return { ok: true, raw, finalUrl: page.url(), httpStatus, blockedRequests };
  } finally {
    await context.close().catch(() => {});
  }
}

function fail(
  errorCode: ScanErrorCode,
  errorMessage: string,
  finalUrl: string | null,
  httpStatus: number | null,
  blockedRequests: string[],
): PageScanOutcome {
  return { ok: false, errorCode, errorMessage, finalUrl, httpStatus, blockedRequests };
}

/** Prima linie a mesajului de eroare (mesajele Playwright au si detalii tehnice lungi). */
function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split('\n')[0] ?? message;
}
