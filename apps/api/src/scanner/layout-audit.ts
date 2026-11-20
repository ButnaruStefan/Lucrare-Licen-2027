/**
 * Verificarea aspectului paginii (separata complet de WCAG): ruleaza pe pagina deja deschisa de
 * scanner (`page-scan.ts`), dupa analiza de accesibilitate, daca utilizatorul a cerut-o.
 *
 * Pasii:
 *   1. citeste eticheta meta viewport si regulile @media ale paginii, prin Chrome DevTools
 *      Protocol (CSS.getMediaQueries vede si foile de stil de pe alte domenii, pe care
 *      JavaScript-ul paginii nu le poate citi);
 *   2. ingusteaza fereastra pas cu pas (1400 -> 320 px, din 60 in 60, plus breakpoint-urile
 *      paginii) si masoara aranjarea la fiecare latime (`layout-model.ts`); dupa fiecare
 *      redimensionare asteapta ca pagina sa se rearanjeze, doar cat e nevoie (timerele scurte
 *      ale scripturilor ei, cel mult 1 s);
 *   3. compara masuratorile intre latimi vecine (`layout-rules.ts`) si gaseste semnalele;
 *   4. cauta capetele exacte ale fiecarui interval (cautare binara, intai la breakpoint-uri),
 *      masurand doar elementele semnalului;
 *   5. pentru fiecare semnal: descrie elementele (selector, HTML, text) si, pentru cele mai
 *      importante, face o captura decupata in jurul lor, la latimea problemei (JPEG);
 *   6. readuce fereastra la dimensiunea initiala si functiile paginii (setTimeout) la loc.
 *
 * Are o limita proprie de timp: daca pagina e foarte grea, se opreste si marcheaza verificarea
 * "partiala" (sau capetele unor intervale "aproximative"), fara sa puna in pericol scanarea.
 */
import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { Breakpoint, ElementBox, LayoutElement, LayoutIssue } from '@ro-a11y/shared';
import { HIDE_OVERLAYS_SCRIPT, RESTORE_SCRIPT } from './capture';
import {
  DESCRIBE_SCRIPT,
  MAX_ELEMENTS,
  MEASURE_IDS_SCRIPT,
  MEASURE_SCRIPT,
  META_VIEWPORT_SCRIPT,
  SETTLE_SCRIPT,
  TIMERS_BEGIN_SCRIPT,
  TIMERS_INSTALL_SCRIPT,
  TIMERS_RESTORE_SCRIPT,
} from './layout-model';
import {
  detectLayoutIssues,
  parseBreakpoints,
  refineEdge,
  stateAt,
  sweepWidths,
  transitionPairs,
  type LayoutFinding,
  type LayoutSnapshot,
  type MediaRuleInfo,
  type Rect,
} from './layout-rules';

/**
 * Cat poate dura, cel mult, masurarea paginii la toate latimile si cautarea capetelor exacte
 * (alegere proprie).
 */
export const LAYOUT_BUDGET_MS = 45_000;
/** Cate capturi decupate facem pe pagina, cel mult (alegere proprie: spatiu in baza de date). */
export const MAX_LAYOUT_SCREENSHOTS = 10;
/** Spatiul lasat in jurul elementelor in captura si inaltimea maxima a capturii (px). */
const CROP_MARGIN = 24;
const CROP_MAX_HEIGHT = 700;
const CROP_QUALITY = 75;

/** Un semnal gata de salvat: tipul, elementele descrise, captura (daca exista). */
export interface LayoutIssueResult extends Omit<LayoutIssue, 'id' | 'image'> {
  fingerprint: string;
  image: {
    data: Buffer;
    format: 'jpeg';
    width: number;
    height: number;
    viewportWidth: number;
  } | null;
}

export interface LayoutAuditResult {
  widths: number[];
  breakpoints: Breakpoint[];
  metaViewport: string | null;
  durationMs: number;
  partial: boolean;
  issues: LayoutIssueResult[];
}

export interface LayoutAuditOptions {
  budgetMs?: number;
  maxScreenshots?: number;
}

interface Described extends LayoutElement {
  box: Rect;
  elementBox: Rect;
}

