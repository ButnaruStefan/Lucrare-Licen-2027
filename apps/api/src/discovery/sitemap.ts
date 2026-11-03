/**
 * Citirea unui sitemap.xml: lista de pagini pe care un site o publica pentru motoarele de cautare.
 *
 * Ajuta la descoperirea paginilor pe care meniul nu le arata direct (ex. meniuri construite
 * din JavaScript abia dupa un click). Un sitemap poate fi:
 *   - o lista de pagini (<urlset> cu <url><loc>...</loc></url>);
 *   - un index de alte sitemap-uri (<sitemapindex> cu <sitemap><loc>...</loc></sitemap>).
 *
 * Citim doar elementele <loc>; nu e nevoie de un parser XML complet. Functie "pura".
 */

/** Cate adrese pastram, cel mult, dintr-un sitemap (unele site-uri au zeci de mii). */
export const MAX_SITEMAP_URLS = 1000;

export interface ParsedSitemap {
  kind: 'urlset' | 'index';
  locs: string[];
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function parseSitemap(xml: string): ParsedSitemap {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? 'index' : 'urlset';
  const locs: string[] = [];
  const pattern = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;
  for (const match of xml.matchAll(pattern)) {
    locs.push(decodeXmlEntities(match[1]!));
    if (locs.length >= MAX_SITEMAP_URLS) break;
  }
  return { kind, locs };
}
