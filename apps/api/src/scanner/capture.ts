/**
 * Captura paginii pentru "harta problemelor": imaginea paginii scanate si pozitia fiecarui
 * element afectat, ca interfata sa deseneze chenare peste imagine.
 *
 * Se apeleaza din scanner (`page-scan.ts`) imediat dupa axe-core, in ACEEASI sesiune de
 * browser: pagina nu se reincarca.
 *
 * De ce pe bucati si nu dintr-o singura fotografie a paginii intregi: multe site-uri moderne
 * isi schimba continutul dupa pozitia derularii:
 *   - sectiuni care apar (opacitate 0 -> 1) doar cand ajung pe ecran, uneori reversibil;
 *   - panouri "lipite" (position: sticky) care isi schimba pasii in timp ce derulezi.
 * O fotografie a paginii intregi, facuta fara derulare, le prinde in starea "de sus": goluri
 * albe in locul panourilor si sectiuni estompate. De aceea parcurgem pagina ca un om:
 *   1. derulam cate un ecran (inaltimea ferestrei), asteptam sa se aseze pagina (imaginile din
 *      ecran incarcate, animatiile CSS duse la final), iar daca pagina a reactionat la derulare
 *      (o vede un MutationObserver), mai asteptam putin efectele facute din JavaScript;
 *   2. calculam pozitia elementelor afectate IN ACEST ECRAN; fiecare element ia pozitia din
 *      primul ecran in care se vede intreg, in coordonatele acelui ecran din imagine;
 *   3. fotografiem ecranul (PNG, fara pierderi);
 *   4. dupa primul ecran ascundem elementele fixe (meniu fix, banner de cookie-uri): altfel ar
 *      aparea in fiecare ecran. La fel elementele "lipite" pe toata pagina (antet sticky).
 *   5. la final punem ecranele intr-o singura imagine WebP (intr-un canvas, in browser), continua
 *      sau ecran sub ecran (vezi mai jos), si readucem pagina cum era.
 * Ecranele se suprapun putin (SEAM_OVERLAP). La final comparam, pixel cu pixel, zona suprapusa a
 * fiecarei perechi de ecrane vecine:
 *   - daca TOATE imbinarile se potrivesc (pagina nu s-a schimbat intre ecrane) si nu exista
 *     elemente lipite in sectiunea lor, pagina e statica: o aratam ca o singura imagine continua;
 *   - altfel ecranele raman separate (o imbinare ar avea cusaturi: bucati dublate, linii intre o
 *     parte estompata si una normala); interfata le arata cu numarul si derularea fiecaruia.
 * Panourile lipite apar de mai multe ori, in pasi diferiti: asa le vede si omul cand deruleaza.
 *
 * Pe fiecare ecran, `onView` primeste elementele care tocmai au intrat intregi in ecran
 * (scannerul re-verifica acolo contrastul lor, vezi `contrast-recheck.ts`).
 *
 * Selectorii vin din axe-core (`node.target`): un sir = selector CSS in documentul principal;
 * mai multe elemente in lista = elementul e intr-un iframe; o lista in lista = Shadow DOM.
 * Elementele din iframe-uri nu primesc pozitie (ar trebui adunata si pozitia cadrului).
 * Un element cu "display: contents" (fara cutie proprie) primeste dreptunghiul continutului lui.
 */
import type { Page } from 'playwright';

/**
 * Inaltimea maxima a imaginii (toate ecranele), in pixeli. Sub limita formatului WebP (16 383 px)
 * si a desenarii in Chromium (16 384 px).
 */
export const MAX_CAPTURE_HEIGHT = 16_000;
/** Calitatea WebP (0-100); aleasa prin masuratoare: lizibila si de 2-5 ori mai mica decat PNG. */
export const CAPTURE_QUALITY = 80;
/**
 * Cat mai asteptam pe un ecran, dupa ce animatiile CSS au fost duse la final, pentru efectele
 * facute din JavaScript (nu pot fi grabite din afara). Doar pe ecranele unde pagina a reactionat
 * la derulare. Valoare aleasa prin masuratoare (0 / 150 / 300 / 600 ms).
 */