export async function auditLayout(
  page: Page,
  options: LayoutAuditOptions = {},
): Promise<LayoutAuditResult> {
  const started = Date.now();
  const budgetMs = options.budgetMs ?? LAYOUT_BUDGET_MS;
  const maxScreenshots = options.maxScreenshots ?? MAX_LAYOUT_SCREENSHOTS;
  const original = page.viewportSize();
  const height = original?.height ?? 768;

  const metaViewport = (await page.evaluate(META_VIEWPORT_SCRIPT)) as string | null;
  const info = await readPageInfo(page).catch(() => ({
    medias: [] as MediaRuleInfo[],
    resizeListeners: true,
  }));
  const medias = info.medias;
  const breakpoints = parseBreakpoints(medias);
  const widths = sweepWidths(breakpoints);
  const resize = (width: number) => resizeTo(page, width, height, info.resizeListeners);
  const outOfTime = () => Date.now() - started > budgetMs;

  const snapshots: LayoutSnapshot[] = [];
  let partial = false;
  try {
    await page.evaluate(TIMERS_INSTALL_SCRIPT);
    for (const width of widths) {
      if (outOfTime()) {
        partial = true;
        break;
      }
      await resize(width);
      const measured = (await page.evaluate(`(${MEASURE_SCRIPT})(${MAX_ELEMENTS})`)) as Omit<
        LayoutSnapshot,
        'width'
      >;
      snapshots.push({ ...measured, width });
    }

    const findings = detectLayoutIssues(snapshots, medias, metaViewport);
    await refineFindings(
      page,
      findings,
      snapshots.map((s) => s.width),
      breakpoints,
      resize,
      outOfTime,
    );
    const issues = await describeAndCapture(page, findings, resize, maxScreenshots);
    return {
      widths: snapshots.map((s) => s.width),
      breakpoints,
      metaViewport,
      durationMs: Date.now() - started,
      partial,
      issues,
    };
  } finally {
    await page.evaluate(TIMERS_RESTORE_SCRIPT).catch(() => {});
    if (original) await page.setViewportSize(original).catch(() => {});
  }
}

type Resize = (width: number) => Promise<void>;

/** Schimba latimea ferestrei si asteapta ca pagina sa se rearanjeze (SETTLE_SCRIPT). */
async function resizeTo(
  page: Page,
  width: number,
  height: number,
  resizeListeners: boolean,
): Promise<void> {
  await page.evaluate(TIMERS_BEGIN_SCRIPT);
  await page.setViewportSize({ width, height });
  await page.evaluate(`(${SETTLE_SCRIPT})(${resizeListeners})`);
}

/** Un capat de cautat: intre `bad` (semnalul apare) si latimea vecina masurata `notBad`. */
interface EdgeTask {
  finding: LayoutFinding;
  side: 'widthMax' | 'widthMin';
  bad: number;
  notBad: number;
}

/**
 * Capetele exacte ale intervalelor (pe loc, in `findings`): intre ultima latime masurata la care
 * semnalul apare si latimea vecina la care nu apare, cautare binara (`refineEdge`), masurand doar
 * elementele semnalului. Capetele de la marginea intervalului verificat (1400 sau 320 px) raman
 * asa. Daca se termina timpul, semnalul ramane cu capetele masurate si e marcat "aproximativ".
 *
 * Capetele cu acelasi interval de cautat (ex. toate cardurile unui carusel, care se strica la
 * acelasi breakpoint) sunt cautate impreuna: la fiecare latime masuram o singura data elementele
 * tuturor, iar masuratoarea e refolosita de fiecare cautare care ajunge la acea latime.
 */
