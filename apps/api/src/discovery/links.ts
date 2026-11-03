/**
 * Clasificarea linkurilor gasite pe pagina de start a unui audit.
 *
 * Pentru fiecare link decide ce este:
 *   - "page": o pagina a aceluiasi site, in sectiunea auditata (devine pagina candidata);
 *   - "external": alt site (ex. un portal de plati); il listam, dar nu il scanam;
 *   - "document": un fisier PDF, Word, Excel (axe-core nu il poate verifica; il listam separat);
 *   - "excluded": orice altceva, cu motivul (mailto:, imagine, iesire din cont, ancora etc.).
 *
 * Adresele paginilor sunt aduse la o forma unica (fara #, fara parametri de urmarire de tip
 * utm_*), ca aceeasi pagina sa nu apara de doua ori in lista.
 *
 * Functii "pure" (fara browser, fara retea): folosite de `discover.ts` si testate separat.
 */
import type { ExclusionReason } from '@ro-a11y/shared';

/** Fisiere-document, relevante pentru OUG 112/2018, dar neverificabile de axe-core. */
const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'odt',
  'rtf',
  'xls',
  'xlsx',
  'ods',
  'csv',
  'ppt',
  'pptx',
  'odp',
  'txt',
]);

/** Fisiere care nu sunt pagini web (imagini, arhive, media, cod). */
const FILE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'webp',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'zip',
  'rar',
  '7z',
  'gz',
  'tar',
  'mp3',
  'mp4',
  'm4a',
  'avi',
  'mov',
  'wmv',
  'webm',
  'ogg',
  'wav',
  'exe',
  'msi',
  'dmg',
  'apk',
  'xml',
  'json',
  'css',
  'js',
]);

/**
 * Linkuri cu efecte sau fara continut propriu: iesire din cont, autentificare, cos de
 * cumparaturi, cautare, tiparire. Cuvantul trebuie sa fie o bucata separata a adresei.
 */
const ACTION_WORDS = [
  'logout',
  'log-out',
  'signout',
  'sign-out',
  'deconectare',
  'delogare',
  'iesire',
  'login',
  'signin',
  'sign-in',
  'autentificare',
  'cart',
  'cos',
  'checkout',
  'search',
  'cautare',
  'print',
  'tipareste',
];
const ACTION_PATTERN = new RegExp(`(^|[/_.=?&-])(${ACTION_WORDS.join('|')})([/_.=?&-]|$)`, 'i');

/** Parametri care nu schimba pagina, doar urmaresc vizitatorul. */
const TRACKING_PARAMS = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|_gl)$/i;

/** Sectiunea auditata: acelasi site (domeniu) si adresele care incep cu `pathPrefix`. */
export interface AuditScope {
  protocol: string;
  hostname: string;
  /** Domeniul fara "www.", ca www.site.ro si site.ro sa fie acelasi site. */
  bareHostname: string;
  port: string;
  pathPrefix: string;
}

/**
 * Sectiunea auditata pornind de la pagina de start (dupa redirectionari):
 * https://site.ro/ -> tot site-ul; http://localhost:4000/broken/ -> doar /broken/...
 */
export function scopeFor(startUrl: string): AuditScope {
  const url = new URL(startUrl);
  const lastSlash = url.pathname.lastIndexOf('/');
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    bareHostname: url.hostname.replace(/^www\./, ''),
    port: url.port,
    pathPrefix: url.pathname.slice(0, lastSlash + 1),
  };
}

/** Prefixul afisat utilizatorului, ex. "https://site.ro/" sau "http://localhost:4000/broken/". */
export function scopeLabel(scope: AuditScope): string {
  const port = scope.port ? `:${scope.port}` : '';
  return `${scope.protocol}//${scope.hostname}${port}${scope.pathPrefix}`;
}

/** Forma unica a adresei unei pagini: fara #, fara parametri de urmarire, fara sesiune. */
export function normalizePageUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = '';
  // ";jsessionid=..." in cale (servere Java) identifica sesiunea, nu pagina
  copy.pathname = copy.pathname.replace(/;jsessionid=[^/]*/i, '');
  for (const key of [...copy.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) copy.searchParams.delete(key);
  }
  // "?" ramas gol dupa stergerea parametrilor
  if (copy.search === '?') copy.search = '';
  return copy.toString();
}

/** Cheia folosita la eliminarea dublurilor: /pagina si /pagina/ sunt aceeasi pagina. */
export function dedupeKey(url: string): string {
  const copy = new URL(url);
  if (copy.pathname.length > 1 && copy.pathname.endsWith('/')) {
    copy.pathname = copy.pathname.slice(0, -1);
  }
  return copy.toString();
}

function extensionOf(pathname: string): string | null {
  const lastSegment = pathname.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0) return null;
  return lastSegment.slice(dot + 1).toLowerCase();
}

export type LinkClass =
  | { kind: 'page'; url: string }
  | { kind: 'external'; origin: string; url: string }
  | { kind: 'document'; url: string; extension: string }
  | { kind: 'excluded'; reason: ExclusionReason };

/**
 * Clasifica un link.
 * @param href adresa linkului (absoluta, asa cum o da browserul)
 * @param scope sectiunea auditata
 * @param currentPageUrl pagina pe care a fost gasit linkul (pentru ancorele "#...")
 */
export function classifyLink(href: string, scope: AuditScope, currentPageUrl: string): LinkClass {
  let url: URL;
  try {
    url = new URL(href, currentPageUrl);
  } catch {
    return { kind: 'excluded', reason: 'non_http' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'excluded', reason: 'non_http' };
  }
  if (url.username || url.password) return { kind: 'excluded', reason: 'non_http' };

  const sameSite =
    url.hostname.replace(/^www\./, '') === scope.bareHostname && url.port === scope.port;
  if (!sameSite) {
    url.hash = '';
    return { kind: 'external', origin: url.origin, url: url.toString() };
  }
  // Acelasi site: aducem adresa la forma paginii de start (http/https, cu sau fara www)
  url.protocol = scope.protocol;
  url.hostname = scope.hostname;

  const current = new URL(currentPageUrl);
  current.hash = '';
  const withoutHash = new URL(url.toString());
  withoutHash.hash = '';
  if (url.hash && withoutHash.toString() === current.toString()) {
    return { kind: 'excluded', reason: 'same_page' };
  }

  const extension = extensionOf(url.pathname);
  if (extension && DOCUMENT_EXTENSIONS.has(extension)) {
    return { kind: 'document', url: withoutHash.toString(), extension };
  }
  if (extension && FILE_EXTENSIONS.has(extension)) return { kind: 'excluded', reason: 'file' };

  if (!url.pathname.startsWith(scope.pathPrefix)) {
    return { kind: 'excluded', reason: 'outside_scope' };
  }
  if (ACTION_PATTERN.test(`${url.pathname}${url.search}`)) {
    return { kind: 'excluded', reason: 'action' };
  }
  return { kind: 'page', url: normalizePageUrl(url) };
}
