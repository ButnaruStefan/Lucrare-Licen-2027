/**
 * Regulile verificarii aspectului paginii: functii simple (fara browser), care primesc
 * masuratorile paginii la mai multe latimi ale ferestrei si gasesc defectele de aranjare.
 * Le foloseste `layout-audit.ts`; testele le verifica direct, cu masuratori inventate.
 *
 * Metoda vine din lucrarea ReDeCheck (Walsh, Kapfhammer, McMinn, ISSTA 2017): nu stim cum a
 * vrut designerul sa arate pagina, deci o comparam CU EA INSASI, la latimi vecine. Daca doua
 * elemente se suprapun la toate latimile, e un efect voit (ex. text peste o imagine); daca stau
 * separat la 900 px si se suprapun la 840 px, e aproape sigur un defect.
 *
 * Tipurile de semnale (vezi si `LAYOUT_ISSUE_KINDS` din pachetul comun):
 *   - derulare-orizontala       (RLF 3 din lucrare, "viewport protrusion"; web.dev);
 *   - taiat-la-marginea-paginii (RLF 3, cand pagina ascunde derularea cu overflow-x: hidden);
 *   - elemente-suprapuse        (RLF 1, "element collision");
 *   - iese-din-container        (RLF 2, "element protrusion", continut taiat de overflow: hidden);
 *   - media-queries-suprapuse   (cauza din RLF 4: max-width: N si min-width: N, active la N px);
 *   - fara-meta-viewport, meta-viewport-latime-fixa (web.dev, MDN).
 *
 * Toate pragurile de mai jos sunt alegeri proprii W4A (nu vin din lucrare), cu motivul scris.
 */
import type { Breakpoint, LayoutDetails, LayoutIssueKind, LayoutLevel } from '@ro-a11y/shared';

/** Un dreptunghi in pixeli CSS, fata de coltul paginii: [x, y, latime, inaltime]. */
export type Rect = [number, number, number, number];

/** Un element masurat in pagina, la o anumita latime a ferestrei. */
export interface MeasuredElement {
  /** Acelasi element are acelasi numar la toate latimile (tinut minte in pagina). */
  id: number;
  /** Cel mai apropiat stramos care e si el masurat (null = niciunul). */
  parent: number | null;
  /** Ce fel de continut are: text, imagine/video/iframe, control de formular. */
  kind: 'text' | 'media' | 'control';
  /** Link, buton, camp de formular: se poate folosi. */
  interactive: boolean;
  /** Fix pe ecran (position: fixed / sticky, el sau un stramos): se misca la derulare. */
  fixed: boolean;
  /** Taiere voita a textului (text-overflow: ellipsis sau -webkit-line-clamp). */
  ellipsis: boolean;
  /**
   * Abia se vede (opacitate sau culoare aproape transparenta): de obicei un decor, ex. un
   * cuvant mare, estompat, in spatele subsolului. Nu il comparam cu celelalte elemente.
   */
  faint: boolean;
  /** Intr-un container cu derulare proprie pe orizontala (overflow-x: auto / scroll). */
  inScroller: boolean;
  /** Caseta continutului: randurile de text, imaginea sau controlul. */
  rects: Rect[];
  /** Partea vizibila a continutului (taiata de containerele cu overflow, fara html/body). */
  visible: Rect[];
  /** Cel mai apropiat container care TAIE continutul (overflow: hidden / clip), fara html/body. */
  clip: { id: number; box: Rect } | null;
}

