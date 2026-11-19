/**
 * Testele regulilor verificarii aspectului, fara browser: masuratori inventate ale unei pagini
 * la mai multe latimi, ca fiecare regula sa poata fi verificata exact.
 *
 *   - latimile verificate (pasul de 60 px si breakpoint-urile paginii);
 *   - o suprapunere aparuta la latime mica e raportata; una prezenta peste tot nu (efect voit);
 *   - un element si stramosul lui nu se "suprapun";
 *   - continutul care iese din container (partial sau cazut sub el) e raportat; un slide
 *     complet in afara pe orizontala si textul taiat voit cu "..." nu;
 *   - derularea orizontala si taierea la marginea paginii;
 *   - media queries suprapuse si meta viewport.
 */
import { describe, expect, it } from 'vitest';
import {
  checkMetaViewport,
  detectLayoutIssues,
  findCollisions,
  findContainerProtrusions,
  findEdgeCuts,
  findHorizontalScroll,
  findMediaClashes,
  MAX_ISSUES_PER_KIND,
  parseBreakpoints,
  sweepWidths,
  type LayoutSnapshot,
  type MeasuredElement,
  type MediaRuleInfo,
  type Rect,
} from '../src/scanner/layout-rules';

function el(id: number, rects: Rect[], extra: Partial<MeasuredElement> = {}): MeasuredElement {
  return {
    id,
    parent: null,
    kind: 'text',
    interactive: false,
    fixed: false,
    ellipsis: false,
    faint: false,
    inScroller: false,
    rects,
    visible: rects,
    clip: null,
    ...extra,
  };
}

function snap(width: number, elements: MeasuredElement[], extra: Partial<LayoutSnapshot> = {}) {
  return {
    width,
    viewportWidth: width,
    scrollWidth: width,
    rootClipsX: false,
    elements,
    overflowing: [],
    truncated: false,
    ...extra,
  } satisfies LayoutSnapshot;
}

describe('latimile verificate', () => {
  it('de la 1400 la 320, din 60 in 60, plus latimile din jurul breakpoint-urilor', () => {
    const plain = sweepWidths([]);
    expect(plain[0]).toBe(1400);
    expect(plain).toContain(1340);
    expect(plain.at(-1)).toBe(320);
    expect(plain).toHaveLength(19); // 1400, 1340, ..., 380, 320 (18 pasi de 60 px)

    const widths = sweepWidths(
      parseBreakpoints([
        {
          text: '(min-width: 768px)',
          source: null,
          expressions: [{ feature: 'min-width', px: 768 }],
        },
        {
          text: '(max-width: 1023.98px)',
          source: null,
          expressions: [{ feature: 'max-width', px: 1023.98 }],
        },
        {
          text: '(min-width: 2000px)',
          source: null,
          expressions: [{ feature: 'min-width', px: 2000 }],
        },
      ]),
    );
    expect(widths).toEqual(expect.arrayContaining([767, 768, 1023, 1024]));
    expect(widths).not.toContain(1999); // in afara intervalului 320-1400
    expect([...widths].sort((a, b) => b - a)).toEqual(widths); // de la mare la mic
  });

  it('breakpoint-urile sunt citite fara dubluri, iar alte conditii (ex. orientarea) sunt ignorate', () => {
    const medias: MediaRuleInfo[] = [
      {
        text: '(min-width: 768px)',
        source: 'a.css',
        expressions: [{ feature: 'min-width', px: 768 }],
      },
      {
        text: '(min-width: 768px)',
        source: 'a.css',
        expressions: [{ feature: 'min-width', px: 768 }],
      },
      {
        text: '(orientation: portrait)',
        source: null,
        expressions: [{ feature: 'orientation', px: 0 }],
      },
    ];
    expect(parseBreakpoints(medias)).toEqual([
      { feature: 'min-width', px: 768, text: '(min-width: 768px)', source: 'a.css' },
    ]);
  });
});

