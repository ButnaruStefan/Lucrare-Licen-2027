/**
 * Descoperirea paginilor unui site, pentru un audit pe mai multe pagini.
 *
 * Pasii:
 *   1. deschide pagina de start in browser, cu aceleasi protectii ca scannerul
 *      (`openGuardedPage`: paznic SSRF pe fiecare cerere, redirectionari verificate);
 *   2. citeste toate linkurile, inclusiv cele din meniurile derulante (exista in pagina chiar
 *      daca sunt ascunse pana la hover), si pentru fiecare: textul, zona (meniu, antet,
 *      continut, subsol) si meniul din care face parte (ex. "Consiliul local");
 *   3. citeste robots.txt (regulile site-ului pentru programe automate) si sitemap.xml
 *      (lista de pagini publicata de site), cu verificarea paznicului pentru fiecare adresa;
 *   4. clasifica linkurile (`links.ts`): pagini candidate, servicii externe, documente, excluse;
 *   5. propune esantionul (`sample.ts`) doar din paginile permise de robots.txt. Paginile
 *      interzise raman in lista, marcate si nebifate: doar utilizatorul le poate alege, constient.
 *
 * Nu merge din link in link (nu e un crawler): citeste doar pagina de start si sitemap-ul.
 * Nu scrie in baza de date: returneaza rezultatul, salvat de `audits/process-discovery.ts`.
 */
import type { Browser, BrowserContext } from 'playwright';
import type {
  Discovery,
  DiscoveredPage,
  DocumentLink,
  ExclusionReason,
  ExternalService,
  LinkRegion,
  ScanConfig,
} from '@ro-a11y/shared';
import type { RequestGuard } from '../safety/url-guard';
import { openGuardedPage, type PageFailure } from '../scanner/page-scan';
import { classifyLink, dedupeKey, normalizePageUrl, scopeFor, scopeLabel } from './links';
import { NO_ROBOTS_RULES, parseRobots, type RobotsRules } from './robots';
import { MAX_SITEMAP_URLS, parseSitemap } from './sitemap';
import { proposeSample, type CandidatePage } from './sample';

/** Pagina candidata, cu informatia din robots.txt. */
interface Candidate extends CandidatePage {
  robotsBlocked: boolean;
}

/** Cate pagini candidate pastram, cel mult (restul apar doar ca numar, la "excluse"). */
export const MAX_CANDIDATES = 300;
/** Cate servicii externe si cate documente listam, cel mult. */
const MAX_EXTERNAL = 50;
const MAX_DOCUMENTS = 200;
/** Cate sitemap-uri citim dintr-un index de sitemap-uri. */
const MAX_CHILD_SITEMAPS = 3;
/** Cat asteptam, cel mult, robots.txt sau un sitemap. */
const FETCH_TIMEOUT_MS = 10_000;
/** Cat de mare poate fi, cel mult, robots.txt sau un sitemap (in octeti). */
const MAX_FETCH_BYTES = 2 * 1024 * 1024;

/** Un link, asa cum il citeste scriptul din pagina. */
interface RawLink {
  href: string;
  text: string;
  region: LinkRegion;
  section: string | null;
}

/**
 * Scriptul rulat IN pagina (de aceea e text, nu cod TypeScript: ruleaza in browser).
 * Pentru fiecare link, meniul din care face parte e textul elementului de pe primul nivel
 * al listei (<li>) in care se afla linkul, in interiorul unui <nav> sau al antetului.
 */