/** Masuratorile paginii la o latime a ferestrei. */
export interface LayoutSnapshot {
  /** Latimea ferestrei ceruta browserului. */
  width: number;
  /** Latimea zonei vizibile a paginii (fara bara de derulare verticala). */
  viewportWidth: number;
  /** Latimea totala a paginii: mai mare decat viewportWidth = derulare orizontala. */
  scrollWidth: number;
  /** Pagina ascunde derularea orizontala (overflow-x: hidden / clip pe html sau body). */
  rootClipsX: boolean;
  elements: MeasuredElement[];
  /**
   * Elementele (oricare, nu doar cele cu continut) care ies din fereastra spre dreapta, fara
   * un stramos care iese si el: cauza derularii orizontale. Cele mai late primele.
   */
  overflowing: number[];
  /** Pagina avea mai multe elemente decat masuram (ne-am oprit la limita). */
  truncated: boolean;
}

/** O conditie de latime dintr-o regula @media, citita din browser (Chrome DevTools Protocol). */
export interface MediaRuleInfo {
  text: string;
  source: string | null;
  expressions: Array<{ feature: string; px: number }>;
}

/** Un semnal gasit, inainte de descrierea elementelor si de captura. */
export interface LayoutFinding {
  kind: LayoutIssueKind;
  level: LayoutLevel;
  widthMin: number | null;
  widthMax: number | null;
  /** Elementele implicate (numerele lor din pagina). */
  ids: number[];
  /** Latimea la care se face captura (mijlocul intervalului), null = fara captura. */
  captureWidth: number | null;
  details: LayoutDetails;
}

/** Intervalul de latimi verificat: cel din lucrarea ReDeCheck ("320–1400 pixels"). */
export const MIN_WIDTH = 320;
export const MAX_WIDTH = 1400;
/** Pasul dintre latimi: tot din lucrare ("a step size of 60 pixels"). */
export const WIDTH_STEP = 60;
/** Cate latimi in plus, de la breakpoint-urile paginii (alegere proprie: limita de timp). */
export const MAX_BREAKPOINT_WIDTHS = 16;
/**
 * Sub cati pixeli NU consideram o suprapunere sau o iesire (alegere proprie): rotunjirile si
 * marginile care doar se ating dau 1-2 px, fara sa se vada nimic.
 */
export const TOLERANCE_PX = 3;
/**
 * Cat din inaltimea unui rand de text pastram la compararea suprapunerilor: doar mijlocul
 * randului, unde stau literele (alegere proprie, dupa probe pe site-uri reale). Caseta unui rand
 * e cat inaltimea fontului (cu spatiul pentru accente si codite), deci doua randuri vecine "se
 * ating" adesea cu cativa px fara sa se vada nimic: pe w3.org/WAI, linkurile de pe randuri
 * vecine ale aceluiasi paragraf aveau casetele suprapuse cu 3-13 px.
 */
export const TEXT_CORE_RATIO = 0.5;

/** Mijlocul unui rand de text (TEXT_CORE_RATIO din inaltime, centrat). */
function textCore(r: Rect): Rect {
  const h = r[3] * TEXT_CORE_RATIO;
  return [r[0], r[1] + (r[3] - h) / 2, r[2], h];
}

/** Ce comparam la suprapuneri: mijlocul randurilor de text, casetele intregi in rest. */
function collisionRects(e: MeasuredElement): Rect[] {
  return e.kind === 'text' ? e.visible.map(textCore) : e.visible;
}

/** Cate semnale pastram, cel mult, din fiecare tip si in total (alegere proprie). */
export const MAX_ISSUES_PER_KIND = 20;
export const MAX_ISSUES = 60;

// ─── Latimile verificate ─────────────────────────────────────────────────────────────────

