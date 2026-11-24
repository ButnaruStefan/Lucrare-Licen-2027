/**
 * Teste pentru verificarea manuala (pe baza de date de test). Scanarile sunt terminate direct,
 * prin `completeScan`, cu ce contine pagina (page_facts) dat de test:
 *   - cele 6 verificari, cu pasii, criteriile WCAG si sursele W3C; "nu se aplica" detectat doar
 *     din ce contine pagina (fara imagini, fara campuri de formular);
 *   - salvarea unui rezultat (cine, note, versiunea pasilor), modificarea si stergerea lui;
 *   - validarea ("Nu trece" cere note, numele e obligatoriu) si erorile (404);
 *   - progresul apare in scanare si pe paginile auditului; lipseste la scanarile doar de aspect;
 *   - rezultatele se sterg odata cu scanarea.
 */
import request from 'supertest';
import type { AxeResults } from 'axe-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  auditSchema,
  manualEvaluationSchema,
  scanConfigSchema,
  scanManualChecksSchema,
  scanSchema,
  type PageFacts,
  type ScanChecks,
} from '@ro-a11y/shared';
import { MANUAL_CHECKS_VERSION } from '@ro-a11y/catalog';
import { completeScan } from '../src/scans/queue';
import { createTestApp } from './helpers/test-app';
import { resetDatabase, testDb } from './helpers/test-db';

const app = createTestApp({ db: testDb });

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

/** O pagina de articol: 3 imagini, niciun formular, doua titluri. */
const ARTICLE: PageFacts = {
  images: 3,
  forms: 0,
  formFields: 0,
  headings: [
    { level: 1, text: 'Primăria Valea Verde', hidden: false },
    { level: 2, text: 'Anunțuri', hidden: false },
  ],
  headingsTruncated: false,
};

const RAW = { testEngine: { version: '4.13.0' } } as unknown as AxeResults;

async function createScan(
  options: {
    facts?: PageFacts | null;
    checks?: ScanChecks;
    auditId?: string;
    projectId?: string;
  } = {},
) {
  const projectId =
    options.projectId ??
    (await testDb.project.create({ data: { name: 'Site', baseUrl: 'https://exemplu.ro/' } })).id;
  const checks = options.checks ?? { accessibility: true, layout: false };
  const scan = await testDb.scan.create({
    data: {
      projectId,
      auditId: options.auditId ?? null,
      pageUrl: 'https://exemplu.ro/',
      config: scanConfigSchema.parse({ checks }),
    },
  });
  await completeScan(testDb, scan.id, {
    raw: checks.accessibility ? RAW : null,
    results: [],
    pageFacts: options.facts === undefined ? ARTICLE : options.facts,
    layout: checks.layout ? { result: null, error: 'test' } : null,
    finalUrl: 'https://exemplu.ro/',
    httpStatus: 200,
    engineVersion: checks.accessibility ? '4.13.0' : null,
    browserVersion: 'Chrome 155',
  });
  return scan;
}

const url = (scanId: string, checkId?: string) =>
  `/api/v1/scans/${scanId}/manual-checks${checkId ? `/${checkId}` : ''}`;

