/**
 * Textele in romana pentru verificarea aspectului paginii (separata de accesibilitate): ce
 * inseamna fiecare tip de semnal, cum se repara si de unde vine regula (sursa verificata),
 * plus etichetele nivelurilor si ale verificarilor alese la pornirea unei scanari.
 *
 * Folosite de `LayoutPanel` (pagina scanarii), de pagina proiectului si de pagina auditului.
 */
import type { LayoutIssueKind, LayoutLevel, ScanChecks } from '@ro-a11y/shared';

export interface LayoutKindInfo {
  /** Titlul scurt al semnalului. */
  title: string;
  /** Ce s-a intamplat, pe intelesul tuturor. */
  explanation: string;
  /** Cum se repara, de obicei. */
  fix: string;
  /** De unde vine regula (sursa verificata). */
  source: { label: string; url: string };
}

const REDECHECK = {
  label: 'Walsh, Kapfhammer, McMinn — ReDeCheck (ISSTA 2017)',
  url: 'https://eprints.whiterose.ac.uk/id/eprint/116989/',
};
const WEB_DEV = {
  label: 'web.dev — Responsive web design basics',
  url: 'https://web.dev/articles/responsive-web-design-basics',
};

export const LAYOUT_KIND_INFO: Record<LayoutIssueKind, LayoutKindInfo> = {
  'derulare-orizontala': {
    title: 'Pagina se derulează pe orizontală',
    explanation:
      'La aceste lățimi, pagina e mai lată decât ecranul: vizitatorul trebuie să deruleze stânga-dreapta ca să vadă tot conținutul.',
    fix: 'Elementul marcat are o lățime fixă prea mare. Folosește lățimi în procente sau max-width: 100% (la imagini și tabele), ori pune tabelul într-un container cu derulare proprie (overflow-x: auto).',
    source: WEB_DEV,
  },
  'taiat-la-marginea-paginii': {
    title: 'Conținut tăiat la marginea paginii',
    explanation:
      'Pagina ascunde derularea orizontală (overflow-x: hidden), iar elementul marcat trece de marginea ecranului: o parte din el nu se mai vede deloc.',
    fix: 'Elementul trebuie să se îngusteze odată cu pagina (lățime în procente, max-width: 100%, text care se rupe pe mai multe rânduri).',
    source: REDECHECK,
  },
  'elemente-suprapuse': {
    title: 'Elemente suprapuse',
    explanation:
      'La lățimi mai mari, cele două elemente stau separat; când ecranul se îngustează, ajung unul peste altul (de exemplu titlul și meniul).',
    fix: 'De obicei, unul dintre elemente are poziție absolută sau lățime fixă. Adaugă un breakpoint înainte de lățimea la care se suprapun, în care elementele trec unul sub altul.',
    source: REDECHECK,
  },
  'iese-din-container': {
    title: 'Conținut ieșit din container',
    explanation:
      'Containerul are o înălțime sau o lățime fixă și taie ce iese din el (overflow: hidden). La aceste lățimi, conținutul nu mai încape: o parte nu se mai vede, iar linkurile ascunse nu mai pot fi apăsate.',
    fix: 'Lasă containerul să crească odată cu conținutul (fără înălțime fixă) sau reorganizează conținutul pe ecrane mici (de exemplu, un meniu care se deschide).',
    source: REDECHECK,
  },
  'media-queries-suprapuse': {
    title: 'Reguli CSS suprapuse la aceeași lățime',
    explanation:
      'O regulă se aplică până la N px inclusiv (max-width), iar alta de la N px inclusiv (min-width): la exact N px se aplică amândouă, deci pagina poate arăta ciudat doar la acea lățime.',
    fix: 'Schimbă una dintre valori, de exemplu max-width: 767.98px în loc de 768px, ca fiecare lățime să aibă un singur set de reguli.',
    source: REDECHECK,
  },
  'fara-meta-viewport': {
    title: 'Lipsește eticheta meta viewport',
    explanation:
      'Fără ea, telefoanele afișează pagina pe o lățime mare (ca pe calculator) și o micșorează: textul devine foarte mic.',
    fix: 'Adaugă în <head>: <meta name="viewport" content="width=device-width, initial-scale=1">.',
    source: WEB_DEV,
  },
  'meta-viewport-latime-fixa': {
    title: 'Meta viewport cu lățime fixă',
    explanation:
      'Eticheta meta viewport cere o lățime fixă în locul lățimii ecranului, deci pe telefon pagina nu se adaptează.',
    fix: 'Folosește width=device-width în loc de o valoare fixă.',
    source: {
      label: 'MDN — <meta name="viewport">',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport',
    },
  },
};

export const LAYOUT_LEVEL_LABELS: Record<LayoutLevel, string> = {
  visible: 'Se vede sigur',
  possible: 'De confirmat',
  info: 'Informativ',
};

export const LAYOUT_LEVEL_DESCRIPTIONS: Record<LayoutLevel, string> = {
  visible: 'Defectul se vede sigur pe ecran.',
  possible: 'Probabil un defect; uită-te la captură ca să confirmi.',
  info: 'Doar informație.',
};

/** Verificarile alese, pe scurt (ex. "Accesibilitate si aspect"). */
export function checksLabel(checks: ScanChecks): string {
  if (checks.accessibility && checks.layout) return 'Accesibilitate și aspect';
  return checks.layout ? 'Aspectul paginii' : 'Accesibilitate';
}

/**
 * Intervalul de latimi la care apare un semnal, in cuvinte. `approximate` = capetele nu au fost
 * cautate exact (s-a terminat timpul verificarii), deci sunt cele masurate din 60 in 60 px.
 */
export function widthRangeLabel(
  min: number | null,
  max: number | null,
  approximate = false,
): string | null {
  if (min === null || max === null) return null;
  const about = approximate ? 'aproximativ ' : '';
  if (min === max) return `${about}la lățimea de ${min} px`;
  return `${about}la lățimi între ${min} și ${max} px`;
}