async function refineFindings(
  page: Page,
  findings: LayoutFinding[],
  widths: number[],
  breakpoints: Breakpoint[],
  resize: Resize,
  outOfTime: () => boolean,
): Promise<void> {
  const hints = transitionPairs(breakpoints);
  const groups = new Map<string, EdgeTask[]>();
  const add = (task: EdgeTask) => {
    const key = `${task.bad}|${task.notBad}`;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  };
  for (const finding of findings) {
    if (finding.widthMin === null || finding.widthMax === null) continue;
    if (stateAt(finding, emptySnapshot) === null) continue;
    const top = widths.indexOf(finding.widthMax);
    if (top > 0)
      add({ finding, side: 'widthMax', bad: finding.widthMax, notBad: widths[top - 1]! });
    const bottom = widths.indexOf(finding.widthMin);
    if (bottom >= 0 && bottom < widths.length - 1) {
      add({ finding, side: 'widthMin', bad: finding.widthMin, notBad: widths[bottom + 1]! });
    }
  }

  for (const tasks of groups.values()) {
    // Derularea depinde doar de latimea paginii: pentru ea nu trebuie masurat niciun element
    const ids = [
      ...new Set(
        tasks.flatMap((t) => (t.finding.kind === 'derulare-orizontala' ? [] : t.finding.ids)),
      ),
    ];
    const measured = new Map<number, LayoutSnapshot>();
    const measure = async (width: number): Promise<LayoutSnapshot> => {
      const known = measured.get(width);
      if (known) return known;
      await resize(width);
      const snap = (await page.evaluate(`(${MEASURE_IDS_SCRIPT})(${JSON.stringify(ids)})`)) as Omit<
        LayoutSnapshot,
        'width'
      >;
      const result = { ...snap, width };
      measured.set(width, result);
      return result;
    };
    for (const task of tasks) {
      const isBad = async (width: number) => stateAt(task.finding, await measure(width)) === 'bad';
      const edge = await refineEdge(task.bad, task.notBad, isBad, hints, outOfTime);
      task.finding[task.side] = edge.width;
      if (!edge.exact) task.finding.details = { ...task.finding.details, approximate: true };
    }
  }
}

/** Masuratori goale: doar ca sa aflam daca un semnal depinde de latime (`stateAt` != null). */
const emptySnapshot: LayoutSnapshot = {
  width: 0,
  viewportWidth: 0,
  scrollWidth: 0,
  rootClipsX: false,
  elements: [],
  overflowing: [],
  truncated: false,
};

/**
 * Prin Chrome DevTools Protocol:
 *   - regulile @media ale paginii: pentru fiecare, textul, fisierul CSS din care vine si
 *     conditiile de latime, in pixeli (em si rem sunt convertite de browser);
 *   - daca pagina asculta evenimentul "resize" al ferestrei (scripturi care se refac cand se
 *     schimba latimea; vezi SETTLE_SCRIPT).
 */
async function readPageInfo(
  page: Page,
): Promise<{ medias: MediaRuleInfo[]; resizeListeners: boolean }> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { medias } = await cdp.send('CSS.getMediaQueries');
    let resizeListeners = true;
    try {
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
      if (result.objectId) {
        const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
          objectId: result.objectId,
        });
        resizeListeners = listeners.some((l) => l.type === 'resize');
      }
    } catch {
      // Nu stim: presupunem ca pagina asculta (asteptarea mai lunga, dar sigura)
    }
    const pageUrl = page.url();
    const rules = medias.map((media) => ({
      text: media.text,
      source: media.sourceURL && media.sourceURL !== pageUrl ? media.sourceURL : null,
      expressions: (media.mediaList ?? []).flatMap((query) =>
        query.expressions.map((e) => ({
          feature: e.feature,
          // Valoarea exacta in px (ex. 767.98); pentru em / rem, cea calculata de browser
          px: e.unit === 'px' ? e.value : (e.computedLength ?? e.value * 16),
        })),
      ),
    }));
    return { medias: rules, resizeListeners };
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * Descrie elementele fiecarui semnal si face capturile. Selectorii si textul nu depind de
 * latime (ii citim o data); pozitiile da, deci pentru fiecare captura fereastra revine la
 * latimea problemei. Elementele fixe (meniuri lipite, bannere) sunt ascunse in capturi.
 */