export const SCRIPT_SETTLE_MS = 300;
/**
 * Cat se suprapun doua ecrane vecine, in pixeli. Pe zona suprapusa verificam daca ecranele se
 * potrivesc la imbinare (pagina nu s-a schimbat intre ele); in acest caz pagina e aratata ca o
 * singura imagine continua. Mai mult decat un rand de text.
 */
export const SEAM_OVERLAP = 64;
/** O imbinare "se potriveste" daca cel mult atatia pixeli din zona suprapusa difera. */
export const SEAM_TOLERANCE = 0.002;
/** Cat trebuie sa difere un pixel (pe un canal de culoare, 0-255) ca sa conteze ca diferit. */
const PIXEL_TOLERANCE = 24;
/** Cat asteptam, cel mult, imaginile din ecran care inca se incarca. */
const IMAGE_WAIT_MS = 2000;
/** Atributul pus pe elementele ascunse de noi (pastreaza valoarea veche, ca sa o refacem). */
const HIDDEN_ATTR = 'data-w4a-ascuns';

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageCapture {
  image: Buffer;
  format: 'webp';
  width: number;
  /** Inaltimea imaginii = numarul ecranelor x inaltimea unui ecran. */
  height: number;
  /** Inaltimea paginii, in pixeli CSS. */
  pageHeight: number;
  /** Pagina continua dupa ultimul ecran fotografiat (limita capturii). */
  truncated: boolean;
  /** Pozitia fiecarui element IN IMAGINE (cheia: JSON.stringify(target)); null = nu se vede. */
  boxes: Map<string, ElementBox | null>;
  /**
   * Inaltimea unui ecran, daca ecranele sunt aratate separat (pagina se schimba la derulare);
   * null = pagina statica, aratata ca o singura imagine continua.
   */
  frameHeight: number | null;
  /** Pozitia derularii la care a fost fotografiat fiecare ecran ([] = imagine continua). */
  frameOffsets: number[];
  /** Pentru fiecare imbinare dintre doua ecrane, partea din pixeli care difera (0 = identice). */
  seams: number[];
  /** In cate ecrane pagina a reactionat la derulare (doar acolo am asteptat efectele). */
  reactiveFrames: number;
}

/** Cat din element se vede in ecranul curent. */
export type ElementView = 'full' | 'partial' | 'none';

export interface ViewBox extends ElementBox {
  view: ElementView;
  /** Elementul e mai mare decat ecranul (nu se poate vedea niciodata intreg). */
  oversize: boolean;
}

/**
 * Scriptul rulat IN pagina (de aceea e text, nu cod TypeScript: ruleaza in browser, ca scriptul
 * descoperirii). Primeste lista selectorilor axe si intoarce, pentru fiecare, dreptunghiul
 * elementului fata de coltul paginii si cat din el se vede in ecran, sau null daca elementul
 * nu poate fi aratat (nu exista, ascuns, intr-un iframe, ascuns de noi).
 */
export const ELEMENT_BOXES_SCRIPT = `(targets) => {
  function resolve(target) {
    if (!Array.isArray(target) || target.length !== 1) return null; // iframe sau format necunoscut
    const step = target[0];
    if (typeof step === "string") return document.querySelector(step);
    if (!Array.isArray(step)) return null;
    // Shadow DOM: fiecare selector, in afara de ultimul, gaseste "gazda" nivelului urmator
    let root = document;
    let element = null;
    for (let i = 0; i < step.length; i++) {
      if (typeof step[i] !== "string") return null;
      element = root.querySelector(step[i]);
      if (!element) return null;
      if (i < step.length - 1) {
        if (!element.shadowRoot) return null;
        root = element.shadowRoot;
      }
    }
    return element;
  }
  function hiddenByCapture(element) {
    for (let n = element; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null) {
      if (n.hasAttribute && n.hasAttribute("${HIDDEN_ATTR}")) return true;
    }
    return false;
  }
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  return targets.map((target) => {
    let element = null;
    try {
      element = resolve(target);
    } catch (e) {
      return null; // selector invalid
    }
    if (!element || hiddenByCapture(element)) return null;
    let rect = element.getBoundingClientRect();
    // "display: contents": elementul nu are cutie proprie (0 x 0), dar continutul lui se vede
    // (ex. <nav style="display:contents"> cu linkurile meniului). Luam dreptunghiul care
    // cuprinde tot continutul (Range.getBoundingClientRect).
    if ((rect.width < 1 || rect.height < 1) && getComputedStyle(element).display === "contents") {
      const range = document.createRange();
      range.selectNodeContents(element);
      rect = range.getBoundingClientRect();
    }
    if (rect.width < 1 || rect.height < 1) return null; // ascuns sau fara dimensiune
    const inX = rect.right > 0 && rect.left < vw;
    const inY = rect.bottom > 0 && rect.top < vh;
    const full = rect.left >= 0 && rect.right <= vw && rect.top >= 0 && rect.bottom <= vh;
    return {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      view: !(inX && inY) ? "none" : full ? "full" : "partial",
      oversize: rect.width > vw || rect.height > vh,
    };
  });
}`;

