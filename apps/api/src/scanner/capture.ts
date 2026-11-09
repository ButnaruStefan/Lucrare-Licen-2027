/**
 * Captura paginii pentru "harta problemelor": imaginea paginii scanate si pozitia fiecarui
 * element afectat, ca interfata sa deseneze chenare peste imagine.
 *
 * Se apeleaza din scanner (`page-scan.ts`) imediat dupa axe-core, in ACEEASI sesiune de
 * browser: pagina nu se reincarca, deci captura arata exact ce a analizat motorul.
 *
 * Limita cunoscuta: unele site-uri estompeaza sectiunile cat timp sunt in afara ecranului si le
 * arata doar cand ajungi la ele (efect reversibil: dispar iar cand pleci). Captura si axe-core vad
 * pagina din capul ei, deci acele sectiuni apar estompate. O derulare prealabila nu ajuta
 * (verificat pe un site real: opacitate 0,3 in afara ecranului, 1 in ecran, 0,3 dupa revenire).
 *
 * Pasii:
 *   1. pozitiile: un singur apel in pagina calculeaza dreptunghiul fiecarui element
 *      (getBoundingClientRect + derularea ferestrei = coordonate fata de coltul paginii);
 *   2. captura: toata pagina (fullPage), un pixel de imagine = un pixel CSS (scale: "css"),
 *      animatiile oprite, in format WebP; pagina foarte lunga e taiata la MAX_CAPTURE_HEIGHT.
 *
 * Selectorii vin din axe-core (`node.target`): un sir = selector CSS in documentul principal;
 * mai multe elemente in lista = elementul e intr-un iframe; o lista in lista = Shadow DOM.
 * Elementele din iframe-uri nu primesc pozitie (ar trebui adunata si pozitia cadrului).
 */
import type { Page } from 'playwright';

/** Inaltimea maxima a capturii, in pixeli. Chromium nu poate desena corect peste 16 384 px. */
export const MAX_CAPTURE_HEIGHT = 16_000;
/** Latimea maxima a capturii (cea mai mare fereastra permisa de configuratia scanarii). */
export const MAX_CAPTURE_WIDTH = 3840;
/** Calitatea WebP (0-100); aleasa prin masuratoare: lizibila si de 2-5 ori mai mica decat PNG. */
export const CAPTURE_QUALITY = 80;

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
  height: number;
  pageHeight: number;
  truncated: boolean;
  /** Pozitia fiecarui element, in ordinea selectorilor primiti; null = nu se vede. */
  boxes: Array<ElementBox | null>;
}

/**
 * Scriptul rulat IN pagina (de aceea e text, nu cod TypeScript: ruleaza in browser, ca scriptul
 * descoperirii). Primeste lista selectorilor axe si intoarce, pentru fiecare, dreptunghiul
 * elementului fata de coltul paginii, sau null daca elementul nu poate fi aratat.
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
  return targets.map((target) => {
    let element = null;
    try {
      element = resolve(target);
    } catch (e) {
      return null; // selector invalid
    }
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null; // ascuns sau fara dimensiune
    return {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
}`;

/** Dimensiunea intregii pagini (nu doar a ferestrei), in pixeli CSS. */
const PAGE_SIZE_SCRIPT = `(() => ({
  width: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
  height: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
}))()`;

/** Calculeaza pozitiile elementelor si face captura paginii intregi. */
export async function capturePage(page: Page, targets: unknown[]): Promise<PageCapture> {
  const boxes = await page.evaluate<Array<ElementBox | null>>(
    `(${ELEMENT_BOXES_SCRIPT})(${JSON.stringify(targets)})`,
  );
  const size = await page.evaluate<{ width: number; height: number }>(PAGE_SIZE_SCRIPT);
  const width = Math.max(1, Math.min(size.width, MAX_CAPTURE_WIDTH));
  const height = Math.max(1, Math.min(size.height, MAX_CAPTURE_HEIGHT));
  const image = await page.screenshot({
    fullPage: true,
    clip: { x: 0, y: 0, width, height },
    type: 'webp',
    quality: CAPTURE_QUALITY,
    scale: 'css',
    animations: 'disabled',
  });
  return {
    image,
    format: 'webp',
    width,
    height,
    pageHeight: size.height,
    truncated: size.height > height,
    boxes,
  };
}
