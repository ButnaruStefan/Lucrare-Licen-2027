/**
 * Serverul minimal care serveste site-urile de antrenament (fara sa-l porneasca).
 * Il porneste `server.ts` (pe portul 4000) sau testele scannerului (pe un port liber).
 *
 *   /             → pagina cu legaturi catre cele doua site-uri
 *   /accessible/  → accessible-demo (varianta corecta)
 *   /broken/      → broken-demo (varianta cu probleme intentionate)
 *   /assets/...   → imaginile comune (shared-assets)
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
