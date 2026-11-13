/**
 * Re-verificarea contrastului "pe ecran", folosita de scanner (`page-scan.ts`) in timpul
 * parcurgerii paginii pentru captura (`capture.ts`).
 *
 * Problema: axe-core analizeaza pagina o singura data, cu fereastra sus. Pe site-urile care
 * estompeaza sectiunile cat timp sunt in afara ecranului (opacitate 0 -> 1 cand ajungi la ele),
 * axe masoara contrastul textului ESTOMPAT si raporteaza contrast insuficient, desi omul care
 * ajunge acolo vede textul la culoarea lui reala. Verificat pe un site real: 10 din 11 probleme
 * de contrast au disparut cand elementele au fost aduse pe ecran.
 *
 * Solutia: doar elementele pe care axe le-a semnalat la regula "color-contrast" (problema sau de
 * verificat) sunt verificate din nou, cu aceeasi regula si acelasi motor (axe-core deja incarcat
 * in pagina), in momentul in care ajung intregi pe ecran si animatiile s-au incheiat. Rezultatul
 * nou il inlocuieste pe cel vechi. Elementele care nu ajung pe ecran isi pastreaza rezultatul.
 * Nu se adauga elemente noi: se pastreaza doar raspunsurile pentru elementele cerute.
 *
 * `applyContrastRecheck` e functie "pura" (nu atinge browserul), deci se testeaza usor.
 */
import type { AxeResults, ImpactValue, NodeResult, Result } from 'axe-core';
import type { Page } from 'playwright';

export const CONTRAST_RULE = 'color-contrast';

export type RecheckCategory = 'violation' | 'incomplete' | 'pass';

/** Rezultatul nou al unui element (cheia hartii: JSON.stringify(target)). */
export interface RecheckedNode {
  category: RecheckCategory;
  node: NodeResult;
}

const IMPACT_ORDER: ImpactValue[] = ['minor', 'moderate', 'serious', 'critical'];

function key(target: unknown): string {
  return JSON.stringify(target);
}

/**
 * Elementele de re-verificat: cele semnalate la contrast (problema sau de verificat), doar din
 * documentul principal (cele din iframe-uri nu pot fi aduse pe ecran de noi).
 */
export function contrastTargets(raw: Pick<AxeResults, 'violations' | 'incomplete'>) {
  const targets = new Map<string, unknown>();
  for (const rule of [...raw.violations, ...raw.incomplete]) {
    if (rule.id !== CONTRAST_RULE) continue;
    for (const node of rule.nodes) {
      if (Array.isArray(node.target) && node.target.length === 1) {
        targets.set(key(node.target), node.target);
      }
    }
  }
  return targets;
}

/**
 * Ruleaza din nou regula de contrast pe elementele date, cu axe-core deja incarcat in pagina
 * (de analiza principala). Intoarce rezultatul nou doar pentru elementele cerute.
 */
export async function recheckContrast(
  page: Page,
  targets: unknown[],
): Promise<Map<string, RecheckedNode>> {
  const result = await page.evaluate<Pick<
    AxeResults,
    'violations' | 'incomplete' | 'passes'
  > | null>(
    `(async () => {
      if (!window.axe) return null;
      const r = await window.axe.run(
        { include: ${JSON.stringify(targets)} },
        { runOnly: { type: "rule", values: ["${CONTRAST_RULE}"] }, iframes: false },
      );
      return { violations: r.violations, incomplete: r.incomplete, passes: r.passes };
    })()`,
  );
  const wanted = new Set(targets.map(key));
  const found = new Map<string, RecheckedNode>();
  if (!result) return found;
  const groups: Array<[RecheckCategory, Result[]]> = [
    ['violation', result.violations],
    ['incomplete', result.incomplete],
    ['pass', result.passes],
  ];
  for (const [category, rules] of groups) {
    for (const rule of rules) {
      if (rule.id !== CONTRAST_RULE) continue;
      for (const node of rule.nodes) {
        // axe verifica si elementele din interiorul celor cerute: le ignoram
        if (wanted.has(key(node.target))) found.set(key(node.target), { category, node });
      }
    }
  }
  return found;
}

function highestImpact(nodes: NodeResult[]): ImpactValue | null {
  let best = -1;
  for (const node of nodes) best = Math.max(best, IMPACT_ORDER.indexOf(node.impact ?? 'minor'));
  return best >= 0 ? IMPACT_ORDER[best]! : null;
}

/**
 * Inlocuieste, in rezultatul axe, raspunsul vechi al elementelor re-verificate cu cel nou
 * (un element poate trece din "problema" in "trece" sau "de verificat" si invers).
 * Intoarce rezultatul nou si cate elemente si-au schimbat categoria.
 */
export function applyContrastRecheck(
  raw: AxeResults,
  rechecked: ReadonlyMap<string, RecheckedNode>,
): { raw: AxeResults; changed: number } {
  const lists: Record<RecheckCategory, Result[]> = {
    violation: raw.violations,
    incomplete: raw.incomplete,
    pass: raw.passes,
  };
  const template = [...raw.violations, ...raw.incomplete, ...raw.passes].find(
    (r) => r.id === CONTRAST_RULE,
  );
  if (!template || rechecked.size === 0) return { raw, changed: 0 };

  const nodes: Record<RecheckCategory, NodeResult[]> = { violation: [], incomplete: [], pass: [] };
  let changed = 0;
  for (const category of ['violation', 'incomplete', 'pass'] as const) {
    const rule = lists[category].find((r) => r.id === CONTRAST_RULE);
    for (const node of rule?.nodes ?? []) {
      const update = rechecked.get(key(node.target));
      if (!update) {
        nodes[category].push(node);
        continue;
      }
      if (update.category !== category) changed++;
      nodes[update.category].push(update.node);
    }
  }

  function rebuild(list: Result[], category: RecheckCategory): Result[] {
    const existing = list.find((r) => r.id === CONTRAST_RULE);
    const updated: Result = {
      ...(existing ?? template!),
      nodes: nodes[category],
      impact: category === 'pass' ? null : highestImpact(nodes[category]),
    };
    if (nodes[category].length === 0) return list.filter((r) => r.id !== CONTRAST_RULE);
    return existing ? list.map((r) => (r.id === CONTRAST_RULE ? updated : r)) : [...list, updated];
  }

  return {
    raw: {
      ...raw,
      violations: rebuild(raw.violations, 'violation'),
      incomplete: rebuild(raw.incomplete, 'incomplete'),
      passes: rebuild(raw.passes, 'pass'),
    },
    changed,
  };
}
