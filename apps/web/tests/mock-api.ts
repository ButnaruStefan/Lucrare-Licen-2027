/**
 * API simulat pentru testele interfetei: raspunsuri fixe, conforme cu contractele din
 * `@ro-a11y/shared`, servite prin interceptarea cererilor din browser (Playwright).
 * Testele interfetei nu au nevoie de server, baza de date sau worker reale.
 */
import type { Page } from 'playwright';
import { buildTrace, evaluateOug112, OUG_112_QUESTIONS } from '@ro-a11y/catalog';
import {
  auditResultsSchema,
  auditSchema,
  legalProfileAnswersSchema,
  pageCheckSchema,
  projectSchema,
  ruleResultSchema,
  scanConfigSchema,
  scanLayoutSchema,
  scanSchema,
  type Audit,
  type AuditResults,
  type DiscoveredPage,
  type LegalProfile,
  type PageCheck,
  type Project,
  type RuleResult,
  type Scan,
  type ScanLayout,
} from '@ro-a11y/shared';

export const PROJECT: Project = projectSchema.parse({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Primăria Valea Verde',
  baseUrl: 'https://valea-verde.example/',
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-10T08:00:00.000Z',
});

const config = scanConfigSchema.parse({});

/** Un fragment HTML rau intentionat in semnalele de aspect: trebuie afisat ca text. */
const HOSTILE_HTML_LAYOUT = '<table id="program" onmouseover="alert(1)"><script>alert(2)</script>';

export function makeScan(overrides: Partial<Scan> = {}): Scan {
  return scanSchema.parse({
    id: '22222222-2222-4222-8222-222222222222',
    projectId: PROJECT.id,
    auditId: null,
    pageUrl: PROJECT.baseUrl,
    finalUrl: PROJECT.baseUrl,
    httpStatus: 200,
    status: 'completed',
    config,
    catalogVersion: '2026-10-16',
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
    screenshot: {
      url: '/api/v1/scans/22222222-2222-4222-8222-222222222222/screenshot',
      format: 'webp',
      width: 1366,
      height: 2000,
      pageHeight: 1950,
      truncated: false,
      // Doua ecrane de 1000 px, fotografiate la derularea 0 si 950 (ultimul s-a oprit la capat)
      frameHeight: 1000,
      frameOffsets: [0, 950],
    },
    layout: null,
    ...overrides,
  });
}

/** O scanare care a verificat doar aspectul paginii (fara axe-core). */
export function makeLayoutScan(overrides: Partial<Scan> = {}): Scan {
  return makeScan({
    config: scanConfigSchema.parse({ checks: { accessibility: false, layout: true } }),
    engineName: null,
    engineVersion: null,
    screenshot: null,
    layout: { visible: 1, possible: 1, info: 0, failed: false },
    ...overrides,
  });
}

/**
 * Verificarea aspectului simulata: un semnal sigur (cu captura), unul de confirmat si unul cu
 * capetele intervalului aproximative (s-a terminat timpul cautarii lor).
 */
export const LAYOUT: ScanLayout = scanLayoutSchema.parse({
  widths: [1400, 1340, 1280, 768, 767, 320],
  breakpoints: [
    { feature: 'max-width', px: 768, text: '(max-width: 768px)', source: null },
    {
      feature: 'min-width',
      px: 768,
      text: '(min-width: 768px)',
      source: 'https://valea-verde.example/stil.css',
    },
  ],
  metaViewport: 'width=device-width, initial-scale=1',
  durationMs: 6400,
  partial: false,
  error: null,
  issues: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      kind: 'derulare-orizontala',
      level: 'visible',
      widthMin: 320,
      widthMax: 1080,
      elements: [
        {
          selector: '#program',
          htmlSnippet: HOSTILE_HTML_LAYOUT,
          text: 'Program cu publicul',
        },
      ],
      details: { pageWidth: 1124, overflowPx: 424, edgeX: 700 },
      image: {
        url: '/api/v1/scans/22222222-2222-4222-8222-222222222222/layout/issues/55555555-5555-4555-8555-555555555555/image',
        width: 1124,
        height: 200,
        viewportWidth: 700,
      },
      boxes: [{ x: 24, y: 24, width: 1100, height: 150 }],
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'media-queries-suprapuse',
      level: 'possible',
      widthMin: 768,
      widthMax: 768,
      elements: [],
      details: {
        rules: [
          { text: '(max-width: 768px)', source: null },
          { text: '(min-width: 768px)', source: 'https://valea-verde.example/stil.css' },
        ],
      },
      image: null,
      boxes: [],
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      kind: 'iese-din-container',
      level: 'possible',
      widthMin: 1040,
      widthMax: 1100,
      elements: [{ selector: '.card h4', htmlSnippet: '<h4>Iași Today</h4>', text: 'Iași Today' }],
      details: { overflowPx: 14, approximate: true },
      image: null,
      boxes: [],
    },
  ],
});

