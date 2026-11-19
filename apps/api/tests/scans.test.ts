/**
 * Teste pentru rutele de scanari (pe baza de date de test). Worker-ul nu ruleaza aici:
 * rezultatele sunt salvate direct, prin `completeScan`, cu date de test.
 */
import request from 'supertest';
import type { AxeResults } from 'axe-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  ruleResultListSchema,
  scanLayoutSchema,
  scanConfigSchema,
  scanListSchema,
  scanSchema,
} from '@ro-a11y/shared';
import { completeScan } from '../src/scans/queue';
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

async function createProject(baseUrl = 'https://exemplu.ro/') {
  return testDb.project.create({ data: { name: 'Site', baseUrl } });
}

describe('POST /api/v1/projects/:projectId/scans', () => {
  it('pune scanarea in coada (202) si scaneaza implicit adresa proiectului', async () => {
    const project = await createProject();

    const res = await request(app).post(`/api/v1/projects/${project.id}/scans`).send({});

    expect(res.status).toBe(202);
    const scan = scanSchema.parse(res.body);
    expect(scan).toMatchObject({ status: 'queued', pageUrl: 'https://exemplu.ro/', summary: null });
    // Versiunea catalogului normativ e fixata la crearea scanarii (normele "inghetate" la data auditului)
    expect(scan.catalogVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(scan.config).toEqual(scanConfigSchema.parse({}));
  });

  it('accepta o alta pagina de pe acelasi site si optiunile de configurare', async () => {
    const project = await createProject();

    const res = await request(app).post(`/api/v1/projects/${project.id}/scans`).send({
      pageUrl: 'https://exemplu.ro/contact',
      wcagProfile: 'WCAG_2_1_AA',
      includeBestPractices: false,
    });

    expect(res.status).toBe(202);
    expect(scanSchema.parse(res.body)).toMatchObject({
      pageUrl: 'https://exemplu.ro/contact',
      config: { wcagProfile: 'WCAG_2_1_AA', includeBestPractices: false },
    });
  });

  it('se poate alege ce se verifica: doar aspectul, ambele; nu nimic (400)', async () => {
    const project = await createProject();
    const url = `/api/v1/projects/${project.id}/scans`;

    const layoutOnly = await request(app)
      .post(url)
      .send({ checks: { accessibility: false, layout: true } });
    expect(layoutOnly.status).toBe(202);
    expect(scanSchema.parse(layoutOnly.body).config.checks).toEqual({
      accessibility: false,
      layout: true,
    });

    const both = await request(app)
      .post(url)
      .send({ checks: { accessibility: true, layout: true } });
    expect(scanSchema.parse(both.body).config.checks).toEqual({
      accessibility: true,
      layout: true,
    });

    const none = await request(app)
      .post(url)
      .send({ checks: { accessibility: false, layout: false } });
    expect(none.status).toBe(400);
    expect(apiErrorSchema.parse(none.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('o scanare veche, fara alegerea verificarilor, a verificat doar accesibilitatea', () => {
    const config = scanConfigSchema.parse({ wcagProfile: 'WCAG_2_1_AA' });
    expect(config.checks).toEqual({ accessibility: true, layout: false });
  });

  it('respinge o pagina de pe alt site (400 PAGE_NOT_IN_PROJECT)', async () => {
    const project = await createProject();

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/scans`)
      .send({ pageUrl: 'https://alt-site.ro/' });

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('PAGE_NOT_IN_PROJECT');
  });

  it('respinge un site care duce spre o retea interna (400 UNSAFE_URL)', async () => {
    const project = await createProject('https://intern.exemplu.ro/');

    const res = await request(app).post(`/api/v1/projects/${project.id}/scans`).send({});

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('UNSAFE_URL');
    expect(await testDb.scan.count()).toBe(0);
  });

  it('raspunde 404 pentru un proiect inexistent', async () => {
    const res = await request(app)
      .post('/api/v1/projects/00000000-0000-4000-8000-000000000000/scans')
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('GET scanari si rezultate', () => {
  const rawStub = { testEngine: { version: '4.13.0' } } as AxeResults;
  const results: NormalizedRuleResult[] = [
    {
      axeRuleId: 'region',
      category: 'violation',
      impact: 'moderate',
      title: 'Continutul trebuie sa fie in repere',
      description: 'd',
      docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/region',
      axeTags: ['cat.keyboard', 'best-practice'],
      wcagCriteria: [],
      elements: [
        {
          cssSelector: ['p'],
          htmlSnippet: '<p>',
          failureSummary: null,
          fingerprint: 'f1',
          box: null,
        },
        {
          cssSelector: ['h1'],
          htmlSnippet: '<h1>',
          failureSummary: null,
          fingerprint: 'f2',
          box: null,
        },
      ],
    },
    {
      axeRuleId: 'image-alt',
      category: 'violation',
      impact: 'critical',
      title: 'Imaginile trebuie sa aiba text alternativ',
      description: 'd',
      docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      axeTags: ['wcag2a', 'wcag111'],
      wcagCriteria: ['1.1.1'],
      elements: [
        {
          cssSelector: ['img'],
          htmlSnippet: '<img>',
          failureSummary: 'x',
          fingerprint: 'f3',
          box: null,
        },
      ],
    },
    {
      axeRuleId: 'document-title',
      category: 'pass',
      impact: null,
      title: 't',
      description: 'd',
      docsUrl: 'u',
      axeTags: ['wcag2a', 'wcag242'],
      wcagCriteria: ['2.4.2'],
      elements: [],
    },
  ];

  async function createCompletedScan() {
    const project = await createProject();
    const scan = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/',
        config: scanConfigSchema.parse({}),
      },
    });
    await completeScan(testDb, scan.id, {
      raw: rawStub,
      results,
      finalUrl: 'https://exemplu.ro/',
      httpStatus: 200,
      engineVersion: '4.13.0',
      browserVersion: 'Chrome 155',
    });
    return { project, scan };
  }

  it('o scanare terminata are versiunile si sumarul pe categorii', async () => {
    const { scan } = await createCompletedScan();

    const res = await request(app).get(`/api/v1/scans/${scan.id}`);

    expect(res.status).toBe(200);
    expect(scanSchema.parse(res.body)).toMatchObject({
      status: 'completed',
      engineName: 'axe-core',
      engineVersion: '4.13.0',
      browserVersion: 'Chrome 155',
      httpStatus: 200,
      summary: {
        violations: 2,
        violationElements: 3,
        incomplete: 0,
        incompleteElements: 0,
        passes: 1,
        inapplicable: 0,
      },
    });
  });

  it('lista scanarilor unui proiect include sumarul', async () => {
    const { project } = await createCompletedScan();

    const res = await request(app).get(`/api/v1/projects/${project.id}/scans`);

    const list = scanListSchema.parse(res.body);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.summary?.violations).toBe(2);
  });

  it('rezultatele sunt ordonate dupa gravitate si pot fi filtrate pe categorie', async () => {
    const { scan } = await createCompletedScan();

    const all = ruleResultListSchema.parse(
      (await request(app).get(`/api/v1/scans/${scan.id}/results`)).body,
    );
    expect(all.items.map((r) => r.axeRuleId)).toEqual(['image-alt', 'region', 'document-title']);
    expect(all.items[1]).toMatchObject({ isBestPractice: true, affectedElements: [{}, {}] });

    // Lantul de trasabilitate: image-alt -> WCAG 1.1.1 -> EN 9.1.1.1 -> OUG 112/2018 art. 3 si 5
    const imageAlt = all.items[0]!.trace;
    expect(imageAlt.wcag.map((w) => w.number)).toEqual(['1.1.1']);
    expect(imageAlt.en).toMatchObject([{ clause: '9.1.1.1' }]);
    expect(imageAlt.legal.map((l) => l.articleRef)).toEqual([
      'art. 3 alin. (2) lit. a)',
      'art. 5 alin. (1)',
    ]);
    expect(imageAlt.remediation?.axeRuleId).toBe('image-alt');
    // O regula trecuta: titlul in romana, dar fara remedierea completa (nu e nimic de reparat)
    const passed = all.items[2]!.trace;
    expect(passed.axeRule.titleRo).toBe('Pagina trebuie să aibă un titlu');
    expect(passed.remediation).toBeNull();
    // O buna practica nu are legatura normativa
    expect(all.items[1]!.trace).toMatchObject({ isBestPractice: true, wcag: [], legal: [] });

    const violations = ruleResultListSchema.parse(
      (await request(app).get(`/api/v1/scans/${scan.id}/results?category=violation`)).body,
    );
    expect(violations.items).toHaveLength(2);
  });

  it('aplicabilitatea din lant vine din profilul juridic al proiectului', async () => {
    const { project, scan } = await createCompletedScan();
    const resultsOf = async () =>
      ruleResultListSchema.parse((await request(app).get(`/api/v1/scans/${scan.id}/results`)).body)
        .items[0]!.trace.applicability;

    expect((await resultsOf()).status).toBe('not_assessed');

    await request(app)
      .put(`/api/v1/projects/${project.id}/legal-profile`)
      .send({ organizationType: 'public_authority', publicBroadcaster: 'no', audience: 'public' })
      .expect(200);

    const applicability = await resultsOf();
    expect(applicability.status).toBe('applicable');
    expect(applicability.assessedAt).not.toBeNull();
  });

  it('harta problemelor: captura si pozitia elementelor, salvate impreuna cu rezultatele', async () => {
    const project = await createProject();
    const scan = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/',
        config: scanConfigSchema.parse({}),
      },
    });
    const image = Buffer.from('imagine-de-test');
    const withBox: NormalizedRuleResult[] = [
      {
        ...results[1]!,
        elements: [{ ...results[1]!.elements[0]!, box: { x: 10, y: 20, width: 300, height: 150 } }],
      },
    ];
    await completeScan(testDb, scan.id, {
      raw: rawStub,
      results: withBox,
      capture: {
        image,
        format: 'webp',
        width: 1366,
        height: 900,
        pageHeight: 900,
        truncated: false,
        boxes: new Map(),
        frameHeight: 900,
        frameOffsets: [0],
        reactiveFrames: 0,
        seams: [],
      },
      finalUrl: 'https://exemplu.ro/',
      httpStatus: 200,
      engineVersion: '4.13.0',
      browserVersion: 'Chrome 155',
    });

    // Scanarea spune dimensiunile capturii si de unde se ia imaginea (nu si imaginea)
    const dto = scanSchema.parse((await request(app).get(`/api/v1/scans/${scan.id}`)).body);
    expect(dto.screenshot).toEqual({
      url: `/api/v1/scans/${scan.id}/screenshot`,
      format: 'webp',
      width: 1366,
      height: 900,
      pageHeight: 900,
      truncated: false,
      frameHeight: 900,
      frameOffsets: [0],
    });
    // Imaginea, pe ruta ei, cu tipul corect si memorata de browser (nu se mai schimba)
    const shot = await request(app).get(`/api/v1/scans/${scan.id}/screenshot`);
    expect(shot.status).toBe(200);
    expect(shot.headers['content-type']).toBe('image/webp');
    expect(shot.headers['x-content-type-options']).toBe('nosniff');
    expect(shot.headers['cache-control']).toContain('immutable');
    expect(Buffer.from(shot.body).equals(image)).toBe(true);
    // Pozitia elementului, in rezultate
    const list = ruleResultListSchema.parse(
      (await request(app).get(`/api/v1/scans/${scan.id}/results`)).body,
    );
    expect(list.items[0]!.affectedElements[0]!.box).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 150,
    });
  });

  it('fara captura: scanarea are screenshot null, iar ruta imaginii raspunde 404', async () => {
    const { scan, project } = await createCompletedScan();
    expect(
      scanSchema.parse((await request(app).get(`/api/v1/scans/${scan.id}`)).body).screenshot,
    ).toBeNull();
    const shot = await request(app).get(`/api/v1/scans/${scan.id}/screenshot`);
    expect(shot.status).toBe(404);
    expect(apiErrorSchema.parse(shot.body).error.code).toBe('SCREENSHOT_NOT_FOUND');
    // In listele de scanari imaginea nu e incarcata niciodata
    const items = scanListSchema.parse(
      (await request(app).get(`/api/v1/projects/${project.id}/scans`)).body,
    ).items;
    expect(items.every((s) => s.screenshot === null)).toBe(true);
  });

  it('stergerea scanarii sterge si captura (cascada)', async () => {
    const { scan } = await createCompletedScan();
    await testDb.scanScreenshot.create({
      data: {
        scanId: scan.id,
        image: new Uint8Array([1, 2, 3]),
        format: 'webp',
        width: 1,
        height: 1,
        pageHeight: 1,
        truncated: false,
      },
    });
    await testDb.scan.delete({ where: { id: scan.id } });
    expect(await testDb.scanScreenshot.count()).toBe(0);
  });

  it('respinge o categorie necunoscuta (400) si o scanare inexistenta (404)', async () => {
    const { scan } = await createCompletedScan();
    expect(
      (await request(app).get(`/api/v1/scans/${scan.id}/results?category=altceva`)).status,
    ).toBe(400);
    expect((await request(app).get('/api/v1/scans/nu-e-uuid')).status).toBe(404);
  });
});

describe('verificarea aspectului paginii', () => {
  async function createLayoutScan(withLayout: boolean) {
    const project = await createProject();
    const scan = await testDb.scan.create({
      data: {
        projectId: project.id,
        pageUrl: 'https://exemplu.ro/',
        config: scanConfigSchema.parse({ checks: { accessibility: false, layout: true } }),
      },
    });
    await completeScan(testDb, scan.id, {
      raw: null,
      results: [],
      layout: withLayout
        ? {
            error: null,
            result: {
              widths: [1400, 1340, 320],
              breakpoints: [
                { feature: 'min-width', px: 768, text: '(min-width: 768px)', source: null },
              ],
              metaViewport: 'width=device-width',
              durationMs: 4200,
              partial: false,
              issues: [
                {
                  kind: 'media-queries-suprapuse',
                  level: 'possible',
                  widthMin: 768,
                  widthMax: 768,
                  elements: [],
                  details: { rules: [{ text: '(max-width: 768px)', source: null }] },
                  fingerprint: 'm1',
                  image: null,
                  boxes: [],
                },
                {
                  kind: 'derulare-orizontala',
                  level: 'visible',
                  widthMin: 320,
                  widthMax: 1160,
                  elements: [{ selector: '#lat', htmlSnippet: '<div id="lat">', text: 'Tabel' }],
                  details: { overflowPx: 400, pageWidth: 1200, edgeX: 800 },
                  fingerprint: 'd1',
                  image: {
                    data: Buffer.from([0xff, 0xd8, 0xff]),
                    format: 'jpeg',
                    width: 1200,
                    height: 150,
                    viewportWidth: 800,
                  },
                  boxes: [{ x: 0, y: 24, width: 1200, height: 100 }],
                },
              ],
            },
          }
        : { result: null, error: 'Pagina s-a inchis' },
      finalUrl: 'https://exemplu.ro/',
      httpStatus: 200,
      engineVersion: null,
      browserVersion: 'Chrome 155',
    });
    return { project, scan };
  }

  it('o scanare doar de aspect: fara axe-core, cu sumarul si semnalele (sigure primele)', async () => {
    const { scan, project } = await createLayoutScan(true);

    const dto = scanSchema.parse((await request(app).get(`/api/v1/scans/${scan.id}`)).body);
    expect(dto.engineName).toBeNull();
    expect(dto.layout).toEqual({ visible: 1, possible: 1, info: 0, failed: false });
    const listed = scanListSchema.parse(
      (await request(app).get(`/api/v1/projects/${project.id}/scans`)).body,
    ).items[0]!;
    expect(listed.layout).toEqual(dto.layout);

    const res = await request(app).get(`/api/v1/scans/${scan.id}/layout`);
    expect(res.status).toBe(200);
    const layout = scanLayoutSchema.parse(res.body);
    expect(layout).toMatchObject({
      widths: [1400, 1340, 320],
      metaViewport: 'width=device-width',
      partial: false,
      error: null,
    });
    expect(layout.issues.map((i) => i.kind)).toEqual([
      'derulare-orizontala',
      'media-queries-suprapuse',
    ]);
    const scroll = layout.issues[0]!;
    expect(scroll.image).toEqual({
      url: `/api/v1/scans/${scan.id}/layout/issues/${scroll.id}/image`,
      width: 1200,
      height: 150,
      viewportWidth: 800,
    });
    expect(layout.issues[1]!.image).toBeNull();

    const image = await request(app).get(scroll.image!.url);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect([...image.body]).toEqual([0xff, 0xd8, 0xff]);

    // Imaginea unui semnal fara captura, sau a unui semnal din alta scanare: 404
    const noImage = await request(app).get(
      `/api/v1/scans/${scan.id}/layout/issues/${layout.issues[1]!.id}/image`,
    );
    expect(noImage.status).toBe(404);
    const other = await createLayoutScan(true);
    const wrongScan = await request(app).get(
      `/api/v1/scans/${other.scan.id}/layout/issues/${scroll.id}/image`,
    );
    expect(wrongScan.status).toBe(404);
  });

  it('o verificare esuata e salvata cu motivul; fara verificare, ruta raspunde 404', async () => {
    const { scan } = await createLayoutScan(false);
    const dto = scanSchema.parse((await request(app).get(`/api/v1/scans/${scan.id}`)).body);
    expect(dto.layout).toEqual({ visible: 0, possible: 0, info: 0, failed: true });
    const layout = scanLayoutSchema.parse(
      (await request(app).get(`/api/v1/scans/${scan.id}/layout`)).body,
    );
    expect(layout.error).toBe('Pagina s-a inchis');
    expect(layout.issues).toEqual([]);

    const project = await createProject();
    const plain = await testDb.scan.create({
      data: { projectId: project.id, pageUrl: 'https://exemplu.ro/', config: {} },
    });
    const missing = await request(app).get(`/api/v1/scans/${plain.id}/layout`);
    expect(missing.status).toBe(404);
    expect(apiErrorSchema.parse(missing.body).error.code).toBe('LAYOUT_NOT_FOUND');
  });

  it('stergerea scanarii sterge si verificarea aspectului (cascada)', async () => {
    const { scan } = await createLayoutScan(true);
    await testDb.scan.delete({ where: { id: scan.id } });
    expect(await testDb.scanLayout.count()).toBe(0);
    expect(await testDb.layoutIssue.count()).toBe(0);
  });
});
