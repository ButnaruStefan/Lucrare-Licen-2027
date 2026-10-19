/**
 * Genereaza catalogul criteriilor WCAG direct din documentele oficiale W3C.
 *
 *   npm run genereaza:wcag -w @ro-a11y/catalog
 *
 * Descarca WCAG 2.2 si WCAG 2.1 (Recomandari W3C), extrage pentru fiecare criteriu de succes
 * numarul, titlul oficial, nivelul (A / AA / AAA), principiul si legatura spre documentul
 * "Understanding", apoi scrie `src/data/wcag22.json`, impreuna cu sursa si data descarcarii.
 *
 * Catalogul NU e scris de mana: oricine poate rula din nou scriptul si obtine acelasi rezultat
 * (cat timp documentele W3C nu se schimba).
 */
import { writeFileSync } from 'node:fs';

const SOURCES = {
  wcag22: 'https://www.w3.org/TR/WCAG22/',
  wcag21: 'https://www.w3.org/TR/WCAG21/',
};

interface ParsedCriterion {
  number: string;
  title: string;
  level: 'A' | 'AA' | 'AAA' | null;
  slug: string;
  understandingUrl: string | null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Extrage criteriile dintr-un document WCAG (structura HTML a Recomandarilor W3C). */
function parseCriteria(html: string): ParsedCriterion[] {
  const result: ParsedCriterion[] = [];
  const sectionRe =
    /<section id="([a-z0-9-]+)" class="guideline">([\s\S]*?)(?=<section id="[a-z0-9-]+" class="guideline">|<\/section>\s*<\/section>)/g;
  for (const match of html.matchAll(sectionRe)) {
    const slug = match[1]!;
    const body = match[2]!;
    const heading = /<h4[^>]*>([\s\S]*?)<\/h4>/.exec(body)?.[1];
    if (!heading) continue;
    const text = decodeEntities(heading.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    const parsed = /^Success Criterion (\d\.\d+\.\d+)\s+(.+)$/.exec(text);
    if (!parsed) continue;
    const level = /<p class="conformance-level">\(Level (A{1,3})\)<\/p>/.exec(body)?.[1] ?? null;
    const understanding =
      /href="(https:\/\/www\.w3\.org\/WAI\/WCAG2\d\/Understanding\/[^"]+)"/.exec(body);
    result.push({
      number: parsed[1]!,
      title: parsed[2]!,
      level: level as ParsedCriterion['level'],
      slug,
      understandingUrl: understanding?.[1] ?? null,
    });
  }
  return result;
}

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarcarea ${url} a esuat: ${res.status}`);
  return res.text();
}

const PRINCIPLES = {
  '1': 'perceptibil',
  '2': 'operabil',
  '3': 'inteligibil',
  '4': 'robust',
} as const;

const [html22, html21] = await Promise.all([download(SOURCES.wcag22), download(SOURCES.wcag21)]);
const wcag22 = parseCriteria(html22);
const wcag21 = parseCriteria(html21);
const wcag21Levels = new Map(wcag21.map((c) => [c.number, c.level]));
const wcag21Numbers = new Set(wcag21Levels.keys());

if (wcag22.length < 80 || wcag21Numbers.size < 70) {
  throw new Error(
    `Structura documentului W3C pare schimbata: ${wcag22.length} / ${wcag21Numbers.size} criterii`,
  );
}

const criteria = wcag22.map((c) => {
  const obsolete = /obsolete/i.test(c.title);
  return {
    number: c.number,
    title: c.title.replace(/\s*\(Obsolete and removed\)\s*/i, '').trim(),
    level: c.level,
    principle: PRINCIPLES[c.number[0] as keyof typeof PRINCIPLES],
    guideline: c.number.split('.').slice(0, 2).join('.'),
    slug: c.slug,
    specUrl: `${SOURCES.wcag22}#${c.slug}`,
    understandingUrl: c.understandingUrl,
    inWcag21: wcag21Numbers.has(c.number),
    /** Nivelul din WCAG 2.1 (EN 301 549 V3.2.1 se bazeaza pe WCAG 2.1). */
    levelInWcag21: wcag21Levels.get(c.number) ?? null,
    obsoleteIn22: obsolete,
  };
});

const output = {
  description:
    'Criteriile de succes WCAG 2.2, extrase automat din Recomandarea W3C (scripts/genereaza-wcag.ts).',
  sources: SOURCES,
  retrievedAt: new Date().toISOString().slice(0, 10),
  criteria,
};

const target = new URL('../src/data/wcag22.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Scrise ${criteria.length} criterii in ${target.pathname}`);
console.log(
  `  noi in WCAG 2.2: ${criteria
    .filter((c) => !c.inWcag21)
    .map((c) => c.number)
    .join(', ')}`,
);
console.log(
  `  eliminate in 2.2: ${criteria
    .filter((c) => c.obsoleteIn22)
    .map((c) => c.number)
    .join(', ')}`,
);
