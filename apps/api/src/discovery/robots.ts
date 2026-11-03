/**
 * Citirea fisierului robots.txt al unui site (regulile pentru programele automate).
 *
 * Folosit la descoperirea paginilor unui audit: paginile interzise de robots.txt nu sunt
 * propuse pentru scanare, iar adresele sitemap-urilor declarate aici sunt citite.
 *
 * Reguli respectate (standardul RFC 9309, partea folosita de noi):
 *   - se aplica grupul pentru numele nostru ("W4A"), altfel grupul general ("*");
 *   - "Disallow: /cale" interzice adresele care incep cu /cale; "Allow" face exceptii;
 *   - la conflict castiga regula cea mai lunga (cea mai precisa); la egalitate, Allow;
 *   - "*" inseamna orice sir de caractere, iar "$" la final inseamna "aici se termina adresa".
 *
 * robots.txt NU e un mecanism de securitate sau de autorizare: il respectam din politete.
 */

/** Numele cu care se prezinta scannerul in robots.txt. */
export const ROBOTS_USER_AGENT = 'W4A';

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

export interface RobotsRules {
  /** Cate reguli Disallow se aplica noua (doar pentru raport). */
  disallowCount: number;
  /** Adresele sitemap-urilor declarate. */
  sitemaps: string[];
  /** True daca adresa (cale + parametri, ex. "/admin?x=1") poate fi vizitata. */
  isAllowed(pathAndQuery: string): boolean;
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function parseRobots(text: string, userAgent = ROBOTS_USER_AGENT): RobotsRules {
  const sitemaps: string[] = [];
  /** Grupurile: agentii carora li se aplica si regulile lor. */
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      // Mai multe randuri User-agent la rand formeaza acelasi grup
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      // "Disallow:" gol inseamna "nimic interzis"
      if (!value) continue;
      current.rules.push({ allow: field === 'allow', pattern: value, regex: toRegex(value) });
    }
  }

  const name = userAgent.toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && name.includes(a)));
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);

  return {
    sitemaps,
    disallowCount: rules.filter((r) => !r.allow).length,
    isAllowed(pathAndQuery: string) {
      let best: Rule | null = null;
      for (const rule of rules) {
        if (!rule.regex.test(pathAndQuery)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow)
        ) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

/** Lipsa fisierului robots.txt inseamna ca nu exista restrictii. */
export const NO_ROBOTS_RULES: RobotsRules = {
  sitemaps: [],
  disallowCount: 0,
  isAllowed: () => true,
};