const COLLECT_LINKS_SCRIPT = `(() => {
  const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
  const out = [];
  const anchors = Array.from(document.querySelectorAll('a[href], area[href]')).slice(0, 2000);
  for (const el of anchors) {
    const href = typeof el.href === 'string'
      ? el.href
      : new URL(el.getAttribute('href'), document.baseURI).href;
    let text = clean(el.textContent);
    if (!text) text = clean(el.getAttribute('aria-label') || el.getAttribute('title'));
    if (!text) {
      const img = el.querySelector('img[alt]');
      if (img) text = clean(img.getAttribute('alt'));
    }
    let region = 'other';
    if (el.closest('nav, [role="navigation"]')) region = 'nav';
    else if (el.closest('header, [role="banner"]')) region = 'header';
    else if (el.closest('footer, [role="contentinfo"]')) region = 'footer';
    else if (el.closest('main, [role="main"]')) region = 'main';
    let section = null;
    const container = el.closest('nav, [role="navigation"], header, [role="banner"]');
    if (container) {
      let top = null;
      let node = el.parentElement;
      while (node && node !== container) {
        if (node.tagName === 'LI') top = node;
        node = node.parentElement;
      }
      if (top) {
        const label = top.querySelector(
          ':scope > a, :scope > button, :scope > span, :scope > div > a, :scope > div > button, :scope > div > span'
        );
        if (label) section = clean(label.textContent) || null;
      }
    }
    out.push({
      href,
      text: text.slice(0, 120),
      region,
      section: section ? section.slice(0, 80) : null,
    });
  }
  return out;
})()`;

/** Ce aduce browserul din pagina de start si de pe site (inainte de clasificare). */
interface CollectedData {
  links: RawLink[];
  robotsText: string | null;
  sitemapLocs: string[];
  sitemapFound: boolean;
}

/**
 * Descarca un fisier text mic (robots.txt, sitemap) prin paznic, urmand cel mult 3
 * redirectionari, fiecare verificata. Returneaza null daca fisierul lipseste sau e prea mare.
 */
async function guardedFetchText(
  context: BrowserContext,
  startUrl: string,
  guard: RequestGuard,
): Promise<string | null> {
  let url = startUrl;
  for (let hop = 0; hop <= 3; hop++) {
    const check = await guard(url);
    if (!check.ok) return null;
    try {
      const response = await context.request.get(url, {
        maxRedirects: 0,
        timeout: FETCH_TIMEOUT_MS,
        failOnStatusCode: false,
      });
      const status = response.status();
      const location = response.headers()['location'];
      if (status >= 300 && status < 400 && location) {
        url = new URL(location, url).toString();
        continue;
      }
      if (status !== 200) return null;
      const body = await response.body();
      if (body.length > MAX_FETCH_BYTES) return null;
      return body.toString('utf8');
    } catch {
      return null;
    }
  }
  return null;
}

/** Citeste sitemap-urile (si, pentru un index, primele sitemap-uri din el). */
async function readSitemaps(
  context: BrowserContext,
  sitemapUrls: string[],
  guard: RequestGuard,
): Promise<{ found: boolean; locs: string[] }> {
  const locs: string[] = [];
  let found = false;
  const queue = [...sitemapUrls];
  let childBudget = MAX_CHILD_SITEMAPS;
  while (queue.length > 0 && locs.length < MAX_SITEMAP_URLS) {
    const text = await guardedFetchText(context, queue.shift()!, guard);
    if (!text) continue;
    const parsed = parseSitemap(text);
    if (parsed.locs.length === 0 && !/<(urlset|sitemapindex)[\s>]/i.test(text)) continue;
    found = true;
    if (parsed.kind === 'index') {
      for (const child of parsed.locs.slice(0, childBudget)) queue.push(child);
      childBudget = Math.max(0, childBudget - parsed.locs.length);
    } else {
      locs.push(...parsed.locs.slice(0, MAX_SITEMAP_URLS - locs.length));
    }
  }
  return { found, locs };
}

/** Un nume citibil pentru o pagina din sitemap (nu are text de link): ultimul segment al adresei. */
function labelFromUrl(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const last = segments.at(-1);
  if (!last) return 'Pagina principală';
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // adresa cu caractere codificate gresit: pastram forma originala
  }
  return decoded.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
}

export interface DiscoverOptions {
  maxPages: number;
  /** Samanta pentru alegerea aleatorie (id-ul auditului: aceeasi alegere la fiecare rulare). */
  seed: string;
}

/**
 * Transforma datele aduse de browser in rezultatul descoperirii. Functie "pura", separata
 * de partea cu browserul, ca sa poata fi testata direct.
 */