describe('elemente suprapuse', () => {
  const titlu = (x: number) => el(1, [[x, 0, 300, 30]]);
  const meniu = (x: number) => el(2, [[x, 0, 300, 30]]);

  it('o suprapunere aparuta la latime mica e raportata, cu intervalul ei', () => {
    const findings = findCollisions([
      snap(1400, [titlu(0), meniu(1000)]),
      snap(1340, [titlu(0), meniu(900)]),
      snap(1280, [titlu(0), meniu(250)]), // se suprapun 50 px
      snap(1220, [titlu(0), meniu(200)]),
    ]);
    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'elemente-suprapuse',
        level: 'visible',
        widthMin: 1220,
        widthMax: 1280,
        ids: [1, 2],
        details: { overlap: { width: 50, height: 15 } }, // mijlocul randurilor (50%)
      }),
    ]);
  });

  it('o suprapunere prezenta la toate latimile e voita: nu e raportata', () => {
    const findings = findCollisions([
      snap(1400, [titlu(0), meniu(100)]),
      snap(1340, [titlu(0), meniu(100)]),
    ]);
    expect(findings).toEqual([]);
  });

  it('nu compara un element cu stramosul lui si ignora elementele fixe si atingerile de 1-2 px', () => {
    const findings = findCollisions([
      snap(1400, [el(1, [[0, 0, 300, 30]]), el(2, [[400, 0, 100, 30]]), el(3, [[600, 0, 50, 30]])]),
      snap(1340, [
        el(1, [[0, 0, 300, 30]]),
        el(2, [[100, 0, 100, 30]], { parent: 1 }), // copil: e normal sa stea in parinte
        el(3, [[298, 0, 50, 30]]), // se ating doar 2 px
        el(4, [[0, 0, 300, 30]], { fixed: true }), // meniu fix: se misca la derulare
      ]),
    ]);
    expect(findings).toEqual([]);
  });

  it('randurile vecine ale unui paragraf care se ating cativa px si textul estompat (decor) nu conteaza', () => {
    const findings = findCollisions([
      snap(1400, [
        el(1, [[0, 0, 200, 24]]),
        el(2, [[300, 0, 200, 24]]),
        el(3, [[600, 0, 300, 80]]),
      ]),
      snap(1340, [
        el(1, [[0, 0, 200, 24]]),
        el(2, [[0, 20, 200, 24]]), // randul urmator: se ating 4 px din 24
        el(3, [[0, 0, 300, 80]], { faint: true }), // cuvant mare, aproape transparent, in fundal
      ]),
    ]);
    expect(findings).toEqual([]);
  });

  it('o suprapunere cu o imagine e doar "posibila" (poate fi un efect voit)', () => {
    const findings = findCollisions([
      snap(1400, [el(1, [[0, 0, 300, 30]]), el(2, [[500, 0, 300, 200]], { kind: 'media' })]),
      snap(1340, [el(1, [[0, 0, 300, 30]]), el(2, [[200, 0, 300, 200]], { kind: 'media' })]),
    ]);
    expect(findings[0]!.level).toBe('possible');
  });
});

describe('iese din container', () => {
  const nav = { id: 99, box: [0, 0, 500, 40] as Rect };

  it('un link care iese partial sau cade sub containerul care il taie e raportat', () => {
    const findings = findContainerProtrusions([
      snap(1400, [el(1, [[400, 10, 80, 20]], { interactive: true, clip: nav })]),
      snap(1340, [el(1, [[450, 10, 80, 20]], { interactive: true, clip: nav })]), // iese 30 px
      snap(1280, [el(1, [[0, 50, 80, 20]], { interactive: true, clip: nav })]), // a cazut sub bara
    ]);
    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'iese-din-container',
        level: 'visible',
        widthMin: 1280,
        widthMax: 1340,
        ids: [1],
      }),
    ]);
  });

  it('un slide complet in afara pe orizontala si textul taiat voit cu "..." nu sunt raportate', () => {
    const findings = findContainerProtrusions([
      snap(1400, [
        el(1, [[100, 10, 80, 20]], { clip: nav }),
        el(2, [[100, 10, 300, 20]], { clip: nav, ellipsis: true }),
      ]),
      snap(1340, [
        el(1, [[600, 10, 80, 20]], { clip: nav }), // complet in dreapta containerului
        el(2, [[100, 10, 900, 20]], { clip: nav, ellipsis: true }),
      ]),
    ]);
    expect(findings).toEqual([]);
  });
});

