/**
 * Server minimal care servește site-urile de antrenament pe http://localhost:4000.
 *
 *   /             → pagină cu legături către cele două site-uri
 *   /accessible/  → accessible-demo (varianta corectă)
 *   /broken/      → broken-demo (varianta cu probleme intenționate)
 *   /assets/...   → imaginile comune (shared-assets)
 *
 * Folosește doar modulele incluse în Node.js (fără biblioteci externe). Nu servește niciun
 * fișier din afara folderelor de mai sus (protecție împotriva „../” în adresă).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const PORT = Number(process.env.FIXTURES_PORT ?? 4000);
const ROOT = import.meta.dirname;

/** Prefixul din adresă → folderul de pe disc. */
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
      <h1>Site-uri de antrenament RO-A11y</h1>
      <ul>
        <li><a href="/accessible/">Varianta accesibilă</a></li>
        <li><a href="/broken/">Varianta cu probleme intenționate</a></li>
      </ul>
    </main>
  </body>
</html>`;

/** Transformă adresa cerută într-o cale de fișier sigură, sau null dacă nu e permisă. */
export function resolveFixturePath(urlPath: string): string | null {
  const mount = Object.keys(MOUNTS).find((prefix) => urlPath.startsWith(prefix));
  if (!mount) return null;

  const baseDir = MOUNTS[mount]!;
  let relative = decodeURIComponent(urlPath.slice(mount.length));
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';

  const filePath = normalize(join(baseDir, relative));
  // Refuză orice încercare de a ieși din folder (ex. /broken/../../.env)
  if (!filePath.startsWith(baseDir + sep)) return null;
  return filePath;
}

const server = createServer(async (req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (urlPath === '/') {
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.html'] });
    res.end(INDEX_PAGE);
    return;
  }

  // /accessible și /broken fără „/” la final → redirecționare, ca legăturile relative să meargă
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

server.listen(PORT, () => {
  console.log(`Site-uri de antrenament pornite pe http://localhost:${PORT}`);
  console.log(`  accesibil:   http://localhost:${PORT}/accessible/`);
  console.log(`  cu probleme: http://localhost:${PORT}/broken/`);
});