/** Inaltimea intregii pagini (nu doar a ferestrei), in pixeli CSS. */
const PAGE_HEIGHT_SCRIPT = `Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)`;

/**
 * Pagina are un element lipit IN SECTIUNEA LUI (position: sticky, cu un parinte mai inalt decat
 * el, dar nu cat toata pagina)? Un asemenea element se misca la derulare fara sa schimbe nimic in
 * pagina (o face CSS-ul), deci MutationObserver nu il vede; la imbinarea ecranelor ar aparea de
 * doua ori. Antetele lipite pe toata pagina nu conteaza (le ascundem dupa primul ecran).
 */
const SECTION_STICKY_SCRIPT = `(() => {
  const pageHeight = document.documentElement.scrollHeight;
  for (const el of document.querySelectorAll("body *")) {
    if (getComputedStyle(el).position !== "sticky" || !el.parentElement) continue;
    const parent = el.parentElement.getBoundingClientRect().height;
    if (parent >= pageHeight * 0.9) continue;
    if (parent > el.getBoundingClientRect().height + 1) return true;
  }
  return false;
})()`;

/**
 * Deruleaza la `top` si asteapta sa se aseze ecranul: imaginile din ecran incarcate (cu limita
 * de timp), apoi doua cadre de desenare (in ele ruleaza IntersectionObserver, care porneste
 * efectele de aparitie), apoi animatiile si tranzitiile CSS cu durata finita sunt duse la final.
 * Animatiile infinite (ex. un carusel) si cele legate de derulare sunt lasate in pace.
 *
 * Intoarce si daca pagina a REACTIONAT la derulare: un MutationObserver, pornit INAINTE de
 * derulare (altfel ar rata schimbarile facute imediat), noteaza orice schimbare de clasa, stil,
 * text sau element; o animatie CSS pornita conteaza si ea. Doar atunci scannerul mai asteapta
 * efectele facute din JavaScript (SCRIPT_SETTLE_MS); o pagina statica nu asteapta degeaba.
 * Nu conteaza schimbarile din elementele fixe sau ascunse de noi (nu apar in captura).
 */
const SCROLL_AND_SETTLE_SCRIPT = `async (top) => {
  // Schimbarile elementelor fixe (ex. butonul "inapoi sus", care apare la derulare) sau ascunse de
  // noi nu conteaza: dupa primul ecran nu apar in captura.
  function inOverlay(node) {
    for (let n = node && node.nodeType === 1 ? node : node && node.parentElement; n; n = n.parentElement) {
      if (n.hasAttribute("${HIDDEN_ATTR}") || getComputedStyle(n).position === "fixed") return true;
    }
    return false;
  }
  const changed = new Set();
  let reacted = false;
  const observer = new MutationObserver((records) => {
    for (const record of records) changed.add(record.target);
  });
  observer.observe(document.documentElement, {
    subtree: true, attributes: true, childList: true, characterData: true,
  });
  try {
    // Derulare imediata (fara animatie, chiar daca site-ul cere "scroll-behavior: smooth")
    window.scrollTo({ top, behavior: "instant" });
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const vh = window.innerHeight;
    const loading = [...document.images].filter((img) => {
      if (img.complete) return false;
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh;
    });
    await Promise.race([
      Promise.all(loading.map((img) => new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }))),
      new Promise((resolve) => setTimeout(resolve, ${IMAGE_WAIT_MS})),
    ]);
    await frame();
    await frame();
    for (const animation of document.getAnimations()) {
      try {
        const end = animation.effect && animation.effect.getComputedTiming().endTime;
        if (animation.playState !== "finished" && Number.isFinite(end)) {
          animation.finish();
          if (!inOverlay(animation.effect.target)) reacted = true;
        }
      } catch (e) {
        // animatie care nu poate fi terminata (ex. legata de derulare): o lasam asa
      }
    }
    await frame();
  } finally {
    observer.disconnect();
  }
  for (const node of changed) {
    if (!inOverlay(node)) {
      reacted = true;
      break;
    }
  }
  return { y: window.scrollY, reacted };
}`;