/** Breakpoint-urile paginii, din regulile @media (fara dubluri). */
export function parseBreakpoints(medias: MediaRuleInfo[]): Breakpoint[] {
  const seen = new Map<string, Breakpoint>();
  for (const media of medias) {
    for (const e of media.expressions) {
      if (e.feature !== 'min-width' && e.feature !== 'max-width' && e.feature !== 'width') continue;
      if (!Number.isFinite(e.px) || e.px <= 0) continue;
      const key = `${e.feature}|${e.px}|${media.text}`;
      if (!seen.has(key)) {
        seen.set(key, { feature: e.feature, px: e.px, text: media.text, source: media.source });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.px - b.px || a.feature.localeCompare(b.feature));
}

/**
 * Latimile la care masuram pagina, de la mare la mic: 1400, 1340, ..., 320 (pas de 60 px),
 * plus latimile de o parte si de alta a fiecarui breakpoint al paginii (acolo se strica cel mai
 * des aranjarea). Ex. "min-width: 768px" e activa de la 768 px: verificam 767 si 768.
 */
export function sweepWidths(breakpoints: Breakpoint[]): number[] {
  const widths = new Set<number>();
  for (let w = MAX_WIDTH; w >= MIN_WIDTH; w -= WIDTH_STEP) widths.add(w);
  widths.add(MIN_WIDTH);

  let extra = 0;
  for (const pair of transitionPairs(breakpoints)) {
    for (const w of pair) {
      if (extra >= MAX_BREAKPOINT_WIDTHS) break;
      if (w < MIN_WIDTH || w > MAX_WIDTH || widths.has(w)) continue;
      widths.add(w);
      extra++;
    }
  }
  return [...widths].sort((a, b) => b - a);
}

/**
 * Pentru fiecare breakpoint, cele doua latimi intre care se schimba regulile: "min-width: 768px"
 * e activa de la 768 px, deci [767, 768]; "max-width: 768px" e activa pana la 768 px, deci
 * [768, 769]. Fara dubluri; cele folosite de mai multe reguli primele.
 */
export function transitionPairs(breakpoints: Breakpoint[]): Array<[number, number]> {
  const counts = new Map<number, { count: number; pair: [number, number] }>();
  for (const bp of breakpoints) {
    const pair: [number, number] =
      bp.feature === 'min-width'
        ? [Math.ceil(bp.px) - 1, Math.ceil(bp.px)]
        : [Math.floor(bp.px), Math.floor(bp.px) + 1];
    const entry = counts.get(pair[0]) ?? { count: 0, pair };
    entry.count++;
    counts.set(pair[0], entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.pair[0] - b.pair[0])
    .map((e) => e.pair);
}

// ─── Ajutoare ────────────────────────────────────────────────────────────────────────────

/** Partea comuna a doua dreptunghiuri (null = nu se ating). */
export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a[0], b[0]);
  const y = Math.max(a[1], b[1]);
  const right = Math.min(a[0] + a[2], b[0] + b[2]);
  const bottom = Math.min(a[1] + a[3], b[1] + b[3]);
  return right > x && bottom > y ? [x, y, right - x, bottom - y] : null;
}

/** Cel mai mare spatiu comun dintre continuturile a doua elemente (null = nu se suprapun). */
function overlapOf(a: Rect[], b: Rect[]): { width: number; height: number } | null {
  let best: { width: number; height: number } | null = null;
  for (const ra of a) {
    for (const rb of b) {
      const i = intersect(ra, rb);
      if (!i || i[2] < TOLERANCE_PX || i[3] < TOLERANCE_PX) continue;
      if (!best || i[2] * i[3] > best.width * best.height) best = { width: i[2], height: i[3] };
    }
  }
  return best;
}

/** Cu cati pixeli iese continutul din dreptunghiul `box` (0 = e complet inauntru). */
function overflowBeyond(rects: Rect[], box: Rect): number {
  let worst = 0;
  for (const r of rects) {
    worst = Math.max(
      worst,
      box[0] - r[0],
      r[0] + r[2] - (box[0] + box[2]),
      box[1] - r[1],
      r[1] + r[3] - (box[1] + box[3]),
    );
  }
  return worst;
}

/** Starea unui semnal la o latime: stricat, in regula, sau elementul nu se vede (nu comparam). */
export type State = 'bad' | 'good' | 'absent';

/** Pagina se deruleaza pe orizontala (e mai lata decat fereastra si nu ascunde derularea). */
function scrollsAt(snap: Pick<LayoutSnapshot, 'rootClipsX' | 'scrollWidth' | 'viewportWidth'>) {
  return !snap.rootClipsX && snap.scrollWidth > snap.viewportWidth + 1;
}

/** Fereastra, ca dreptunghi (inalta cat sa cuprinda toata pagina). */
function viewportRect(snap: Pick<LayoutSnapshot, 'viewportWidth'>): Rect {
  return [0, -1e7, snap.viewportWidth, 2e7];
}

/** Taiat la marginea paginii: starea unui element la o latime. */
function edgeState(snap: LayoutSnapshot, e: MeasuredElement | undefined): State {
  if (!e || e.fixed || e.inScroller || e.visible.length === 0) return 'absent';
  const page = viewportRect(snap);
  if (!e.visible.some((r) => intersect(r, page))) return 'absent'; // complet afara: ascuns voit
  if (overflowBeyond(e.visible, page) <= TOLERANCE_PX) return 'good';
  // Daca pagina se deruleaza, continutul se poate vedea: semnalul e "derulare-orizontala"
  return scrollsAt(snap) ? 'absent' : 'bad';
}

/** Elemente suprapuse: starea unei perechi la o latime. */
function collisionState(a: MeasuredElement | undefined, b: MeasuredElement | undefined): State {
  const shown = (e: MeasuredElement | undefined): e is MeasuredElement =>
    !!e && !e.fixed && !e.faint && e.visible.length > 0;
  if (!shown(a) || !shown(b)) return 'absent';
  return overlapOf(collisionRects(a), collisionRects(b)) ? 'bad' : 'good';
}

/** Iese din container: starea unui element la o latime. */
function protrusionState(e: MeasuredElement | undefined): State {
  if (!e || e.fixed || e.kind === 'media' || e.ellipsis) return 'absent';
  if (!e.clip) return 'good';
  const box = e.clip.box;
  if (!e.rects.some((r) => intersect(r, box))) {
    // Complet afara pe orizontala: de obicei ascuns voit (ex. un slide de carusel).
    // Complet sub (sau deasupra) containerului: randul a "cazut" si nu se mai vede.
    const below = e.rects.every((r) => r[1] >= box[1] + box[3] || r[1] + r[3] <= box[1]);
    const sideways = e.rects.some((r) => r[0] >= box[0] + box[2] || r[0] + r[2] <= box[0]);
    return below && !sideways ? 'bad' : 'absent';
  }
  return overflowBeyond(e.rects, box) > TOLERANCE_PX ? 'bad' : 'good';
}

/**
 * Starea unui semnal deja gasit, la o latime noua (pentru cautarea capetelor exacte). Primeste
 * masuratorile doar ale elementelor semnalului. null = semnalul nu depinde de latime.
 */
export function stateAt(finding: LayoutFinding, snap: LayoutSnapshot): State | null {
  const map = byId(snap);
  const [a, b] = finding.ids;
  switch (finding.kind) {
    case 'derulare-orizontala':
      return scrollsAt(snap) ? 'bad' : 'good';
    case 'taiat-la-marginea-paginii':
      return edgeState(snap, map.get(a!));
    case 'elemente-suprapuse':
      return collisionState(map.get(a!), map.get(b!));
    case 'iese-din-container':
      return protrusionState(map.get(a!));
    default:
      return null;
  }
}

/**
 * Intervalele in care un semnal e "rau", PORNIND de la o latime unde era "bun": de la mare la
 * mic, rau imediat dupa bun inseamna ca aranjarea s-a stricat cand fereastra s-a ingustat.
 * Un semnal rau chiar la cea mai mare latime (sau dupa ce elementul lipsea) nu e raportat:
 * nu avem cu ce compara (ex. o suprapunere voita, prezenta peste tot).
 */
function brokenRuns(states: State[]): Array<{ from: number; to: number }> {
  const runs: Array<{ from: number; to: number }> = [];
  for (let i = 1; i < states.length; i++) {
    if (states[i] !== 'bad' || states[i - 1] !== 'good') continue;
    let j = i;
    while (j + 1 < states.length && states[j + 1] === 'bad') j++;
    runs.push({ from: i, to: j });
    i = j;
  }
  return runs;
}

/** Latimea din mijlocul unui interval (acolo facem captura). */
function middle(widths: number[], from: number, to: number): number {
  return widths[Math.floor((from + to) / 2)]!;
}

function byId(snapshot: LayoutSnapshot): Map<number, MeasuredElement> {
  return new Map(snapshot.elements.map((e) => [e.id, e]));
}

function isAncestor(map: Map<number, MeasuredElement>, ancestor: number, id: number): boolean {
  for (let p = map.get(id)?.parent ?? null; p !== null; p = map.get(p)?.parent ?? null) {
    if (p === ancestor) return true;
  }
  return false;
}

// ─── Regulile ────────────────────────────────────────────────────────────────────────────

/**
 * Derularea orizontala: la latimea X pagina e mai lata decat fereastra (si nu ascunde
 * derularea). Raportata la orice latime (web.dev: "Forcing the user to scroll horizontally
 * [...] causes a poor user experience"), cate un semnal pentru fiecare interval de latimi.
 * Elementele vinovate (masurate in pagina, `overflowing`): cele care ies din fereastra si al
 * caror stramos nu iese si el (ex. un container cu latime fixa, nu fiecare paragraf din el).
 */
export function findHorizontalScroll(snapshots: LayoutSnapshot[]): LayoutFinding[] {
  const widths = snapshots.map((s) => s.width);
  const scrolls = snapshots.map(scrollsAt);
  const findings: LayoutFinding[] = [];
  for (let i = 0; i < scrolls.length; i++) {
    if (!scrolls[i]) continue;
    let j = i;
    while (j + 1 < scrolls.length && scrolls[j + 1]) j++;
    const rep = Math.floor((i + j) / 2);
    const snap = snapshots[rep]!;
    const offenders = snap.overflowing.slice(0, 5);
    findings.push({
      kind: 'derulare-orizontala',
      // Fara un element vinovat gasit (ex. doar cativa px de la o margine), e de confirmat
      level: offenders.length > 0 ? 'visible' : 'possible',
      widthMin: widths[j]!,
      widthMax: widths[i]!,
      ids: offenders,
      captureWidth: offenders.length > 0 ? snap.width : null,
      details: {
        pageWidth: snap.scrollWidth,
        overflowPx: snap.scrollWidth - snap.viewportWidth,
      },
    });
    i = j;
  }
  return findings;
}

/**
 * Taiat la marginea paginii: pagina ascunde derularea (overflow-x: hidden), iar un element
 * trece de marginea ei, deci o parte din el nu se mai vede deloc. Doar elementele PARTIAL
 * afara (unul complet afara e de obicei ascuns voit, ex. un meniu care intra din lateral) si
 * doar daca la latimea vecina, mai mare, elementul era intreg.
 */
export function findEdgeCuts(snapshots: LayoutSnapshot[]): LayoutFinding[] {
  const widths = snapshots.map((s) => s.width);
  const ids = new Set(snapshots.flatMap((s) => s.elements.map((e) => e.id)));
  const maps = snapshots.map(byId);
  const findings: LayoutFinding[] = [];
  for (const id of ids) {
    const states = snapshots.map((snap, i) => edgeState(snap, maps[i]!.get(id)));
    for (const run of brokenRuns(states)) {
      const rep = Math.floor((run.from + run.to) / 2);
      const snap = snapshots[rep]!;
      const e = maps[rep]!.get(id)!;
      findings.push({
        kind: 'taiat-la-marginea-paginii',
        level: e.kind === 'media' ? 'possible' : 'visible',
        widthMin: widths[run.to]!,
        widthMax: widths[run.from]!,
        ids: [id],
        captureWidth: middle(widths, run.from, run.to),
        details: {
          overflowPx: Math.round(overflowBeyond(e.visible, viewportRect(snap))),
        },
      });
    }
  }
  return findings;
}

/**
 * Elemente suprapuse (RLF 1, "element collision"): continutul a doua elemente (randurile de
 * text, imaginile, controalele) se suprapune la latimea X, dar nu si la latimea vecina, mai mare.
 * Comparam continutul, nu casetele intregi: lucrarea arata ca multe suprapuneri gasite in DOM
 * nu se vad, fiind doar spatiu gol ("invisible padding"). La text, doar mijlocul randurilor
 * (TEXT_CORE_RATIO), iar textul abia vizibil (decor estompat) nu e comparat.
 */
export function findCollisions(snapshots: LayoutSnapshot[]): LayoutFinding[] {
  const widths = snapshots.map((s) => s.width);
  const maps = snapshots.map(byId);
  const overlaps = snapshots.map((snap, i) => collisionsAt(snap, maps[i]!));
  const keys = new Set(overlaps.flatMap((m) => [...m.keys()]));
  const findings: LayoutFinding[] = [];

  for (const key of keys) {
    const [a, b] = key.split('-').map(Number) as [number, number];
    const states = snapshots.map((_, i): State => {
      if (overlaps[i]!.has(key)) return 'bad';
      const ea = maps[i]!.get(a);
      const eb = maps[i]!.get(b);
      const shown = (e: MeasuredElement | undefined) =>
        e && !e.fixed && !e.faint && e.visible.length > 0;
      return shown(ea) && shown(eb) ? 'good' : 'absent';
    });
    for (const run of brokenRuns(states)) {
      const rep = Math.floor((run.from + run.to) / 2);
      const ea = maps[rep]!.get(a)!;
      const eb = maps[rep]!.get(b)!;
      findings.push({
        kind: 'elemente-suprapuse',
        // Text peste text se vede sigur; cu o imagine poate fi un efect voit
        level: ea.kind !== 'media' && eb.kind !== 'media' ? 'visible' : 'possible',
        widthMin: widths[run.to]!,
        widthMax: widths[run.from]!,
        ids: [a, b],
        captureWidth: middle(widths, run.from, run.to),
        details: { overlap: overlaps[rep]!.get(key)! },
      });
    }
  }
  return findings;
}

/** Perechile de elemente care se suprapun la o latime: "a-b" (a < b) -> cat se suprapun. */
function collisionsAt(
  snap: LayoutSnapshot,
  map: Map<number, MeasuredElement>,
): Map<string, { width: number; height: number }> {
  const result = new Map<string, { width: number; height: number }>();
  const candidates = snap.elements.filter((e) => !e.fixed && !e.faint && e.visible.length > 0);
  // Impartim pagina in benzi orizontale, ca sa nu comparam fiecare element cu toate celelalte
  const BAND = 200;
  const bands = new Map<number, MeasuredElement[]>();
  for (const e of candidates) {
    const bandIds = new Set<number>();
    for (const r of e.visible) {
      for (let y = Math.floor(r[1] / BAND); y <= Math.floor((r[1] + r[3]) / BAND); y++) {
        bandIds.add(y);
      }
    }
    for (const band of bandIds) {
      const list = bands.get(band) ?? [];
      list.push(e);
      bands.set(band, list);
    }
  }
  for (const list of bands.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i]!;
        const y = list[j]!;
        const a = Math.min(x.id, y.id);
        const b = Math.max(x.id, y.id);
        const key = `${a}-${b}`;
        if (result.has(key)) continue;
        if (isAncestor(map, x.id, y.id) || isAncestor(map, y.id, x.id)) continue;
        const overlap = overlapOf(collisionRects(x), collisionRects(y));
        if (overlap) result.set(key, overlap);
      }
    }
  }
  return result;
}

