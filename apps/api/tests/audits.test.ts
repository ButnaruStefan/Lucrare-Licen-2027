/**
 * Teste pentru rutele auditurilor pe mai multe pagini (pe baza de date de test).
 * Worker-ul nu ruleaza aici: descoperirea si rezultatele paginilor sunt salvate direct,
 * cu date de test (`saveDiscovery`, `completeScan`).
 */
import request from 'supertest';
import type { AxeResults } from 'axe-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  auditListSchema,
  auditResultsSchema,
  auditSchema,
  scanListSchema,
  type Discovery,
} from '@ro-a11y/shared';
import { claimNextDiscovery, saveDiscovery } from '../src/audits/queue';
import { claimNextScan, completeScan, failScan } from '../src/scans/queue';
import type { NormalizedRuleResult } from '../src/scanner/normalize';
import { createTestApp } from './helpers/test-app';
import { resetDatabase, testDb } from './helpers/test-db';

const app = createTestApp({
  db: testDb,
  guardOptions: {
    resolve: async (host) => (host === 'intern.exemplu.ro' ? ['10.0.0.1'] : ['93.184.216.34']),
  },
});

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

const SITE = 'https://exemplu.ro/';

async function createProject() {
  return testDb.project.create({ data: { name: 'Site', baseUrl: SITE } });
}

function discoveryFixture(): Discovery {
  const page = (url: string, label: string, proposed: boolean) => ({
    url,
    label,
    section: null,
    region: 'nav' as const,
    proposed,
    selected: false,
    robotsBlocked: false,
    reasons: proposed ? ['section' as const] : [],
  });
  return {
    finalUrl: SITE,
    scope: SITE,
    linksFound: 5,
    pages: [
      { ...page(SITE, 'Pagina de start', true), reasons: ['start'] },
      page(`${SITE}anunturi`, 'Anunțuri', true),
      page(`${SITE}contact`, 'Contact', false),
    ],
    external: [],
    documents: [],
    excluded: {},
    robots: { found: false, blocked: 0 },
    sitemap: { found: false, urls: 0 },
  };
}

/** Un audit cu paginile deja gasite (cum il lasa worker-ul dupa descoperire). */
async function auditAwaitingSelection() {
  const project = await createProject();
  const created = await request(app).post(`/api/v1/projects/${project.id}/audits`).send({});
  const claimed = await claimNextDiscovery(testDb);
  await saveDiscovery(testDb, claimed!.id, discoveryFixture());
  return { project, auditId: created.body.id as string };
}

function rule(
  axeRuleId: string,
  elements: Array<{ target: string; html: string }>,
): NormalizedRuleResult {
  return {
    axeRuleId,
    category: 'violation',
    impact: 'serious',
    title: axeRuleId,
    description: 'test',
    docsUrl: 'https://dequeuniversity.com',
    axeTags: ['wcag2a'],
    wcagCriteria: ['1.1.1'],
    elements: elements.map((e, i) => ({
      cssSelector: [e.target],
      htmlSnippet: e.html,
      failureSummary: null,
      fingerprint: `${axeRuleId}-${e.target}-${i}`,
    })),
  };
}

async function completeNext(results: NormalizedRuleResult[]) {
  const scan = await claimNextScan(testDb);
  await completeScan(testDb, scan!.id, {
    raw: {} as AxeResults,
    results,
    finalUrl: scan!.pageUrl,
    httpStatus: 200,
    engineVersion: '4.13.0',
    browserVersion: 'Chrome test',
  });
  return scan!;
}