async function describeAndCapture(
  page: Page,
  findings: LayoutFinding[],
  resize: Resize,
  maxScreenshots: number,
): Promise<LayoutIssueResult[]> {
  const allIds = [...new Set(findings.flatMap((f) => f.ids))];
  const described = new Map<number, Described>();
  if (allIds.length > 0) {
    const list = (await page.evaluate(
      `(${DESCRIBE_SCRIPT})(${JSON.stringify(allIds)})`,
    )) as Array<Described | null>;
    allIds.forEach((id, i) => {
      const d = list[i];
      if (d) described.set(id, d);
    });
  }

  const results: LayoutIssueResult[] = findings.map((f) => {
    const elements = f.ids
      .map((id) => described.get(id))
      .filter((d): d is Described => Boolean(d))
      .map(({ selector, htmlSnippet, text }) => ({ selector, htmlSnippet, text }));
    return {
      kind: f.kind,
      level: f.level,
      widthMin: f.widthMin,
      widthMax: f.widthMax,
      elements,
      details: f.details,
      boxes: [],
      image: null,
      fingerprint: fingerprintOf(f.kind, elements, f),
    };
  });

  // Capturile: cele mai importante semnale (sunt deja ordonate), grupate pe latime
  const toCapture = findings
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.captureWidth !== null && f.ids.some((id) => described.has(id)))
    .slice(0, maxScreenshots);
  const byWidth = new Map<number, Array<{ f: LayoutFinding; index: number }>>();
  for (const item of toCapture) {
    const list = byWidth.get(item.f.captureWidth!) ?? [];
    list.push(item);
    byWidth.set(item.f.captureWidth!, list);
  }

  try {
    for (const [width, items] of byWidth) {
      await resize(width);
      await page.evaluate(HIDE_OVERLAYS_SCRIPT);
      for (const { f, index } of items) {
        const ids = f.ids.filter((id) => described.has(id));
        const now = (await page.evaluate(
          `(${DESCRIBE_SCRIPT})(${JSON.stringify(ids)})`,
        )) as Array<Described | null>;
        // Derularea: conteaza elementul intreg (ex. containerul prea lat), nu doar textul lui
        const whole = f.kind === 'derulare-orizontala';
        const boxes = now
          .filter((d): d is Described => Boolean(d))
          .map((d) => (whole ? d.elementBox : d.box));
        if (boxes.length === 0) continue;
        const pageSize = (await page.evaluate(
          '[document.documentElement.scrollWidth, document.documentElement.scrollHeight, document.documentElement.clientWidth]',
        )) as [number, number, number];
        const crop = cropAround(boxes, pageSize[0], pageSize[1]);
        if (!crop) continue;
        const data = await page.screenshot({
          type: 'jpeg',
          quality: CROP_QUALITY,
          fullPage: true,
          clip: { x: crop[0], y: crop[1], width: crop[2], height: crop[3] },
        });
        const result = results[index]!;
        result.image = {
          data,
          format: 'jpeg',
          width: crop[2],
          height: crop[3],
          viewportWidth: width,
        };
        result.boxes = boxes.map((b) => toImageBox(b, crop)).filter((b): b is ElementBox => !!b);
        if (f.kind === 'derulare-orizontala' || f.kind === 'taiat-la-marginea-paginii') {
          const edge = pageSize[2] - crop[0];
          if (edge > 0 && edge < crop[2]) result.details = { ...result.details, edgeX: edge };
        }
      }
      await page.evaluate(RESTORE_SCRIPT);
    }
  } catch {
    // O captura nereusita nu strica verificarea: semnalele raman, fara imagine
    await page.evaluate(RESTORE_SCRIPT).catch(() => {});
  }
  return results;
}

/** Zona capturii: chenarul tuturor elementelor, cu margine, in interiorul paginii. */
export function cropAround(boxes: Rect[], pageWidth: number, pageHeight: number): Rect | null {
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b[0])) - CROP_MARGIN);
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b[1])) - CROP_MARGIN);
  const x1 = Math.min(pageWidth, Math.max(...boxes.map((b) => b[0] + b[2])) + CROP_MARGIN);
  const y1 = Math.min(
    pageHeight,
    Math.max(...boxes.map((b) => b[1] + b[3])) + CROP_MARGIN,
    y0 + CROP_MAX_HEIGHT,
  );
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return [x0, y0, x1 - x0, y1 - y0];
}

/** Chenarul unui element in coordonatele capturii (null = in afara ei). */
function toImageBox(box: Rect, crop: Rect): ElementBox | null {
  const x = Math.max(0, box[0] - crop[0]);
  const y = Math.max(0, box[1] - crop[1]);
  const right = Math.min(crop[2], box[0] + box[2] - crop[0]);
  const bottom = Math.min(crop[3], box[1] + box[3] - crop[1]);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Amprenta semnalului: acelasi tip pe aceleasi elemente da aceeasi amprenta in scanari
 * diferite (pentru comparatia inainte / dupa). Semnalele fara elemente (ex. meta viewport,
 * media queries) se recunosc dupa detaliile lor.
 */
function fingerprintOf(kind: string, elements: LayoutElement[], finding: LayoutFinding): string {
  const parts =
    elements.length > 0
      ? elements.map((e) => e.selector).sort()
      : [JSON.stringify(finding.details.rules ?? finding.details.metaViewport ?? '')];
  return createHash('sha256')
    .update([kind, ...parts].join('|'))
    .digest('hex')
    .slice(0, 16);
}