export function buildDiscovery(
  finalUrl: string,
  data: CollectedData,
  options: DiscoverOptions,
): Discovery {
  const scope = scopeFor(finalUrl);
  const robots: RobotsRules = data.robotsText ? parseRobots(data.robotsText) : NO_ROBOTS_RULES;
  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const exclude = (reason: ExclusionReason) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  };

  const startUrl = normalizePageUrl(new URL(finalUrl));
  const candidates = new Map<string, Candidate>();
  // Pagina de start e mereu prima: utilizatorul a cerut-o explicit
  candidates.set(dedupeKey(startUrl), {
    url: startUrl,
    label: 'Pagina de start',
    section: null,
    region: 'main',
    robotsBlocked: false,
  });
  const external = new Map<string, ExternalService>();
  const documents = new Map<string, DocumentLink>();
  let robotsBlocked = 0;

  const consider = (href: string, label: string, section: string | null, region: LinkRegion) => {
    const result = classifyLink(href, scope, finalUrl);
    switch (result.kind) {
      case 'excluded':
        exclude(result.reason);
        return;
      case 'external':
        if (!external.has(result.origin) && external.size < MAX_EXTERNAL) {
          external.set(result.origin, {
            origin: result.origin,
            url: result.url,
            label: label || result.origin,
          });
        }
        return;
      case 'document':
        if (!documents.has(result.url) && documents.size < MAX_DOCUMENTS) {
          documents.set(result.url, {
            url: result.url,
            label: label || labelFromUrl(result.url),
            extension: result.extension,
          });
        }
        return;
      case 'page': {
        const key = dedupeKey(result.url);
        if (candidates.has(key)) return;
        if (candidates.size >= MAX_CANDIDATES) {
          exclude('limit');
          return;
        }
        const parsed = new URL(result.url);
        const blocked = !robots.isAllowed(`${parsed.pathname}${parsed.search}`);
        if (blocked) robotsBlocked += 1;
        candidates.set(key, {
          url: result.url,
          label: label || labelFromUrl(result.url),
          section,
          region,
          robotsBlocked: blocked,
        });
      }
    }
  };

  for (const link of data.links) consider(link.href, link.text, link.section, link.region);
  for (const loc of data.sitemapLocs) consider(loc, '', null, 'sitemap');

  const pages = [...candidates.values()];
  // Propunerea automata foloseste doar paginile permise de robots.txt
  const proposal = proposeSample(
    startUrl,
    pages.filter((p) => !p.robotsBlocked),
    options.maxPages,
    options.seed,
  );
  const discoveredPages: DiscoveredPage[] = pages.map((page) => ({
    ...page,
    proposed: proposal.has(page.url),
    selected: false,
    reasons: proposal.get(page.url) ?? [],
  }));

  return {
    finalUrl,
    scope: scopeLabel(scope),
    linksFound: data.links.length,
    pages: discoveredPages,
    external: [...external.values()],
    documents: [...documents.values()],
    excluded,
    robots: { found: data.robotsText !== null, blocked: robotsBlocked },
    sitemap: { found: data.sitemapFound, urls: data.sitemapLocs.length },
  };
}

/** Deschide pagina de start si descopera paginile site-ului. */
export async function discoverPages(
  browser: Browser,
  startUrl: string,
  config: ScanConfig,
  guard: RequestGuard,
  options: DiscoverOptions,
): Promise<{ ok: true; discovery: Discovery } | PageFailure> {
  const opened = await openGuardedPage(
    browser,
    startUrl,
    config,
    guard,
    async ({ page, context }): Promise<CollectedData> => {
      const links = await page.evaluate<RawLink[]>(COLLECT_LINKS_SCRIPT);
      const origin = new URL(page.url()).origin;

      const robotsText = await guardedFetchText(context, `${origin}/robots.txt`, guard);
      const robots = robotsText ? parseRobots(robotsText) : NO_ROBOTS_RULES;
      // Sitemap-urile declarate in robots.txt (doar de pe acelasi site), altfel /sitemap.xml
      const declared = robots.sitemaps.filter((url) => {
        try {
          return new URL(url).origin === origin;
        } catch {
          return false;
        }
      });
      const sitemap = await readSitemaps(
        context,
        declared.length > 0 ? declared : [`${origin}/sitemap.xml`],
        guard,
      );
      return { links, robotsText, sitemapLocs: sitemap.locs, sitemapFound: sitemap.found };
    },
  );
  if (!opened.ok) return opened;
  return { ok: true, discovery: buildDiscovery(opened.finalUrl, opened.value, options) };
}
