/**
 * API simulat pentru testele interfetei: raspunsuri fixe, conforme cu contractele din
 * `@ro-a11y/shared`, servite prin interceptarea cererilor din browser (Playwright).
 * Testele interfetei nu au nevoie de server, baza de date sau worker reale.
 */
import type { Page } from 'playwright';
import {
  projectSchema,
  ruleResultSchema,
  scanConfigSchema,
  scanSchema,
  type Project,
  type RuleResult,
  type Scan,
} from '@ro-a11y/shared';

export const PROJECT: Project = projectSchema.parse({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Primăria Valea Verde',
  baseUrl: 'https://valea-verde.example/',
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-10T08:00:00.000Z',
});

const config = scanConfigSchema.parse({});

export function makeScan(overrides: Partial<Scan> = {}): Scan {
  return scanSchema.parse({
    id: '22222222-2222-4222-8222-222222222222',
    projectId: PROJECT.id,
    pageUrl: PROJECT.baseUrl,
    finalUrl: PROJECT.baseUrl,
    httpStatus: 200,
    status: 'completed',
    config,
    engineName: 'axe-core',
    engineVersion: '4.13.0',
    browserVersion: 'Chrome 155',
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-10-15T09:00:00.000Z',
    startedAt: '2026-10-15T09:00:01.000Z',
    finishedAt: '2026-10-15T09:00:05.000Z',
    summary: {
      violations: 2,
      violationElements: 3,
      incomplete: 1,
      incompleteElements: 1,
      passes: 1,
      inapplicable: 0,
    },
    ...overrides,
  });
}

/** Un fragment HTML "rau intentionat": daca ar fi interpretat, ar deschide o fereastra. */
export const HOSTILE_HTML = '<img src="x" onerror="alert(\'xss\')"><script>alert(1)</script>';

export const RESULTS: RuleResult[] = [
  {
    id: 'r1',
    axeRuleId: 'image-alt',
    category: 'violation',
    impact: 'critical',
    title: 'Images must have alternative text',
    description: 'Ensure <img> elements have alternative text',
    docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    axeTags: ['wcag2a', 'wcag111'],
    wcagCriteria: ['1.1.1'],
    isBestPractice: false,
    affectedElements: [
      {
        id: 'e1',
        cssSelector: ['img.hero'],
        htmlSnippet: HOSTILE_HTML,
        failureSummary: 'Element does not have an alt attribute',
        fingerprint: 'f1',
      },
    ],
  },
  {
    id: 'r2',
    axeRuleId: 'region',
    category: 'violation',
    impact: 'moderate',
    title: 'All page content should be contained by landmarks',
    description: 'Ensure all page content is contained by landmarks',
    docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/region',
    axeTags: ['cat.keyboard', 'best-practice'],
    wcagCriteria: [],
    isBestPractice: true,
    affectedElements: [
      { id: 'e2', cssSelector: ['p'], htmlSnippet: '<p>', failureSummary: null, fingerprint: 'f2' },
      {
        id: 'e3',
        cssSelector: ['h1'],
        htmlSnippet: '<h1>',
        failureSummary: null,
        fingerprint: 'f3',
      },
    ],
  },
  {
    id: 'r3',
    axeRuleId: 'color-contrast',
    category: 'incomplete',
    impact: 'serious',
    title: 'Elements must meet minimum color contrast ratio thresholds',
    description: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA',
    docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/color-contrast',
    axeTags: ['wcag2aa', 'wcag143'],
    wcagCriteria: ['1.4.3'],
    isBestPractice: false,
    affectedElements: [
      {
        id: 'e4',
        cssSelector: ['.banner p'],
        htmlSnippet: '<p>Ședința consiliului</p>',
        failureSummary: 'Background image prevents contrast calculation',
        fingerprint: 'f4',
      },
    ],
  },
  {
    id: 'r4',
    axeRuleId: 'document-title',
    category: 'pass',
    impact: null,
    title: 'Documents must have <title> element to aid in navigation',
    description: 'Ensure each HTML document contains a non-empty <title> element',
    docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/document-title',
    axeTags: ['wcag2a', 'wcag242'],
    wcagCriteria: ['2.4.2'],
    isBestPractice: false,
    affectedElements: [],
  },
].map((r) => ruleResultSchema.parse(r));

export interface MockApiOptions {
  projects?: Project[];
  /** Raspunsurile succesive pentru GET /api/v1/scans/:id (ultimul se repeta). */
  scanSequence?: Scan[];
  /** Raspunsul pentru POST /api/v1/projects. */
  createProject?: { status: number; body: unknown };
}

/** Intercepteaza cererile catre API si raspunde cu datele de test. */
export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const projects = options.projects ?? [PROJECT];
  const scans = options.scanSequence ?? [makeScan()];
  let scanCall = 0;

  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/v1/health/ready', (route) =>
    route.fulfill(json({ status: 'ready', checks: { database: 'ok' } })),
  );
  await page.route('**/api/v1/projects', (route) => {
    if (route.request().method() === 'POST') {
      const res = options.createProject ?? { status: 201, body: PROJECT };
      return route.fulfill(json(res.body, res.status));
    }
    return route.fulfill(json({ items: projects }));
  });
  await page.route(`**/api/v1/projects/${PROJECT.id}`, (route) => route.fulfill(json(PROJECT)));
  await page.route(`**/api/v1/projects/${PROJECT.id}/scans`, (route) =>
    route.fulfill(json({ items: [scans[scans.length - 1]] })),
  );
  await page.route('**/api/v1/scans/*/results', (route) => route.fulfill(json({ items: RESULTS })));
  await page.route(/\/api\/v1\/scans\/[^/]+$/, (route) => {
    const id = route.request().url().split('/').pop();
    if (id !== scans[0]!.id) {
      return route.fulfill(
        json({ error: { code: 'SCAN_NOT_FOUND', message: 'Scanarea nu există.' } }, 404),
      );
    }
    const scan = scans[Math.min(scanCall, scans.length - 1)];
    scanCall += 1;
    return route.fulfill(json(scan));
  });
}