/**
 * Iese din container (RLF 2, "element protrusion"): textul sau un control iese din containerul
 * lui, care il taie (overflow: hidden), deci o parte (sau tot, daca a cazut sub container) nu se
 * mai vede; la latimea vecina, mai mare, era intreg. Exemplul din lucrare: linkurile din meniu ies din bara lui si
 * "become unclickable". Nu raportam: imaginile (decuparea lor e de obicei voita), textul taiat
 * voit cu "..." (ellipsis) si elementele complet afara (ex. un slide de carusel ascuns).
 */
export function findContainerProtrusions(snapshots: LayoutSnapshot[]): LayoutFinding[] {
  const widths = snapshots.map((s) => s.width);
  const maps = snapshots.map(byId);
  const ids = new Set(snapshots.flatMap((s) => s.elements.map((e) => e.id)));
  const findings: LayoutFinding[] = [];
  for (const id of ids) {
    const states = maps.map((map) => protrusionState(map.get(id)));
    for (const run of brokenRuns(states)) {
      const rep = Math.floor((run.from + run.to) / 2);
      const e = maps[rep]!.get(id)!;
      findings.push({
        kind: 'iese-din-container',
        level: e.interactive ? 'visible' : 'possible',
        widthMin: widths[run.to]!,
        widthMax: widths[run.from]!,
        ids: [id],
        captureWidth: middle(widths, run.from, run.to),
        details: { overflowPx: Math.round(overflowBeyond(e.rects, e.clip!.box)) },
      });
    }
  }
  return findings;
}