describe('derularea orizontala si marginea paginii', () => {
  it('derularea orizontala e raportata pe intervalul ei, cu elementele vinovate', () => {
    const findings = findHorizontalScroll([
      snap(1400, []),
      snap(1340, [], { scrollWidth: 1360, overflowing: [7] }),
      snap(1280, [], { scrollWidth: 1360, overflowing: [7] }),
      snap(1220, [], { scrollWidth: 1360, overflowing: [7] }),
    ]);
    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'derulare-orizontala',
        level: 'visible',
        widthMin: 1220,
        widthMax: 1340,
        ids: [7],
        captureWidth: 1280,
        details: { pageWidth: 1360, overflowPx: 80 },
      }),
    ]);
  });

  it('cu derularea ascunsa (overflow-x: hidden) nu e derulare, dar textul taiat la margine e raportat', () => {
    const snaps = [
      snap(1400, [el(1, [[0, 0, 1000, 20]])], { rootClipsX: true }),
      snap(900, [el(1, [[0, 0, 1000, 20]])], { rootClipsX: true, scrollWidth: 1000 }),
    ];
    expect(findHorizontalScroll(snaps)).toEqual([]);
    expect(findEdgeCuts(snaps)).toEqual([
      expect.objectContaining({ kind: 'taiat-la-marginea-paginii', widthMax: 900, ids: [1] }),
    ]);
  });

  it('un meniu complet in afara ecranului (ascuns voit) nu e "taiat"', () => {
    const snaps = [
      snap(1400, [el(1, [[0, 0, 300, 20]])], { rootClipsX: true }),
      snap(900, [el(1, [[900, 0, 300, 20]])], { rootClipsX: true }),
    ];
    expect(findEdgeCuts(snaps)).toEqual([]);
  });
});

describe('media queries si meta viewport', () => {
  it('max-width: N si min-width: N sunt suprapuse; 767.98 px si 768 px nu', () => {
    const medias: MediaRuleInfo[] = [
      {
        text: '(max-width: 768px)',
        source: 'a.css',
        expressions: [{ feature: 'max-width', px: 768 }],
      },
      {
        text: '(min-width: 768px)',
        source: 'b.css',
        expressions: [{ feature: 'min-width', px: 768 }],
      },
      {
        text: '(max-width: 1023.98px)',
        source: null,
        expressions: [{ feature: 'max-width', px: 1023.98 }],
      },
      {
        text: '(min-width: 1024px)',
        source: null,
        expressions: [{ feature: 'min-width', px: 1024 }],
      },
    ];
    expect(findMediaClashes(medias)).toEqual([
      expect.objectContaining({
        kind: 'media-queries-suprapuse',
        widthMin: 768,
        widthMax: 768,
        details: {
          rules: [
            { text: '(max-width: 768px)', source: 'a.css' },
            { text: '(min-width: 768px)', source: 'b.css' },
          ],
        },
      }),
    ]);
  });

  it('o singura regula cu min si max egale nu e o suprapunere', () => {
    const medias: MediaRuleInfo[] = [
      {
        text: '(min-width: 768px) and (max-width: 768px)',
        source: null,
        expressions: [
          { feature: 'min-width', px: 768 },
          { feature: 'max-width', px: 768 },
        ],
      },
    ];
    expect(findMediaClashes(medias)).toEqual([]);
  });

  it('meta viewport: lipsa, latime fixa, corecta', () => {
    expect(checkMetaViewport(null)).toMatchObject([
      { kind: 'fara-meta-viewport', level: 'visible' },
    ]);
    expect(checkMetaViewport('width=1024')).toMatchObject([
      {
        kind: 'meta-viewport-latime-fixa',
        level: 'possible',
        details: { metaViewport: 'width=1024' },
      },
    ]);
    expect(checkMetaViewport('width=device-width, initial-scale=1')).toEqual([]);
    expect(checkMetaViewport('initial-scale=1')).toEqual([]);
  });
});

describe('toate regulile impreuna', () => {
  it('semnalele sigure sunt primele si fiecare tip e limitat', () => {
    // 30 de perechi de elemente care se suprapun toate sub 1400 px
    const wide = Array.from({ length: 30 }, (_, i) => [
      el(i * 2 + 1, [[0, i * 100, 100, 30]]),
      el(i * 2 + 2, [[200, i * 100, 100, 30]], { kind: 'media' }),
    ]).flat();
    const narrow = Array.from({ length: 30 }, (_, i) => [
      el(i * 2 + 1, [[0, i * 100, 100, 30]]),
      el(i * 2 + 2, [[50, i * 100, 100, 30]], { kind: 'media' }),
    ]).flat();
    const findings = detectLayoutIssues([snap(1400, wide), snap(1340, narrow)], [], null);
    expect(findings[0]!.kind).toBe('fara-meta-viewport'); // sigur ("visible")
    expect(findings.filter((f) => f.kind === 'elemente-suprapuse')).toHaveLength(
      MAX_ISSUES_PER_KIND,
    );
  });
});
