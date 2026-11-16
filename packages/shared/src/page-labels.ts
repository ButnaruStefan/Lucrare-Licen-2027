/**
 * Nume distincte pentru paginile gasite intr-un site. Folosit de descoperirea paginilor (API,
 * pentru auditurile noi) si de interfata (pentru auditurile deja facute).
 *
 * Paginile gasite doar in sitemap.xml primesc ca nume ultima parte a adresei, deci pot iesi
 * nume identice: /evenimente/iasi, /voluntariat/iasi si /en/evenimente/iasi sunt toate "Iasi".
 * Doar pentru numele care se repeta adaugam contextul din adresa:
 *   - sectiunile parinte, in fata:  "Evenimente › Iasi", "Voluntariat › Iasi";
 *   - limba, daca adresa incepe cu un cod de doua litere (ex. /en/):  "Evenimente › Iasi (EN)".
 * Daca tot raman doua nume identice, la final se adauga calea paginii.
 */

/** Primul segment al adresei e un cod de limba (ex. "en", "ro")? */
const LANGUAGE_SEGMENT = /^[a-z]{2}$/i;

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1);
}

/** Numele unei parti din adresa: "voluntariat-iasi" -> "Voluntariat iasi". */
function segmentName(segment: string): string {
  return capitalize(
    segment
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim(),
  );
}

function segmentsOf(url: string): string[] {
  return new URL(url).pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function normalize(label: string): string {
  return label.trim().toLocaleLowerCase('ro-RO');
}

function duplicates(labels: Map<string, string>): Set<string> {
  const counts = new Map<string, number>();
  for (const label of labels.values()) {
    counts.set(normalize(label), (counts.get(normalize(label)) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([label]) => label));
}

/** Pentru fiecare adresa, numele afisat: cel original sau, daca se repeta, cu context. */
export function distinctPageLabels(
  pages: ReadonlyArray<{ url: string; label: string }>,
): Map<string, string> {
  const result = new Map(pages.map((p) => [p.url, p.label]));

  // 1. Numele care se repeta primesc sectiunile parinte si limba
  const repeated = duplicates(result);
  for (const page of pages) {
    if (!repeated.has(normalize(page.label))) continue;
    const segments = segmentsOf(page.url);
    const language =
      segments.length > 1 && LANGUAGE_SEGMENT.test(segments[0]!)
        ? segments.shift()!.toUpperCase()
        : null;
    const parents = segments.slice(0, -1).map(segmentName);
    const label = [...parents, page.label.trim()].join(' › ');
    result.set(page.url, language ? `${label} (${language})` : label);
  }

  // 2. Daca tot se repeta (ex. aceeasi pagina cu si fara parametri), adaugam calea
  const stillRepeated = duplicates(result);
  for (const page of pages) {
    const label = result.get(page.url)!;
    if (!stillRepeated.has(normalize(label))) continue;
    const parsed = new URL(page.url);
    result.set(page.url, `${label} (${parsed.pathname}${parsed.search})`);
  }
  return result;
}