/**
 * Media queries suprapuse (cauza din RLF 4, exemplul din lucrare): "max-width: 768px" si
 * "min-width: 768px" sunt AMBELE active la exact 768 px (ambele includ valoarea), deci la acea
 * latime se aplica doua seturi de reguli. Comparam valorile exacte (767.98px nu se suprapune
 * cu 768px, de aceea unele framework-uri folosesc astfel de valori).
 */
export function findMediaClashes(medias: MediaRuleInfo[]): LayoutFinding[] {
  const mins = new Map<number, MediaRuleInfo>();
  const maxs = new Map<number, MediaRuleInfo>();
  for (const media of medias) {
    for (const e of media.expressions) {
      if (e.feature === 'min-width' && !mins.has(e.px)) mins.set(e.px, media);
      if (e.feature === 'max-width' && !maxs.has(e.px)) maxs.set(e.px, media);
    }
  }
  const findings: LayoutFinding[] = [];
  for (const [px, min] of [...mins].sort((a, b) => a[0] - b[0])) {
    const max = maxs.get(px);
    if (!max || max === min) continue; // aceeasi regula (min si max egale) e voita
    const w = Math.round(px);
    findings.push({
      kind: 'media-queries-suprapuse',
      level: 'possible',
      widthMin: w,
      widthMax: w,
      ids: [],
      captureWidth: null,
      details: {
        rules: [
          { text: max.text, source: max.source },
          { text: min.text, source: min.source },
        ],
      },
    });
  }
  return findings;
}

