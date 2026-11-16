/**
 * Teste pentru verificarea unei pagini adaugate manual intr-un audit (inainte de a o pune in
 * lista): un server HTTP local raspunde cu toate cazurile posibile (pagina, 404, 410, PDF,
 * redirectionari, bucla, eroare, server fara HEAD, server care nu raspunde).
 *
 * Partea de securitate: o adresa care trece de paznic la verificare, dar al carei DNS raspunde
 * apoi, la conectare, cu o adresa interna, e oprita chiar la conectare.
 */
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pageCheckSchema, type Discovery } from '@ro-a11y/shared';
import { claimNextDiscovery, saveDiscovery } from '../src/audits/queue';
import { checkPage } from '../src/safety/page-check';
import { createTestApp } from './helpers/test-app';
import { resetDatabase, testDb } from './helpers/test-db';

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const html = { 'content-type': 'text/html; charset=utf-8' };
    switch (req.url) {
      case '/':
      case '/exista':
        res.writeHead(200, html).end('<!doctype html><title>x</title>');
        return;
      case '/lipsa':
        res.writeHead(404, html).end('nu exista');
        return;
      case '/disparuta':
        res.writeHead(410, html).end();
        return;
      case '/hotarare':
        res.writeHead(200, { 'content-type': 'application/pdf' }).end('%PDF');
        return;
      case '/mutata':
        res.writeHead(301, { location: '/exista' }).end();
        return;
      case '/afara':
        res.writeHead(302, { location: 'https://alt-site.ro/' }).end();
        return;
      case '/bucla':
        res.writeHead(302, { location: '/bucla' }).end();
        return;
      case '/eroare':
        res.writeHead(500, html).end();
        return;
      case '/fara-head':
        res.writeHead(req.method === 'HEAD' ? 405 : 200, html).end();
        return;
      case '/lenta':
        return; // nu raspunde niciodata
      default:
        res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  server.close();
  await testDb.$disconnect();
});

beforeEach(resetDatabase);

function discoveryFixture(): Discovery {
  return {
    finalUrl: `${origin}/`,
    scope: `${origin}/`,
    linksFound: 1,
    pages: [
      {
        url: `${origin}/`,
        label: 'Pagina de start',
        section: null,
        region: 'nav',
        proposed: true,
        selected: false,
        robotsBlocked: false,
        reasons: ['start'],
      },
    ],
    external: [],
    documents: [],
    excluded: {},
    robots: { found: false, blocked: 0 },
    sitemap: { found: false, urls: 0 },
  };
}

describe('POST /api/v1/audits/:auditId/page-check', () => {
  const app = () => createTestApp({ db: testDb, guardOptions: { allowedLocalOrigins: [origin] } });

  async function auditAwaitingSelection() {
    const project = await testDb.project.create({ data: { name: 'Local', baseUrl: `${origin}/` } });
    const created = await request(app()).post(`/api/v1/projects/${project.id}/audits`).send({});
    const claimed = await claimNextDiscovery(testDb);
    await saveDiscovery(testDb, claimed!.id, discoveryFixture());
    return created.body.id as string;
  }

  async function check(auditId: string, path: string) {
    const res = await request(app())
      .post(`/api/v1/audits/${auditId}/page-check`)
      .send({ url: `${origin}${path}` });
    expect(res.status).toBe(200);
    return pageCheckSchema.parse(res.body);
  }

  it('o pagina existenta e acceptata; o redirectionare pe site da adresa finala', async () => {
    const auditId = await auditAwaitingSelection();
    expect(await check(auditId, '/exista')).toEqual({
      exists: true,
      url: `${origin}/exista`,
      redirected: false,
    });
    expect(await check(auditId, '/mutata')).toEqual({
      exists: true,
      url: `${origin}/exista`,
      redirected: true,
    });
    // Un server care nu accepta HEAD e intrebat din nou, cu GET
    expect(await check(auditId, '/fara-head')).toMatchObject({ exists: true });
  });

  it('respinge, cu motivul, paginile care nu pot fi scanate', async () => {
    const auditId = await auditAwaitingSelection();
    expect(await check(auditId, '/lipsa')).toMatchObject({ exists: false, code: 'NOT_FOUND' });
    expect(await check(auditId, '/disparuta')).toMatchObject({ code: 'NOT_FOUND' });
    expect(await check(auditId, '/eroare')).toMatchObject({
      code: 'HTTP_ERROR',
      message: expect.stringContaining('500'),
    });
    expect(await check(auditId, '/hotarare')).toMatchObject({
      code: 'NOT_HTML',
      message: expect.stringContaining('application/pdf'),
    });
    expect(await check(auditId, '/afara')).toMatchObject({ code: 'OUTSIDE_SITE' });
    expect(await check(auditId, '/bucla')).toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
  });

  it('o adresa de pe alt site sau un document e respinsa inainte de orice cerere (400)', async () => {
    const auditId = await auditAwaitingSelection();
    const other = await request(app())
      .post(`/api/v1/audits/${auditId}/page-check`)
      .send({ url: 'https://alt-site.ro/pagina' });
    expect(other.status).toBe(400);
    expect(other.body.error.code).toBe('PAGE_NOT_IN_AUDIT');
    const doc = await request(app())
      .post(`/api/v1/audits/${auditId}/page-check`)
      .send({ url: `${origin}/decizie.pdf` });
    expect(doc.status).toBe(400);
  });

  it('404 pentru un audit inexistent; 409 dupa ce paginile au fost alese', async () => {
    const missing = await request(app())
      .post('/api/v1/audits/00000000-0000-4000-8000-000000000000/page-check')
      .send({ url: `${origin}/exista` });
    expect(missing.status).toBe(404);

    const auditId = await auditAwaitingSelection();
    await request(app())
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [`${origin}/`] });
    const late = await request(app())
      .post(`/api/v1/audits/${auditId}/page-check`)
      .send({ url: `${origin}/exista` });
    expect(late.status).toBe(409);
  });
});

describe('checkPage (fara ruta)', () => {
  it('un server care nu raspunde e oprit la limita de timp', async () => {
    const result = await checkPage(`${origin}/lenta`, {
      guard: { allowedLocalOrigins: [origin] },
      timeoutMs: 300,
      inScope: () => true,
    });
    expect(result).toMatchObject({ exists: false, code: 'TIMEOUT' });
  });

  it('DNS care se schimba intre verificare si conectare: oprit chiar la conectare', async () => {
    // La verificare (paznicul) domeniul pare public; la conectare raspunde cu o adresa interna
    let calls = 0;
    const port = new URL(origin).port;
    const result = await checkPage(`http://schimbator.test:${port}/exista`, {
      guard: { resolve: async () => (calls++ === 0 ? ['93.184.216.34'] : ['127.0.0.1']) },
      timeoutMs: 2000,
      inScope: () => true,
    });
    expect(calls).toBe(2);
    expect(result).toMatchObject({ exists: false, code: 'UNSAFE_URL' });
  });
});