describe('POST /api/v1/projects/:projectId/audits', () => {
  it('pune descoperirea in coada (202), implicit de la adresa proiectului, cu 10 pagini', async () => {
    const project = await createProject();
    const res = await request(app).post(`/api/v1/projects/${project.id}/audits`).send({});

    expect(res.status).toBe(202);
    const audit = auditSchema.parse(res.body);
    expect(audit).toMatchObject({
      status: 'discovery_queued',
      startUrl: SITE,
      maxPages: 10,
      discovery: null,
      progress: { total: 0, completed: 0, failed: 0 },
      pages: [],
    });
  });

  it.each([
    [{ maxPages: 21 }, 'maxPages'],
    [{ maxPages: 0 }, 'maxPages'],
    [{ startUrl: 'ftp://exemplu.ro/' }, 'startUrl'],
  ])('respinge date gresite: %j', async (body, field) => {
    const project = await createProject();
    const res = await request(app).post(`/api/v1/projects/${project.id}/audits`).send(body);
    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.details?.[0]?.field).toBe(field);
  });

  it('respinge o pagina de start de pe alt site sau dintr-o retea interna', async () => {
    const project = await createProject();
    const other = await request(app)
      .post(`/api/v1/projects/${project.id}/audits`)
      .send({ startUrl: 'https://alt-site.ro/' });
    expect(other.body.error.code).toBe('PAGE_NOT_IN_PROJECT');

    const internal = await testDb.project.create({
      data: { name: 'Intern', baseUrl: 'https://intern.exemplu.ro/' },
    });
    const unsafe = await request(app).post(`/api/v1/projects/${internal.id}/audits`).send({});
    expect(unsafe.body.error.code).toBe('UNSAFE_URL');
  });

  it('404 pentru un proiect inexistent', async () => {
    const res = await request(app)
      .post('/api/v1/projects/00000000-0000-4000-8000-000000000000/audits')
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('selectia paginilor', () => {
  it('creeaza cate o scanare pentru fiecare pagina aleasa, in ordinea aleasa', async () => {
    const { auditId } = await auditAwaitingSelection();

    const res = await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [`${SITE}contact`, SITE, `${SITE}contact/`] });

    expect(res.status).toBe(200);
    const audit = auditSchema.parse(res.body);
    expect(audit.status).toBe('scanning');
    expect(audit.pages.map((p) => [p.pageUrl, p.status, p.label])).toEqual([
      [`${SITE}contact`, 'queued', 'Contact'],
      [SITE, 'queued', 'Pagina de start'],
    ]);
    expect(audit.discovery!.pages.filter((p) => p.selected).map((p) => p.url)).toEqual([
      SITE,
      `${SITE}contact`,
    ]);
    // "Contact" nu fusese propusa: aleasa de utilizator, motivul ei e "manual"
    expect(audit.pages[0]!.reasons).toEqual(['manual']);
    // Coada le ia in ordinea aleasa
    expect((await claimNextScan(testDb))!.pageUrl).toBe(`${SITE}contact`);
  });

  it('accepta o pagina adaugata manual, de pe acelasi site (motiv: manual)', async () => {
    const { auditId } = await auditAwaitingSelection();
    const res = await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [SITE, `${SITE}pagina-ascunsa`] });

    const audit = auditSchema.parse(res.body);
    expect(audit.pages[1]).toMatchObject({ pageUrl: `${SITE}pagina-ascunsa`, reasons: ['manual'] });
  });

  it.each([
    ['https://alt-site.ro/', 'PAGE_NOT_IN_AUDIT'],
    [`${SITE}hotarare.pdf`, 'PAGE_NOT_IN_AUDIT'],
  ])('respinge %s (%s), cu eroarea pe campul paginii', async (url, code) => {
    const { auditId } = await auditAwaitingSelection();
    const res = await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [SITE, url] });
    expect(res.status).toBe(400);
    const error = apiErrorSchema.parse(res.body).error;
    expect(error.code).toBe(code);
    expect(error.details?.[0]?.field).toBe('urls.1');
  });

  it('respinge o lista goala sau prea lunga', async () => {
    const { auditId } = await auditAwaitingSelection();
    const empty = await request(app).post(`/api/v1/audits/${auditId}/selection`).send({ urls: [] });
    expect(empty.status).toBe(400);
    const tooMany = Array.from({ length: 21 }, (_, i) => `${SITE}p${i}`);
    const long = await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: tooMany });
    expect(long.status).toBe(400);
  });

  it('a doua confirmare e respinsa (409): paginile nu sunt dublate', async () => {
    const { auditId } = await auditAwaitingSelection();
    await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [SITE] });
    const again = await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [SITE] });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('AUDIT_NOT_AWAITING_SELECTION');
    expect(await testDb.scan.count({ where: { auditId } })).toBe(1);
  });

  it('nu se poate alege inainte de descoperire (409)', async () => {
    const project = await createProject();
    const created = await request(app).post(`/api/v1/projects/${project.id}/audits`).send({});
    const res = await request(app)
      .post(`/api/v1/audits/${created.body.id}/selection`)
      .send({ urls: [SITE] });
    expect(res.status).toBe(409);
  });
});