/** Captura simulata a paginii: o imagine PNG de 1 x 1 pixel (alb), intinsa pe toata harta. */
export const SCREENSHOT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

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
    axeTags: ['wcag2a', 'wcag111', 'EN-301-549', 'EN-9.1.1.1'],
    wcagCriteria: ['1.1.1'],
    isBestPractice: false,
    affectedElements: [
      {
        id: 'e1',
        cssSelector: ['img.hero'],
        htmlSnippet: HOSTILE_HTML,
        failureSummary: 'Element does not have an alt attribute',
        fingerprint: 'f1',
        box: { x: 100, y: 300, width: 640, height: 280 },
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
      {
        id: 'e2',
        cssSelector: ['p'],
        htmlSnippet: '<p>',
        failureSummary: null,
        fingerprint: 'f2',
        box: { x: 100, y: 700, width: 500, height: 60 },
      },
      {
        id: 'e3',
        cssSelector: ['h1'],
        htmlSnippet: '<h1>',
        failureSummary: null,
        fingerprint: 'f3',
        box: { x: 100, y: 120, width: 400, height: 48 },
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
    axeTags: ['wcag2aa', 'wcag143', 'EN-301-549', 'EN-9.1.4.3'],
    wcagCriteria: ['1.4.3'],
    isBestPractice: false,
    affectedElements: [
      {
        id: 'e4',
        cssSelector: ['.banner p'],
        htmlSnippet: '<p>Ședința consiliului</p>',
        failureSummary: 'Background image prevents contrast calculation',
        fingerprint: 'f4',
        box: { x: 100, y: 1100, width: 600, height: 40 },
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
].map((r) =>
  ruleResultSchema.parse({
    ...r,
    // Lantul de trasabilitate e construit de motorul real din catalog, ca in API.
    trace: buildTrace({
      axeRuleId: r.axeRuleId,
      axeTags: r.axeTags,
      wcagCriteria: r.wcagCriteria,
      docsUrl: r.docsUrl,
      engineVersion: '4.13.0',
      includeRemediation: r.category === 'violation' || r.category === 'incomplete',
    }),
  }),
);

// ─── Audit pe mai multe pagini ────────────────────────────────────────────────

export const AUDIT_ID = '33333333-3333-4333-8333-333333333333';
const SITE = PROJECT.baseUrl;

export function discovered(
  path: string,
  label: string,
  section: string | null,
  reasons: DiscoveredPage['reasons'] = [],
): DiscoveredPage {
  return {
    url: `${SITE}${path}`,
    label,
    section,
    region: section ? 'nav' : 'main',
    proposed: reasons.length > 0,
    selected: false,
    robotsBlocked: false,
    reasons,
  };
}

/** Paginile gasite: un site cu meniuri, ca al unei primarii (o sectiune mare, de 8 pagini). */
export const DISCOVERED_PAGES: DiscoveredPage[] = [
  discovered('', 'Pagina de start', null, ['start']),
  discovered('primaria/conducerea', 'Conducerea', 'Primăria', ['section']),
  // Interzisa de robots.txt: nu e propusa, dar poate fi bifata de utilizator
  { ...discovered('primaria/organigrama', 'Organigrama', 'Primăria'), robotsBlocked: true },
  ...[
    'consilieri',
    'comisii',
    'sedinte',
    'hotarari',
    'proiecte',
    'procese-verbale',
    'dispozitii',
    'rapoarte',
  ].map((slug, i) =>
    discovered(
      `consiliu/${slug}`,
      `Consiliu: ${slug}`,
      'Consiliul local',
      i === 0 ? ['section'] : i === 7 ? ['random'] : [],
    ),
  ),
  discovered('contact', 'Contact', null, ['essential']),
  {
    ...discovered('declaratie-accesibilitate', 'declaratie accesibilitate', null, ['essential']),
    region: 'sitemap',
  },
];

export function makeAudit(overrides: Partial<Audit> = {}): Audit {
  return auditSchema.parse({
    id: AUDIT_ID,
    projectId: PROJECT.id,
    startUrl: SITE,
    maxPages: 10,
    status: 'awaiting_selection',
    config,
    catalogVersion: '2026-10-28',
    discovery: {
      finalUrl: SITE,
      scope: SITE,
      linksFound: 42,
      pages: DISCOVERED_PAGES,
      external: [
        {
          origin: 'https://www.ghiseul.ro',
          url: 'https://www.ghiseul.ro/ghiseul/public/taxe',
          label: 'Plăți online',
        },
      ],
      documents: [{ url: `${SITE}hcl-12.pdf`, label: 'Hotărârea nr. 12/2026', extension: 'pdf' }],
      excluded: { non_http: 2, same_page: 3 },
      robots: { found: true, blocked: 1 },
      sitemap: { found: true, urls: 12 },
    },
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-11-03T09:00:00.000Z',
    discoveredAt: '2026-11-03T09:00:05.000Z',
    selectedAt: null,
    finishedAt: null,
    progress: { total: 0, completed: 0, failed: 0 },
    pages: [],
    ...overrides,
  });
}

const SUMMARY = {
  violations: 3,
  violationElements: 5,
  incomplete: 1,
  incompleteElements: 1,
  passes: 20,
  inapplicable: 40,
};

/** Auditul dupa scanarea paginilor alese. */
export function completedAudit(): Audit {
  const chosen = DISCOVERED_PAGES.filter((p) => p.proposed);
  return makeAudit({
    status: 'completed',
    selectedAt: '2026-11-03T09:01:00.000Z',
    finishedAt: '2026-11-03T09:02:00.000Z',
    progress: { total: chosen.length, completed: chosen.length - 1, failed: 1 },
    pages: chosen.map((p, i) => ({
      scanId: `4444444${i}-4444-4444-8444-444444444444`,
      pageUrl: p.url,
      label: p.label,
      reasons: p.reasons,
      robotsBlocked: false,
      status: i === chosen.length - 1 ? 'failed' : 'completed',
      errorMessage: i === chosen.length - 1 ? 'Serverul a răspuns cu codul 500.' : null,
      summary: i === chosen.length - 1 ? null : SUMMARY,
      layout: null,
    })),
  });
}

export const AUDIT_RESULTS: AuditResults = auditResultsSchema.parse({
  pagesScanned: 5,
  rules: [
    {
      axeRuleId: 'link-name',
      category: 'violation',
      impact: 'serious',
      title: 'Links must have discernible text',
      titleRo: 'Linkurile trebuie să aibă un text care poate fi înțeles',
      isBestPractice: false,
      wcagCriteria: ['2.4.4', '4.1.2'],
      elementCount: 5,
      pages: completedAudit()
        .pages.slice(0, 5)
        .map((p) => ({ scanId: p.scanId, pageUrl: p.pageUrl, elementCount: 1 })),
    },
    {
      axeRuleId: 'color-contrast',
      category: 'incomplete',
      impact: 'serious',
      title: 'Elements must meet minimum color contrast ratio thresholds',
      titleRo: null,
      isBestPractice: false,
      wcagCriteria: ['1.4.3'],
      elementCount: 1,
      pages: [
        {
          scanId: completedAudit().pages[0]!.scanId,
          pageUrl: completedAudit().pages[0]!.pageUrl,
          elementCount: 1,
        },
      ],
    },
  ],
  commonIssues: [
    {
      key: 'abc',
      axeRuleId: 'link-name',
      category: 'violation',
      impact: 'serious',
      title: 'Links must have discernible text',
      titleRo: 'Linkurile trebuie să aibă un text care poate fi înțeles',
      htmlSnippet: HOSTILE_HTML,
      cssSelector: ['a.social'],
      pages: completedAudit()
        .pages.slice(0, 5)
        .map((p) => ({ scanId: p.scanId, pageUrl: p.pageUrl })),
    },
  ],
});

export interface MockApiOptions {
  projects?: Project[];
  /** Raspunsurile succesive pentru GET /api/v1/scans/:id (ultimul se repeta). */
  scanSequence?: Scan[];
  /** Raspunsul pentru POST /api/v1/projects. */
  createProject?: { status: number; body: unknown };
  /** Rezultatele scanarii (implicit: RESULTS). */
  results?: RuleResult[];
  /** Profilul juridic salvat la inceput (implicit: necompletat). */
  legalProfile?: LegalProfile | null;
  /** Auditul intors de GET /api/v1/audits/:id (implicit: paginile gasite, de ales). */
  audit?: Audit;
  /** Raspunsul pentru POST /api/v1/audits/:id/selection (implicit: auditul finalizat). */
  selection?: { status: number; body: unknown };
  /** Primeste corpul cererii de selectie (ca testul sa verifice paginile trimise). */
  onSelection?: (body: unknown) => void;
  /** Raspunsul verificarii unei pagini adaugate manual (implicit: exista, fara redirectionare). */
  pageCheck?: (url: string) => PageCheck;
  /** Verificarea aspectului (implicit: LAYOUT; null = scanarea nu are una, 404). */
  layout?: ScanLayout | null;
  /** Primeste corpul cererii de pornire a unei scanari sau a unui audit. */
  onCreate?: (kind: 'scan' | 'audit', body: unknown) => void;
}

/** Data fixa a evaluarii in profilul simulat. */
export const LEGAL_PROFILE_DATE = '2026-10-28T10:00:00.000Z';

/** Intercepteaza cererile catre API si raspunde cu datele de test. */
export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const projects = options.projects ?? [PROJECT];
  const scans = options.scanSequence ?? [makeScan()];
  let scanCall = 0;
  let legalProfile = options.legalProfile ?? null;

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
  await page.route(`**/api/v1/projects/${PROJECT.id}/scans`, (route) => {
    if (route.request().method() === 'POST') {
      options.onCreate?.('scan', route.request().postDataJSON());
      return route.fulfill(json(makeScan({ status: 'queued', summary: null }), 202));
    }
    return route.fulfill(json({ items: [scans[scans.length - 1]] }));
  });
  // Profilul juridic: GET trimite intrebarile si profilul; PUT il evalueaza cu motorul real.
  await page.route(`**/api/v1/projects/${PROJECT.id}/legal-profile`, (route) => {
    if (route.request().method() === 'PUT') {
      const parsed = legalProfileAnswersSchema.safeParse(route.request().postDataJSON());
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        const message = 'Datele trimise nu sunt valide.';
        return route.fulfill(json({ error: { code: 'VALIDATION_ERROR', message, details } }, 400));
      }
      legalProfile = {
        projectId: PROJECT.id,
        answers: parsed.data,
        assessment: evaluateOug112(parsed.data),
        updatedAt: LEGAL_PROFILE_DATE,
      };
      return route.fulfill(json(legalProfile));
    }
    return route.fulfill(json({ questions: OUG_112_QUESTIONS, profile: legalProfile }));
  });
  // Auditurile: lista proiectului, pornirea, auditul, alegerea paginilor si rezultatele.
  let audit = options.audit ?? makeAudit();
  await page.route(`**/api/v1/projects/${PROJECT.id}/audits`, (route) => {
    if (route.request().method() === 'POST') {
      options.onCreate?.('audit', route.request().postDataJSON());
      return route.fulfill(json(makeAudit({ status: 'discovery_queued', discovery: null }), 202));
    }
    return route.fulfill(
      json({
        items: [
          {
            id: audit.id,
            startUrl: audit.startUrl,
            status: audit.status,
            createdAt: audit.createdAt,
            pagesFound: audit.discovery?.pages.length ?? null,
            progress: audit.progress,
          },
        ],
      }),
    );
  });
  await page.route('**/api/v1/audits/*/selection', (route) => {
    options.onSelection?.(route.request().postDataJSON());
    const res = options.selection ?? { status: 200, body: completedAudit() };
    if (res.status === 200) audit = auditSchema.parse(res.body);
    return route.fulfill(json(res.body, res.status));
  });
  await page.route('**/api/v1/audits/*/page-check', (route) => {
    const { url } = route.request().postDataJSON() as { url: string };
    const result = options.pageCheck?.(url) ?? { exists: true, url, redirected: false };
    return route.fulfill(json(pageCheckSchema.parse(result)));
  });
  await page.route('**/api/v1/audits/*/results', (route) => route.fulfill(json(AUDIT_RESULTS)));
  await page.route(/\/api\/v1\/audits\/[^/]+$/, (route) => route.fulfill(json(audit)));

  await page.route('**/api/v1/scans/*/screenshot', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: SCREENSHOT_PNG }),
  );
  await page.route('**/api/v1/scans/*/layout/issues/*/image', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: SCREENSHOT_PNG }),
  );
  await page.route('**/api/v1/scans/*/layout', (route) => {
    const layout = options.layout === undefined ? LAYOUT : options.layout;
    if (!layout) {
      const message = 'Scanarea nu are o verificare a aspectului paginii.';
      return route.fulfill(json({ error: { code: 'LAYOUT_NOT_FOUND', message } }, 404));
    }
    return route.fulfill(json(layout));
  });
  await page.route('**/api/v1/scans/*/results', (route) =>
    route.fulfill(json({ items: options.results ?? RESULTS })),
  );
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