/**
 * Meta viewport (web.dev: "Pages optimized for a variety of devices must include a meta
 * viewport tag"; MDN: width=device-width = latimea ecranului). Fara ea, telefonul afiseaza
 * pagina pe o latime mare (~980 px), micsorata. Cu o latime fixa (ex. width=1024), la fel.
 */
export function checkMetaViewport(content: string | null): LayoutFinding[] {
  const base = { widthMin: null, widthMax: null, ids: [], captureWidth: null };
  if (content === null) {
    return [{ ...base, kind: 'fara-meta-viewport', level: 'visible', details: {} }];
  }
  if (/(^|[,;\s])width\s*=\s*\d/i.test(content)) {
    return [
      {
        ...base,
        kind: 'meta-viewport-latime-fixa',
        level: 'possible',
        details: { metaViewport: content },
      },
    ];
  }
  return [];
}

const LEVEL_ORDER: LayoutLevel[] = ['visible', 'possible', 'info'];

/**
 * Toate regulile, pe masuratorile paginii. Semnalele sunt ordonate (sigure intai, apoi cele de
 * la latimi mai mari) si limitate, ca o pagina foarte stricata sa nu dea sute de semnale.
 */
export function detectLayoutIssues(
  snapshots: LayoutSnapshot[],
  medias: MediaRuleInfo[],
  metaViewport: string | null,
): LayoutFinding[] {
  const all = [
    ...checkMetaViewport(metaViewport),
    ...findHorizontalScroll(snapshots),
    ...findEdgeCuts(snapshots),
    ...findCollisions(snapshots),
    ...findContainerProtrusions(snapshots),
    ...findMediaClashes(medias),
  ];
  all.sort(
    (a, b) =>
      LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
      (b.widthMax ?? Infinity) - (a.widthMax ?? Infinity),
  );
  const perKind = new Map<LayoutIssueKind, number>();
  const kept: LayoutFinding[] = [];
  for (const finding of all) {
    const n = perKind.get(finding.kind) ?? 0;
    if (n >= MAX_ISSUES_PER_KIND || kept.length >= MAX_ISSUES) continue;
    perKind.set(finding.kind, n + 1);
    kept.push(finding);
  }
  return kept;
}

