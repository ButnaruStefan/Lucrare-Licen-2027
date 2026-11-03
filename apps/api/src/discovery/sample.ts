/**
 * Propunerea esantionului de pagini pentru un audit.
 *
 * Un site mare poate avea sute de pagini, dar multe sunt construite pe acelasi sablon (acelasi
 * meniu, acelasi subsol, acelasi tip de continut). Nu le scanam pe toate: alegem un esantion
 * care acopera site-ul cat mai variat, dupa ideea metodologiilor de evaluare cu esantion
 * (pagini importante + pagini din fiecare parte a site-ului + cateva pagini alese la intamplare):
 *
 *   1. pagina de start;
 *   2. paginile esentiale, daca exista: Contact, accesibilitate, harta site-ului;
 *   3. cate o pagina din fiecare sectiune (meniu), pe rand, pana se umple lista;
 *   4. 1-2 pagini alese la intamplare dintre cele ramase, ca esantionul sa nu contina doar
 *      paginile "comode". Intamplarea e reproductibila: acelasi audit da aceeasi alegere.
 *
 * Utilizatorul vede propunerea si o poate modifica inainte de scanare. Functie "pura".
 */
import type { LinkRegion, SelectionReason } from '@ro-a11y/shared';

export interface CandidatePage {
  url: string;
  label: string;
  section: string | null;
  region: LinkRegion;
}

/** Paginile esentiale cautate dupa textul linkului sau adresa (fara diacritice, litere mici). */
const ESSENTIAL_PATTERNS: RegExp[] = [
  /\bcontact/,
  /accesibil|accessibil/,
  /harta[ -]?(a[ -])?(site|sitului)|site-?map/,
];

function simplify(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Generator de numere aleatorii cu "samanta": aceeasi samanta, acelasi sir de numere. */
function seededRandom(seed: string): () => number {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
  // mulberry32: generator mic si suficient de bun pentru o alegere la intamplare
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheia sectiunii: meniul din care face parte linkul, altfel primul segment al adresei. */
function sectionKey(page: CandidatePage): string {
  if (page.section) return `meniu:${simplify(page.section)}`;
  const segment = new URL(page.url).pathname.split('/').filter(Boolean)[0] ?? '';
  return `cale:${segment}`;
}

/** Cate pagini aleatorii pastram din esantion. */
export function randomSlotsFor(maxPages: number, candidateCount: number): number {
  if (candidateCount <= maxPages) return 0;
  if (maxPages >= 10) return 2;
  if (maxPages >= 5) return 1;
  return 0;
}

/**
 * Alege paginile propuse.
 * @param startUrl pagina de start (prima din esantion)
 * @param candidates paginile gasite, in ordinea aparitiei (pagina de start inclusa)
 * @returns pentru fiecare pagina aleasa, motivele alegerii (in ordinea alegerii)
 */
export function proposeSample(
  startUrl: string,
  candidates: CandidatePage[],
  maxPages: number,
  seed: string,
): Map<string, SelectionReason[]> {
  const chosen = new Map<string, SelectionReason[]>();
  const choose = (url: string, reason: SelectionReason) => {
    const reasons = chosen.get(url);
    if (reasons) {
      if (!reasons.includes(reason)) reasons.push(reason);
      return;
    }
    chosen.set(url, [reason]);
  };

  if (maxPages <= 0) return chosen;
  choose(startUrl, 'start');

  const randomSlots = randomSlotsFor(maxPages, candidates.length);
  const budget = maxPages - randomSlots;

  // 2. Paginile esentiale (cel mult una pentru fiecare tip)
  for (const pattern of ESSENTIAL_PATTERNS) {
    if (chosen.size >= budget) break;
    const match = candidates.find(
      (p) => !chosen.has(p.url) && pattern.test(simplify(`${p.label} ${p.url}`)),
    );
    if (match) choose(match.url, 'essential');
  }

  // 3. Cate o pagina din fiecare sectiune, pe rand. Meniurile (nav, antet) au prioritate,
  //    pentru ca ele arata structura site-ului; urmeaza continutul, subsolul, sitemap-ul.
  const regionOrder: LinkRegion[] = ['nav', 'header', 'main', 'other', 'footer', 'sitemap'];
  const ordered = [...candidates].sort(
    (a, b) => regionOrder.indexOf(a.region) - regionOrder.indexOf(b.region),
  );
  const groups = new Map<string, CandidatePage[]>();
  for (const page of ordered) {
    const key = sectionKey(page);
    const list = groups.get(key) ?? [];
    list.push(page);
    groups.set(key, list);
  }
  // Sectiunile din care avem deja o pagina (pagina de start, cele esentiale) vin la urma
  const covered = new Set(candidates.filter((p) => chosen.has(p.url)).map((p) => sectionKey(p)));
  const queues = [...groups.entries()]
    .sort(([a], [b]) => Number(covered.has(a)) - Number(covered.has(b)))
    .map(([, pages]) => pages);
  let progress = true;
  while (chosen.size < budget && progress) {
    progress = false;
    for (const queue of queues) {
      if (chosen.size >= budget) break;
      const next = queue.find((p) => !chosen.has(p.url));
      if (next) {
        choose(next.url, 'section');
        progress = true;
      }
    }
  }

  // 4. Paginile aleatorii, dintre cele ramase
  const random = seededRandom(seed);
  const remaining = candidates.filter((p) => !chosen.has(p.url));
  while (chosen.size < maxPages && remaining.length > 0) {
    const index = Math.floor(random() * remaining.length);
    const [page] = remaining.splice(index, 1);
    choose(page!.url, 'random');
  }

  return chosen;
}
