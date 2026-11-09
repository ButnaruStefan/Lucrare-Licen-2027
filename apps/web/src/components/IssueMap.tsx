/**
 * Harta problemelor: captura paginii scanate, cu un chenar peste fiecare element afectat.
 * Folosita de pagina scanarii (`ScanPage`), in stanga listei de reguli.
 *
 * - Chenarele sunt desenate de interfata peste imagine (nu sunt "arse" in ea), in procente din
 *   dimensiunea capturii, deci se scaleaza corect pe orice ecran.
 * - Problemele detectate au chenar rosu continuu, cele de verificat manual chenar portocaliu
 *   punctat (culoarea nu e singurul indiciu, WCAG 1.4.1); fiecare chenar are numarul regulii.
 * - Regula activa (mouse deasupra, focus sau regula deschisa in lista) isi evidentiaza
 *   elementele, celelalte se estompeaza, iar captura deruleaza pana la primul element.
 * - Un clic pe un chenar deschide regula in lista (scurtatura pentru mouse).
 * - Elementele cat toata pagina (ex. <html> la "html-has-lang") nu primesc chenar: ar acoperi
 *   tot. Regulile lor apar ca etichete "Pentru toata pagina", iar cand sunt active, conturul
 *   capturii se coloreaza.
 * - Fara regula activa, chenarele sunt doar contur si numarul apare pe primul element al
 *   fiecarei reguli (harta ramane lizibila); regula activa isi numeroteaza toate elementele.
 *
 * Accesibilitate: harta e un ajutor vizual. Zona capturii se poate derula si din tastatura
 * (primeste focus, apoi sagetile o deruleaza). Chenarele nu sunt focusabile (ar insemna sute de
 * opriri cu Tab) si sunt ascunse cititoarelor de ecran; echivalentul complet, accesibil din
 * tastatura, e lista regulilor. Imaginea are un text alternativ care spune asta.
 */
import { useEffect, useRef } from 'react';
import type { RuleResult, ScreenshotInfo } from '@ro-a11y/shared';

export interface MapRule {
  rule: RuleResult;
  /** Numarul regulii in lista (apare si pe chenare, ca legatura vizuala). */
  number: number;
}

/** Peste ce parte din latimea si inaltimea capturii un element e considerat "toata pagina". */
const PAGE_LEVEL_SHARE = 0.9;