/**
 * Ascunde (visibility: hidden, deci fara sa miste nimic in pagina) elementele care ar aparea in
 * fiecare bucata: cele fixe si cele "lipite" pe toata inaltimea paginii (ex. antet sticky al
 * carui parinte e toata pagina). Panourile lipite doar in sectiunea lor raman vizibile.
 */
const HIDE_OVERLAYS_SCRIPT = `(() => {
  const pageHeight = document.documentElement.scrollHeight;
  let hidden = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (el.hasAttribute("${HIDDEN_ATTR}")) continue;
    const position = getComputedStyle(el).position;
    const pageSticky = position === "sticky" && el.parentElement &&
      el.parentElement.getBoundingClientRect().height >= pageHeight * 0.9;
    if (position === "fixed" || pageSticky) {
      el.setAttribute("${HIDDEN_ATTR}", el.style.getPropertyValue("visibility"));
      el.style.setProperty("visibility", "hidden", "important");
      hidden++;
    }
  }
  return hidden;
})()`;

/** Reface pagina: elementele ascunse de noi redevin vizibile, derularea revine sus. */
const RESTORE_SCRIPT = `(() => {
  for (const el of document.querySelectorAll("[${HIDDEN_ATTR}]")) {
    const before = el.getAttribute("${HIDDEN_ATTR}");
    el.style.removeProperty("visibility");
    if (before) el.style.setProperty("visibility", before);
    el.removeAttribute("${HIDDEN_ATTR}");
  }
  window.scrollTo({ top: 0, behavior: "instant" });
})()`;

/** Elementele care tocmai au intrat in ecran, oferite scannerului pentru re-verificari. */
export type OnView = (targets: unknown[]) => Promise<void>;

/** O pozitie vazuta intr-un ecran, cu cata suprafata din element se vede acolo. */
interface Seen {
  box: ElementBox;
  area: number;
}

/**
 * Parcurge pagina ecran cu ecran si intoarce ecranele, unul sub altul, ca o singura imagine
 * (fara suprapuneri si fara lipituri: fiecare ecran e exact fotografia facuta la pozitia lui).
 */