describe('GET /api/v1/scans/:scanId/manual-checks', () => {
  it('cele 6 verificari, cu pasi, criterii si surse; "nu se aplica" doar unde pagina nu are ce verifica', async () => {
    const scan = await createScan();

    const res = await request(app).get(url(scan.id));

    expect(res.status).toBe(200);
    const body = scanManualChecksSchema.parse(res.body);
    expect(body.checksVersion).toBe(MANUAL_CHECKS_VERSION);
    expect(body.facts).toEqual(ARTICLE);
    expect(body.checks.map((c) => [c.id, c.status])).toEqual([
      ['tastatura', 'pending'],
      ['focus', 'pending'],
      ['text-alternativ', 'pending'], // pagina are imagini
      ['erori-formulare', 'auto_not_applicable'], // pagina nu are campuri de formular
      ['zoom-reflow', 'pending'],
      ['titluri', 'pending'],
    ]);
    const forms = body.checks.find((c) => c.id === 'erori-formulare')!;
    expect(forms.autoNotApplicable).toMatch(/nu are câmpuri de formular/);
    const keyboard = body.checks[0]!;
    expect(keyboard.criteria.map((c) => c.number)).toEqual(['2.1.1', '2.1.2']);
    expect(keyboard.steps.length).toBeGreaterThan(2);
    expect(keyboard.sources[0]!.url).toMatch(/^https:\/\/www\.w3\.org\//);
    expect(body.summary).toEqual({
      total: 6,
      completed: 0,
      autoNotApplicable: 1,
      pending: 5,
      failed: 0,
    });
  });

  it('o scanare mai veche, fara date despre pagina: toate raman de facut', async () => {
    const scan = await createScan({ facts: null });

    const body = scanManualChecksSchema.parse((await request(app).get(url(scan.id))).body);

    expect(body.facts).toBeNull();
    expect(body.checks.every((c) => c.status === 'pending')).toBe(true);
  });

  it('nu exista pentru scanarile doar de aspect, neterminate sau inexistente (404)', async () => {
    const layoutOnly = await createScan({ checks: { accessibility: false, layout: true } });
    const res = await request(app).get(url(layoutOnly.id));
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('MANUAL_REVIEW_NOT_AVAILABLE');

    const project = await testDb.project.create({
      data: { name: 'Site', baseUrl: 'https://exemplu.ro/' },
    });
    const queued = await testDb.scan.create({
      data: { projectId: project.id, pageUrl: 'https://exemplu.ro/', config: {} },
    });
    expect((await request(app).get(url(queued.id))).status).toBe(404);
    expect((await request(app).get(url('11111111-1111-4111-8111-111111111111'))).status).toBe(404);
    expect((await request(app).get(url('nu-e-uuid'))).status).toBe(404);
  });
});

describe('salvarea unui rezultat', () => {
  it('salveaza, modifica si sterge rezultatul; progresul se actualizeaza', async () => {
    const scan = await createScan();

    const saved = await request(app)
      .put(url(scan.id, 'tastatura'))
      .send({ result: 'pass', evaluator: '  Ștefan Butnaru ', notes: 'Meniul merge cu Tab.' });
    expect(saved.status).toBe(200);
    expect(manualEvaluationSchema.parse(saved.body)).toMatchObject({
      result: 'pass',
      evaluator: 'Ștefan Butnaru',
      notes: 'Meniul merge cu Tab.',
      checksVersion: MANUAL_CHECKS_VERSION,
    });

    // "Nu se aplica" automat poate fi schimbat de om (ex. formularul apare la clic)
    await request(app)
      .put(url(scan.id, 'erori-formulare'))
      .send({ result: 'fail', evaluator: 'Ștefan', notes: 'Eroarea e doar roșie, fără text.' })
      .expect(200);
    // A doua salvare a aceleiasi verificari o inlocuieste pe prima
    await request(app)
      .put(url(scan.id, 'tastatura'))
      .send({ result: 'cannot_determine', evaluator: 'Ștefan' })
      .expect(200);

    let body = scanManualChecksSchema.parse((await request(app).get(url(scan.id))).body);
    expect(body.checks.find((c) => c.id === 'tastatura')!.status).toBe('cannot_determine');
    expect(body.checks.find((c) => c.id === 'erori-formulare')!).toMatchObject({
      status: 'fail',
      autoNotApplicable: expect.stringMatching(/nu are câmpuri/),
    });
    expect(body.summary).toEqual({
      total: 6,
      completed: 2,
      autoNotApplicable: 0,
      pending: 4,
      failed: 1,
    });
    expect(await testDb.manualEvaluation.count()).toBe(2);

    // Stergerea: verificarea redevine de facut (sau "nu se aplica" automat)
    await request(app).delete(url(scan.id, 'erori-formulare')).expect(204);
    body = scanManualChecksSchema.parse((await request(app).get(url(scan.id))).body);
    expect(body.checks.find((c) => c.id === 'erori-formulare')!.status).toBe('auto_not_applicable');

    // Progresul apare si in scanare
    const scanDto = scanSchema.parse((await request(app).get(`/api/v1/scans/${scan.id}`)).body);
    expect(scanDto.manual).toMatchObject({ completed: 1, autoNotApplicable: 1, pending: 4 });
  });

  it('valideaza: rezultat cunoscut, nume obligatoriu, note obligatorii la "Nu trece"', async () => {
    const scan = await createScan();
    const put = (body: object) => request(app).put(url(scan.id, 'focus')).send(body);

    const noName = await put({ result: 'pass', evaluator: '   ' });
    expect(noName.status).toBe(400);
    expect(apiErrorSchema.parse(noName.body).error.details).toEqual([
      { field: 'evaluator', message: 'Scrie numele celui care a verificat.' },
    ]);

    const failNoNotes = await put({ result: 'fail', evaluator: 'Ștefan' });
    expect(failNoNotes.status).toBe(400);
    expect(apiErrorSchema.parse(failNoNotes.body).error.details).toEqual([
      { field: 'notes', message: 'Descrie pe scurt ce nu merge (în note).' },
    ]);

    expect((await put({ result: 'conform', evaluator: 'Ștefan' })).status).toBe(400);
    expect((await put({ result: 'pass', evaluator: 'x'.repeat(81) })).status).toBe(400);
    expect(
      (await request(app).put(url(scan.id, 'nu-exista')).send({ result: 'pass', evaluator: 'S' }))
        .status,
    ).toBe(404);
    expect(await testDb.manualEvaluation.count()).toBe(0);
  });

  it('rezultatele se sterg odata cu scanarea', async () => {
    const scan = await createScan();
    await request(app)
      .put(url(scan.id, 'titluri'))
      .send({ result: 'pass', evaluator: 'Ștefan' })
      .expect(200);

    await testDb.scan.delete({ where: { id: scan.id } });

    expect(await testDb.manualEvaluation.count()).toBe(0);
  });
});

describe('progresul pe paginile auditului', () => {
  it('fiecare pagina are progresul ei; paginile doar de aspect nu au verificare manuala', async () => {
    const project = await testDb.project.create({
      data: { name: 'Site', baseUrl: 'https://exemplu.ro/' },
    });
    const audit = await testDb.audit.create({
      data: {
        projectId: project.id,
        startUrl: 'https://exemplu.ro/',
        maxPages: 5,
        status: 'scanning',
        config: scanConfigSchema.parse({}),
        catalogVersion: '2026-11-24',
        selectedAt: new Date(),
      },
    });
    const first = await createScan({ projectId: project.id, auditId: audit.id });
    await createScan({
      projectId: project.id,
      auditId: audit.id,
      facts: { ...ARTICLE, images: 0, formFields: 4, forms: 1 },
    });
    await request(app)
      .put(url(first.id, 'tastatura'))
      .send({ result: 'pass', evaluator: 'Ștefan' })
      .expect(200);

    const res = await request(app).get(`/api/v1/audits/${audit.id}`);

    expect(res.status).toBe(200);
    const pages = auditSchema.parse(res.body).pages;
    expect(pages.map((p) => p.manual)).toEqual([
      { total: 6, completed: 1, autoNotApplicable: 1, pending: 4, failed: 0 },
      // A doua pagina: are formular, nu are imagini
      { total: 6, completed: 0, autoNotApplicable: 1, pending: 5, failed: 0 },
    ]);
  });
});