/** Spatiul lasat deasupra elementului cand captura deruleaza pana la el, in pixeli de ecran. */
const SCROLL_MARGIN = 48;

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function IssueMap({
  screenshot,
  rules,
  activeRuleId,
  onSelectRule,
}: {
  screenshot: ScreenshotInfo;
  rules: MapRule[];
  activeRuleId: string | null;
  onSelectRule: (ruleId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Elementele care apar in captura (cele ascunse sau sub limita capturii nu au chenar)
  const visibleElements = rules.flatMap(({ rule, number }) =>
    rule.affectedElements
      .filter((el) => el.box && el.box.y < screenshot.height)
      .map((el) => ({ rule, number, element: el, box: el.box! })),
  );
  const isPageLevel = (box: { width: number; height: number }) =>
    box.width >= screenshot.width * PAGE_LEVEL_SHARE &&
    box.height >= screenshot.height * PAGE_LEVEL_SHARE;
  const markers = visibleElements.filter((m) => !isPageLevel(m.box));
  // Regulile care privesc toata pagina (o eticheta pentru fiecare regula)
  const pageRules = rules.filter(({ rule }) =>
    visibleElements.some((m) => m.rule.id === rule.id && isPageLevel(m.box)),
  );
  const pageRuleActive = pageRules.some(({ rule }) => rule.id === activeRuleId);
  // Primul element al fiecarei reguli poarta numarul ei
  const firstOfRule = new Set<string>();
  for (const m of [...markers].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) {
    if (![...firstOfRule].some((id) => id.startsWith(`${m.rule.id}:`))) {
      firstOfRule.add(`${m.rule.id}:${m.element.id}`);
    }
  }
  // Cele mari (ex. toata pagina, pentru "html-has-lang") se deseneaza primele, ca chenarele mici
  // sa ramana deasupra si sa poata fi apasate
  markers.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  const totalElements = rules.reduce((n, { rule }) => n + rule.affectedElements.length, 0);
  const hidden = totalElements - visibleElements.length;

  // Regula activa: derulam captura pana la primul ei element
  useEffect(() => {
    if (!activeRuleId) return;
    const first = markers.find((m) => m.rule.id === activeRuleId);
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!first || !viewport || !canvas) return;
    const scale = canvas.clientWidth / screenshot.width;
    viewport.scrollTo({
      top: Math.max(0, first.box.y * scale - SCROLL_MARGIN),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    // Derularea depinde doar de regula activa (nu si de fiecare redesenare a listei)
  }, [activeRuleId]);

  return (
    <figure className="issue-map" aria-labelledby="harta-titlu">
      <figcaption className="issue-map__caption">
        <span id="harta-titlu" className="issue-map__title">
          Harta problemelor
        </span>
        <span className="issue-map__legend" aria-hidden="true">
          <span className="issue-map__key issue-map__key--violation">Problemă detectată</span>
          <span className="issue-map__key issue-map__key--incomplete">De verificat</span>
        </span>
        {pageRules.length > 0 && (
          <span className="issue-map__page-rules" aria-hidden="true">
            Pentru toată pagina:
            {pageRules.map(({ rule, number }) => (
              <span
                key={rule.id}
                className={`issue-map__chip issue-map__chip--${rule.category}${rule.id === activeRuleId ? ' is-active' : ''}`}
                title={rule.trace.axeRule.titleRo ?? rule.title}
                onClick={() => onSelectRule(rule.id)}
              >
                {number}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      {/* Zona derulabila se poate derula si din tastatura (focus + sageti), WCAG 2.1.1 */}
      <div
        ref={viewportRef}
        className="issue-map__viewport"
        tabIndex={0}
        role="region"
        aria-label="Captura paginii (se derulează cu săgețile)"
      >
        <div
          ref={canvasRef}
          className={`issue-map__canvas${activeRuleId ? ' issue-map__canvas--focused' : ''}${pageRuleActive ? ' issue-map__canvas--page' : ''}`}
          style={{ aspectRatio: `${screenshot.width} / ${screenshot.height}` }}
        >
          <img
            className="issue-map__image"
            src={screenshot.url}
            width={screenshot.width}
            height={screenshot.height}
            alt={`Captura paginii scanate, cu ${markers.length} ${markers.length === 1 ? 'element marcat' : 'elemente marcate'}. Fiecare element este descris în lista regulilor.`}
            decoding="async"
          />
          <div className="issue-map__boxes" aria-hidden="true">
            {markers.map(({ rule, number, element, box }) => (
              <div
                key={element.id}
                className={`issue-map__box issue-map__box--${rule.category}${rule.id === activeRuleId ? ' is-active' : ''}`}
                style={{
                  left: percent(box.x, screenshot.width),
                  top: percent(box.y, screenshot.height),
                  width: percent(box.width, screenshot.width),
                  height: percent(box.height, screenshot.height),
                }}
                title={rule.trace.axeRule.titleRo ?? rule.title}
                onClick={() => onSelectRule(rule.id)}
              >
                {(rule.id === activeRuleId || firstOfRule.has(`${rule.id}:${element.id}`)) && (
                  <span className="issue-map__number">{number}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {(hidden > 0 || screenshot.truncated) && (
        <p className="issue-map__note">
          {hidden > 0 &&
            `${hidden === 1 ? '1 element nu apare' : `${hidden} elemente nu apar`} în captură (ascunse, fără dimensiune, într-un cadru încorporat sau sub limita capturii). `}
          {screenshot.truncated &&
            `Pagina are ${screenshot.pageHeight} px înălțime; captura arată primii ${screenshot.height} px.`}
        </p>
      )}
    </figure>
  );
}