describe('starea si rezultatele auditului', () => {
  it('auditul e "completed" cand nicio pagina nu mai asteapta; progresul numara paginile', async () => {
    const { auditId, project } = await auditAwaitingSelection();
    await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [SITE, `${SITE}anunturi`] });

    await completeNext([]);
    let audit = auditSchema.parse((await request(app).get(`/api/v1/audits/${auditId}`)).body);
    expect(audit.status).toBe('scanning');
    expect(audit.progress).toEqual({ total: 2, completed: 1, failed: 0 });

    const second = await claimNextScan(testDb);
    await failScan(testDb, second!.id, { errorCode: 'HTTP_ERROR', errorMessage: 'Eroare 500' });
    audit = auditSchema.parse((await request(app).get(`/api/v1/audits/${auditId}`)).body);
    expect(audit.status).toBe('completed');
    expect(audit.progress).toEqual({ total: 2, completed: 1, failed: 1 });
    expect(audit.finishedAt).not.toBeNull();
    expect(audit.pages[1]).toMatchObject({ status: 'failed', errorMessage: 'Eroare 500' });

    // Lista proiectului: auditul apare, dar paginile lui nu apar printre scanarile separate
    const list = auditListSchema.parse(
      (await request(app).get(`/api/v1/projects/${project.id}/audits`)).body,
    );
    expect(list.items).toMatchObject([{ id: auditId, status: 'completed', pagesFound: 3 }]);
    const scans = scanListSchema.parse(
      (await request(app).get(`/api/v1/projects/${project.id}/scans`)).body,
    );
    expect(scans.items).toEqual([]);
  });

  it('aduna regulile de pe toate paginile si gaseste problemele comune (acelasi element)', async () => {
    const { auditId } = await auditAwaitingSelection();
    await request(app)
      .post(`/api/v1/audits/${auditId}/selection`)
      .send({ urls: [SITE, `${SITE}anunturi`, `${SITE}contact`] });

    const footerLink = { target: 'a.social', html: '<a href="#" class="social"></a>' };
    await completeNext([
      rule('link-name', [footerLink]),
      rule('image-alt', [{ target: 'img.hero', html: '<img class="hero">' }]),
    ]);
    await completeNext([rule('link-name', [footerLink])]);
    await completeNext([
      rule('link-name', [footerLink, { target: 'a.icon', html: '<a class="icon"></a>' }]),
    ]);

    const res = await request(app).get(`/api/v1/audits/${auditId}/results`);
    expect(res.status).toBe(200);
    const results = auditResultsSchema.parse(res.body);

    expect(results.pagesScanned).toBe(3);
    expect(results.rules.map((r) => [r.axeRuleId, r.pages.length, r.elementCount])).toEqual([
      ['link-name', 3, 4],
      ['image-alt', 1, 1],
    ]);
    expect(results.rules[0]!.titleRo).toBeTruthy();
    expect(results.commonIssues).toHaveLength(1);
    expect(results.commonIssues[0]).toMatchObject({
      axeRuleId: 'link-name',
      htmlSnippet: footerLink.html,
    });
    expect(results.commonIssues[0]!.pages).toHaveLength(3);
  });

  it('404 pentru un audit inexistent sau un id gresit', async () => {
    for (const id of ['nu-e-uuid', '00000000-0000-4000-8000-000000000000']) {
      expect((await request(app).get(`/api/v1/audits/${id}`)).status).toBe(404);
      expect((await request(app).get(`/api/v1/audits/${id}/results`)).status).toBe(404);
    }
  });
});
