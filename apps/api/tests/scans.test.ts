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
        { cssSelector: ['p'], htmlSnippet: '<p>', failureSummary: null, fingerprint: 'f1' },
        { cssSelector: ['h1'], htmlSnippet: '<h1>', failureSummary: null, fingerprint: 'f2' },
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
        { cssSelector: ['img'], htmlSnippet: '<img>', failureSummary: 'x', fingerprint: 'f3' },
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
    // O buna practica nu are legatura normativa
    expect(all.items[1]!.trace).toMatchObject({ isBestPractice: true, wcag: [], legal: [] });

    const violations = ruleResultListSchema.parse(
      (await request(app).get(`/api/v1/scans/${scan.id}/results?category=violation`)).body,
    );
    expect(violations.items).toHaveLength(2);
  });

  it('respinge o categorie necunoscuta (400) si o scanare inexistenta (404)', async () => {
    const { scan } = await createCompletedScan();
    expect(
      (await request(app).get(`/api/v1/scans/${scan.id}/results?category=altceva`)).status,
    ).toBe(400);
    expect((await request(app).get('/api/v1/scans/nu-e-uuid')).status).toBe(404);
  });
});