export async function capturePage(
  page: Page,
  targets: unknown[],
  onView?: OnView,
): Promise<PageCapture> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Pagina nu are o fereastra cu dimensiune fixa.');
  const frameHeight = viewport.height;
  const maxFrames = Math.max(1, Math.floor(MAX_CAPTURE_HEIGHT / frameHeight));
  const pageHeight = await page.evaluate<number>(PAGE_HEIGHT_SCRIPT);
  const sectionSticky = await page.evaluate<boolean>(SECTION_STICKY_SCRIPT);

  const keys = targets.map((t) => JSON.stringify(t));
  const decided = new Map<string, ElementBox>();
  const partial = new Map<string, Seen>();
  // Pozitia fata de coltul paginii (pentru pagina statica, aratata ca o singura imagine)
  const inPage = new Map<string, ElementBox>();
  const frames: Array<{ offset: number; image: Buffer }> = [];
  let reactiveFrames = 0;
  let reachedEnd = false;
  // Primul ecran, fotografiat din nou dupa ascunderea elementelor fixe (pentru prima imbinare)
  let firstClean: Buffer | null = null;

  try {
    // Pasul: un ecran, minus suprapunerea pe care verificam imbinarea
    for (
      let next = 0;
      frames.length < maxFrames;
      next = frames.at(-1)!.offset + frameHeight - SEAM_OVERLAP
    ) {
      const { y, reacted } = await page.evaluate<{ y: number; reacted: boolean }>(
        `(${SCROLL_AND_SETTLE_SCRIPT})(${next})`,
      );
      // Pagina nu mai avanseaza (s-a terminat sau s-a scurtat intre timp): ne oprim
      if (frames.length > 0 && y <= frames[frames.length - 1]!.offset) {
        reachedEnd = true;
        break;
      }
      // Asteptam efectele din JavaScript doar daca pagina a reactionat la derulare
      if (reacted) {
        await page.waitForTimeout(SCRIPT_SETTLE_MS);
        reactiveFrames++;
      }
      if (frames.length > 0) await page.evaluate(HIDE_OVERLAYS_SCRIPT);

      // Pozitiile, in coordonatele imaginii: ecranul nr. i incepe la i * inaltimea ecranului
      const top = frames.length * frameHeight;
      const pending = targets.filter((_, i) => !decided.has(keys[i]!));
      const views = await page.evaluate<Array<ViewBox | null>>(
        `(${ELEMENT_BOXES_SCRIPT})(${JSON.stringify(pending)})`,
      );
      const entered: unknown[] = [];
      pending.forEach((target, i) => {
        const v = views[i];
        if (!v || v.view === 'none') return;
        const key = JSON.stringify(target);
        if (!inPage.has(key)) inPage.set(key, { x: v.x, y: v.y, width: v.width, height: v.height });
        // Partea din element care se vede in acest ecran (taiata la marginile lui)
        const x1 = Math.max(0, v.x);
        const x2 = Math.min(viewport.width, v.x + v.width);
        const y1 = Math.max(0, v.y - y);
        const y2 = Math.min(frameHeight, v.y - y + v.height);
        const box = { x: x1, y: top + y1, width: x2 - x1, height: y2 - y1 };
        if (box.width < 1 || box.height < 1) return;
        if (v.view === 'full' || v.oversize) {
          decided.set(key, box);
          entered.push(target);
        } else if ((partial.get(key)?.area ?? 0) < box.width * box.height) {
          // Taiat de marginea ecranului: pastram ecranul in care se vede cel mai mult
          partial.set(key, { box, area: box.width * box.height });
        }
      });
      if (onView && entered.length > 0) await onView(entered);

      frames.push({
        offset: y,
        image: await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled' }),
      });
      if (frames.length === 1) {
        await page.evaluate(HIDE_OVERLAYS_SCRIPT);
        firstClean = await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled' });
      }
      if (y + frameHeight >= pageHeight) {
        reachedEnd = true; // am ajuns la capatul paginii
        break;
      }
    }
  } finally {
    await page.evaluate(RESTORE_SCRIPT).catch(() => {});
  }

  // Daca toate imbinarile se potrivesc (pagina nu s-a schimbat intre ecrane) si nu exista
  // elemente lipite in sectiunea lor, pagina e aratata ca o singura imagine continua, cu pozitiile
  // fata de coltul paginii. Altfel ecranele raman separate (o imbinare ar avea cusaturi).
  const blank = await page.context().newPage();
  try {
    const seams = await seamDifferences(blank, frames, firstClean, frameHeight);
    const continuous = !sectionSticky && seams.every((d) => d <= SEAM_TOLERANCE);
    const boxes = new Map<string, ElementBox | null>();
    for (const key of keys) {
      boxes.set(
        key,
        continuous
          ? (inPage.get(key) ?? null)
          : (decided.get(key) ?? partial.get(key)?.box ?? null),
      );
    }
    const last = frames.at(-1)!;
    return {
      image: await stack(blank, frames, viewport.width, frameHeight, continuous),
      format: 'webp',
      width: viewport.width,
      height: continuous ? last.offset + frameHeight : frames.length * frameHeight,
      pageHeight,
      // Taiata doar daca ne-am oprit la limita capturii (pagina isi poate schimba putin inaltimea)
      truncated: !reachedEnd,
      boxes,
      frameHeight: continuous ? null : frameHeight,
      frameOffsets: continuous ? [] : frames.map((f) => f.offset),
      reactiveFrames,
      seams,
    };
  } finally {
    await blank.close().catch(() => {});
  }
}

