/**
 * Serverul minimal care serveste site-urile de antrenament (fara sa-l porneasca).
 * Il porneste `server.ts` (pe portul 4000) sau testele scannerului (pe un port liber).
 *
 *   /             → pagina cu legaturi catre cele doua site-uri
 *   /accessible/  → accessible-demo (varianta corecta)
 *   /broken/      → broken-demo (varianta cu probleme intentionate)
 *   /assets/...   → imaginile comune (shared-assets)
 *   /robots.txt   → regulile pentru programe automate (interzice zona /admin/ a celor doua site-uri)
 *   /sitemap.xml  → lista paginilor; contine si o pagina care nu apare in meniu
 *                   (declaratia de accesibilitate), ca descoperirea prin sitemap sa poata fi testata
 *
 * Foloseste doar modulele incluse in Node.js (fara biblioteci externe). Nu serveste niciun
 * fisier din afara folderelor de mai sus (protectie impotriva "../" in adresa).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = import.meta.dirname;

/** Prefixul din adresa → folderul de pe disc. */
const MOUNTS: Record<string, string> = {
  '/accessible/': resolve(ROOT, 'accessible-demo'),
  '/broken/': resolve(ROOT, 'broken-demo'),
  '/assets/': resolve(ROOT, 'shared-assets'),
};

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const INDEX_PAGE = `<!doctype html>
<html lang="ro">
  <head><meta charset="UTF-8" /><title>Site-uri de antrenament</title></head>
  <body>
    <main>
      <h1>Site-uri de antrenament W4A</h1>
      <ul>
        <li><a href="/accessible/">Varianta accesibilă</a></li>
        <li><a href="/broken/">Varianta cu probleme intenționate</a></li>
      </ul>
    </main>
  </body>
</html>`;

/** Paginile celor doua site-uri, asa cum apar in sitemap.xml. */
const SITEMAP_PAGES = [
  'index.html',
  'anunturi.html',
  'contact.html',
  'servicii/taxe-locale.html',
  'servicii/stare-civila.html',
  'declaratie-accesibilitate.html',
];

const ROBOTS_TXT = `# Site-uri de antrenament W4A
User-agent: *
Disallow: /broken/admin/
Disallow: /accessible/admin/

Sitemap: {origin}/sitemap.xml
`;

/** Sitemap-ul, cu adresele complete (portul difera intre dezvoltare si teste). */
function sitemapXml(origin: string): string {
  const urls = ['/broken/', '/accessible/']
    .flatMap((site) =>
      SITEMAP_PAGES.map((page) => `${origin}${site}${page === 'index.html' ? '' : page}`),
    )
    .map((loc) => `  <url><loc>${loc}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** Transforma adresa ceruta intr-o cale de fisier sigura, sau null daca nu e permisa. */
export function resolveFixturePath(urlPath: string): string | null {
  const mount = Object.keys(MOUNTS).find((prefix) => urlPath.startsWith(prefix));
  if (!mount) return null;

  const baseDir = MOUNTS[mount]!;
  let relative = decodeURIComponent(urlPath.slice(mount.length));
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';

  const filePath = normalize(join(baseDir, relative));
  // Refuza orice incercare de a iesi din folder (ex. /broken/../../.env)
  if (!filePath.startsWith(baseDir + sep)) return null;
  return filePath;
}

export function createFixturesServer() {
  return createServer(async (req, res) => {
    const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;

    const origin = `http://${req.headers.host ?? 'localhost'}`;
    if (urlPath === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(ROBOTS_TXT.replace('{origin}', origin));
      return;
    }
    if (urlPath === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(sitemapXml(origin));
      return;
    }

    if (urlPath === '/') {
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.html'] });
      res.end(INDEX_PAGE);
      return;
    }

    // /accessible si /broken fara "/" la final → redirectionare, ca legaturile relative sa mearga
    if (`${urlPath}/` in MOUNTS) {
      res.writeHead(301, { Location: `${urlPath}/` });
      res.end();
      return;
    }

    const filePath = resolveFixturePath(urlPath);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Pagina nu există.');
      return;
    }

    try {
      const body = await readFile(filePath);
      const type = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Pagina nu există.');
    }
  });
}