// ─── Capetele exacte ale intervalului ────────────────────────────────────────────────────

/** Cate perechi de breakpoint-uri incercam intai, la cautarea unui capat (alegere proprie). */
export const MAX_HINT_PAIRS = 2;

/**
 * Capatul exact al unui interval stricat: intre latimea `bad` (semnalul apare) si latimea vecina
 * `notBad` (nu apare), gaseste ultima latime la care semnalul apare, langa `notBad`. Cautare
 * binara, ca in lucrarea ReDeCheck ("a binary search [...] to find the exact viewport width"):
 * pe un gol de 60 px, cel mult 6 masuratori.
 *
 * Intai incearca breakpoint-urile paginii din interval (`hints`, perechi de latimi intre care se
 * schimba regulile CSS): aranjarea se strica aproape mereu la un breakpoint, deci capatul e
 * adesea gasit din 2 masuratori. Daca nu e acolo, fiecare masuratoare tot ingusteaza intervalul.
 *
 * Presupune o singura trecere intre cele doua latimi (daca sunt mai multe, gaseste una dintre ele).
 * `stop()` = s-a terminat timpul: intoarce capatul gasit pana atunci, cu `exact: false`.
 */
export async function refineEdge(
  bad: number,
  notBad: number,
  isBad: (width: number) => Promise<boolean>,
  hints: Array<[number, number]> = [],
  stop: () => boolean = () => false,
): Promise<{ width: number; exact: boolean }> {
  const probes: number[] = [];
  for (const pair of hints
    .filter((p) => between(p[0], bad, notBad) || between(p[1], bad, notBad))
    .slice(0, MAX_HINT_PAIRS)) {
    // Intai latimea din pereche mai apropiata de `bad`, apoi cealalta
    const [near, far] =
      Math.abs(pair[0] - bad) <= Math.abs(pair[1] - bad) ? pair : [pair[1], pair[0]];
    probes.push(near, far);
  }
  while (Math.abs(bad - notBad) > 1) {
    if (stop()) return { width: bad, exact: false };
    let probe = probes.shift();
    while (probe !== undefined && !between(probe, bad, notBad)) probe = probes.shift();
    if (probe === undefined) probe = Math.round((bad + notBad) / 2);
    if (await isBad(probe)) bad = probe;
    else notBad = probe;
  }
  return { width: bad, exact: true };
}

/** `x` e strict intre `a` si `b`. */
function between(x: number, a: number, b: number): boolean {
  return x > Math.min(a, b) && x < Math.max(a, b);
}
