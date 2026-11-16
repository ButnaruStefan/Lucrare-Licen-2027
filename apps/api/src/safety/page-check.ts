/**
 * Verifica daca o pagina adaugata manual intr-un audit exista, INAINTE de a fi pusa in lista
 * paginilor de scanat. Folosita de ruta `POST /api/v1/audits/:auditId/page-check`.
 *
 * O pagina "exista" daca, dupa redirectionari, serverul raspunde cu succes (cod 2xx) si
 * trimite o pagina web (HTML). Altfel intoarcem motivul, cu un mesaj pentru utilizator:
 * nu exista (404/410), eroare a serverului, nu e pagina web (ex. PDF), nu raspunde, prea multe
 * redirectionari, adresa nesigura sau redirectionare in afara site-ului auditat.
 *
 * Securitate (protectie SSRF): serverul nostru face o cerere spre o adresa data de utilizator,
 * deci fiecare pas trece prin paznic (`checkUrl`), inclusiv fiecare redirectionare (le urmam
 * noi, una cate una). In plus, adresa IP e verificata CHIAR in momentul conectarii (`lookup`):
 * altfel un domeniu care isi schimba raspunsul DNS intre verificare si conectare ar putea
 * trimite cererea spre o retea interna.
 *
 * Cererea e HEAD (doar antetele, fara continutul paginii); daca serverul nu o accepta (405 /
 * 501), repetam cu GET si inchidem conexiunea imediat dupa antete.
 */
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import type { PageCheck } from '@ro-a11y/shared';
import { checkUrl, isBlockedIp, systemResolver, type UrlGuardOptions } from './url-guard';

/** Cate redirectionari urmam, cel mult. */
export const MAX_PAGE_CHECK_REDIRECTS = 5;

/** Cum se prezinta cererea (fara date de contact: e o simpla verificare). */
const USER_AGENT = 'W4A-verificare-pagina/0.1 (audit de accesibilitate)';

export interface PageCheckOptions {
  guard: UrlGuardOptions;
  /** Limita de timp pentru toata verificarea (toate redirectionarile), in milisecunde. */
  timeoutMs: number;
  /** Adresa face parte din site-ul auditat? (verificat la fiecare redirectionare) */
  inScope: (url: string) => boolean;
}

interface Head {
  status: number;
  location: string | null;
  contentType: string | null;
}

class BlockedAddressError extends Error {}

function fail(code: Extract<PageCheck, { exists: false }>['code'], message: string): PageCheck {
  return { exists: false, code, message };
}

/**
 * Rezolvarea DNS folosita la conectare: aceeasi ca a paznicului, dar refuza conexiunea daca
 * oricare adresa e interna sau rezervata (ca `checkUrl`).
 */
function guardedLookup(guard: UrlGuardOptions): LookupFunction {
  return (hostname, options, callback) => {
    (guard.resolve ?? systemResolver)(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some(isBlockedIp)) {
          callback(new BlockedAddressError(hostname), '', 4);
          return;
        }
        if (options.all) {
          callback(
            null,
            addresses.map((address) => ({ address, family: isIP(address) })),
          );
        } else {
          callback(null, addresses[0]!, isIP(addresses[0]!));
        }
      },
      (err: NodeJS.ErrnoException) => callback(err, '', 4),
    );
  };
}

/** O singura cerere (fara redirectionari automate): doar codul si antetele raspunsului. */
function requestHead(
  url: URL,
  method: 'HEAD' | 'GET',
  guard: UrlGuardOptions,
  timeoutMs: number,
): Promise<Head> {
  const local = guard.allowedLocalOrigins?.includes(url.origin) ?? false;
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*' },
        // Originile locale permise explicit (site-ul de antrenament) nu trec prin verificarea IP
        ...(local ? {} : { lookup: guardedLookup(guard) }),
        timeout: timeoutMs,
      },
      (res: IncomingMessage) => {
        resolve({
          status: res.statusCode ?? 0,
          location: res.headers.location ?? null,
          contentType: res.headers['content-type'] ?? null,
        });
        // Nu avem nevoie de continut: inchidem conexiunea
        res.destroy();
      },
    );
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

function isHtml(contentType: string | null): boolean {
  // Fara tip declarat, lasam scanarea sa decida (browserul il ghiceste)
  if (!contentType) return true;
  const type = contentType.split(';')[0]!.trim().toLowerCase();
  return type === 'text/html' || type === 'application/xhtml+xml';
}

/** Verifica pagina, urmand redirectionarile pas cu pas. */
export async function checkPage(start: string, options: PageCheckOptions): Promise<PageCheck> {
  const deadline = Date.now() + options.timeoutMs;
  const seconds = Math.round(options.timeoutMs / 1000);
  let current = start;

  for (let hop = 0; hop <= MAX_PAGE_CHECK_REDIRECTS; hop++) {
    // Intai: e tot pe site-ul auditat? (fara nicio cerere DNS spre alte domenii)
    if (!options.inScope(current)) {
      return fail(
        'OUTSIDE_SITE',
        `Adresa redirecționează în afara site-ului auditat (spre ${new URL(current).origin}).`,
      );
    }
    const check = await checkUrl(current, options.guard);
    if (!check.ok) return fail('UNSAFE_URL', check.message);

    let head: Head;
    try {
      const left = Math.max(1, deadline - Date.now());
      head = await requestHead(check.url, 'HEAD', options.guard, left);
      // Unele servere nu accepta HEAD: repetam cu GET (oprit dupa antete)
      if (head.status === 405 || head.status === 501) {
        head = await requestHead(
          check.url,
          'GET',
          options.guard,
          Math.max(1, deadline - Date.now()),
        );
      }
    } catch (err) {
      if (err instanceof BlockedAddressError) {
        return fail(
          'UNSAFE_URL',
          'Adresa duce către o rețea internă sau rezervată și nu poate fi scanată.',
        );
      }
      if (err instanceof Error && err.message === 'TIMEOUT') {
        return fail('TIMEOUT', `Pagina nu a răspuns în ${seconds} secunde.`);
      }
      return fail('UNREACHABLE', 'Pagina nu a putut fi accesată (serverul nu răspunde).');
    }

    if (head.status >= 300 && head.status < 400 && head.location) {
      current = new URL(head.location, check.url).toString();
      continue;
    }
    if (head.status === 404 || head.status === 410) {
      return fail('NOT_FOUND', `Pagina nu există pe site (serverul a răspuns cu ${head.status}).`);
    }
    if (head.status < 200 || head.status >= 300) {
      return fail(
        'HTTP_ERROR',
        `Serverul a răspuns cu codul ${head.status}; pagina nu poate fi scanată acum.`,
      );
    }
    if (!isHtml(head.contentType)) {
      return fail(
        'NOT_HTML',
        `Adresa nu duce la o pagină web (tip: ${head.contentType!.split(';')[0]}).`,
      );
    }
    check.url.hash = '';
    const url = check.url.toString();
    return { exists: true, url, redirected: hop > 0 };
  }
  return fail('TOO_MANY_REDIRECTS', 'Adresa face prea multe redirecționări.');
}
