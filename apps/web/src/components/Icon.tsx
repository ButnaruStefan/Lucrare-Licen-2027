/**
 * Pictogramele mici ale interfetei (SVG desenat in cod, fara biblioteca externa).
 *
 * Sunt doar decor: au aria-hidden, iar sensul e mereu spus si in text (ex. gravitatea are si
 * eticheta "Gravă"), deci nimic nu depinde doar de pictograma sau de culoarea ei.
 * Folosite de rezultatele pe reguli (`RuleResultItem`) si de sectiunile pliabile.
 */
export type IconName =
  | 'alert' // problema grava sau critica
  | 'warning' // problema moderata
  | 'info' // problema minora / informatie
  | 'check' // regula trecuta
  | 'minus' // regula care nu se aplica
  | 'where' // unde apare
  | 'wrench' // cum repari
  | 'verify' // cum verifici
  | 'chain' // trasabilitate
  | 'code' // detalii tehnice
  | 'split' // aceeasi regula in alta categorie
  | 'page' // o singura pagina
  | 'pages'; // mai multe pagini

const PATHS: Record<IconName, string[]> = {
  alert: ['M12 3 2.5 20h19L12 3Z', 'M12 10v4.5', 'M12 17.5h.01'],
  warning: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7.5v5', 'M12 16.5h.01'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5.5', 'M12 7.5h.01'],
  check: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm8 12.2 2.7 2.7L16.2 9.3'],
  minus: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8 12h8'],
  where: [
    'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z',
    'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  ],
  wrench: [
    'M14.7 6.3a4 4 0 0 0-5.2 5.2L3.8 17.2a1.6 1.6 0 0 0 2.3 2.3l5.7-5.7a4 4 0 0 0 5.2-5.2l-2.5 2.5-2.3-.5-.5-2.3 2.5-2.5Z',
  ],
  verify: [
    'M9 11.5 11.5 14 20 5.5',
    'M20 12v6.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H15',
  ],
  chain: [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ],
  code: ['m8.5 8-4 4 4 4', 'm15.5 8 4 4-4 4', 'm13.5 5-3 14'],
  split: ['M4 7h12l-3-3', 'M20 17H8l3 3'],
  page: [
    'M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5L14 3Z',
    'M14 3v4.5h4.5',
    'M9 13h6',
    'M9 16.5h4',
  ],
  pages: [
    'M9 3h7l4 4v10.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 9 3Z',
    'M16 3v4h4',
    'M4.5 7.5v12A1.5 1.5 0 0 0 6 21h9',
  ],
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