/**
 * Cat difera fiecare imbinare: pentru doua ecrane vecine, comparam pixel cu pixel randurile de jos
 * ale primului (SEAM_OVERLAP) cu aceleasi randuri ale paginii din al doilea. Intoarce, pentru
 * fiecare imbinare, partea din pixeli care difera (0 = identice). Primul ecran e comparat in
 * varianta fara elementele fixe (in celelalte ecrane sunt ascunse).
 */
async function seamDifferences(
  blank: Page,
  frames: Array<{ offset: number; image: Buffer }>,
  firstClean: Buffer | null,
  frameHeight: number,
): Promise<number[]> {
  if (frames.length < 2) return [];
  const data = frames.map((f, i) => ({
    offset: f.offset,
    src: (i === 0 && firstClean ? firstClean : f.image).toString('base64'),
  }));
  return blank.evaluate<number[]>(`(async () => {
    const frames = ${JSON.stringify(data)};
    const H = ${frameHeight}, OV = ${SEAM_OVERLAP}, TOL = ${PIXEL_TOLERANCE};
    const pixels = async (src, y) => {
      const img = new Image();
      img.src = "data:image/png;base64," + src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = OV;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, -y);
      return ctx.getImageData(0, 0, img.width, OV).data;
    };
    const result = [];
    for (let i = 0; i + 1 < frames.length; i++) {
      // Randurile [offset_i + H - OV, offset_i + H) din pagina, in ambele ecrane
      const start = frames[i].offset + H - OV;
      const a = await pixels(frames[i].src, H - OV);
      const b = await pixels(frames[i + 1].src, start - frames[i + 1].offset);
      let different = 0;
      for (let p = 0; p < a.length; p += 4) {
        if (Math.abs(a[p] - b[p]) > TOL || Math.abs(a[p + 1] - b[p + 1]) > TOL || Math.abs(a[p + 2] - b[p + 2]) > TOL) different++;
      }
      result.push(different / (a.length / 4));
    }
    return result;
  })()`);
}

/**
 * Aseaza ecranele intr-o singura imagine WebP (un fisier in loc de zeci):
 *   - separate: unul sub altul, fiecare intreg (ecranul nr. i incepe la i * inaltimea ecranului);
 *   - continuu (pagina statica): fiecare la pozitia lui din pagina; din ultimul ecran, care se
 *     poate suprapune cu cel dinainte, se deseneaza doar partea noua.
 * Se face intr-un canvas, intr-o fila goala a aceluiasi browser (nu in pagina scanata: regulile
 * ei de securitate ar putea bloca imaginile), deci nu avem nevoie de o biblioteca de imagini.
 */
async function stack(
  blank: Page,
  frames: Array<{ offset: number; image: Buffer }>,
  width: number,
  frameHeight: number,
  continuous: boolean,
): Promise<Buffer> {
  const data = frames.map((f, i) => ({
    y: continuous ? f.offset : i * frameHeight,
    src: f.image.toString('base64'),
  }));
  const last = data[data.length - 1]!;
  const base64 = await blank.evaluate<string>(`(async () => {
      const frames = ${JSON.stringify(data)};
      const canvas = document.createElement("canvas");
      canvas.width = ${width};
      canvas.height = ${last.y + frameHeight};
      const ctx = canvas.getContext("2d");
      let covered = 0;
      for (const frame of frames) {
        const img = new Image();
        img.src = "data:image/png;base64," + frame.src;
        await img.decode();
        const skip = Math.max(0, covered - frame.y);
        const rows = img.height - skip;
        if (rows > 0) ctx.drawImage(img, 0, skip, img.width, rows, 0, frame.y + skip, img.width, rows);
        covered = frame.y + img.height;
      }
      return canvas.toDataURL("image/webp", ${CAPTURE_QUALITY / 100}).split(",")[1];
    })()`);
  const image = Buffer.from(base64, 'base64');
  if (image.subarray(8, 12).toString() !== 'WEBP') {
    throw new Error('Browserul nu a putut codifica imaginea in format WebP.');
  }
  return image;
}
