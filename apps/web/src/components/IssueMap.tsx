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
 * - Numarul regulii e o eticheta lipita de chenar, pe dinafara (in stanga lui; deasupra, sub
 *   el sau in colt cand nu are loc), ca sa nu acopere textul din chenar si sa nu fie taiata de
 *   marginea ecranului.
 * - Fara regula activa, chenarele sunt doar contur si numarul apare pe primul element al
 *   fiecarei reguli (harta ramane lizibila); regula activa isi numeroteaza toate elementele.
 *
 * - O pagina statica e o singura imagine continua. O pagina care se schimba la derulare e aratata
 *   ecran cu ecran (cum o vede un vizitator cand deruleaza): fiecare ecran e o fotografie
 *   separata, cu numarul lui si pozitia derularii; elementele lipite pe ecran (meniuri, panouri)
 *   apar in mai multe ecrane, ca in realitate. Scanarile vechi au tot o singura imagine.
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

/**
 * Cat loc (in pixeli de imagine) trebuie sa fie langa un chenar ca eticheta cu numarul sa stea
 * acolo. Eticheta are ~20 px pe ecran, iar captura e afisata micsorata (cam la jumatate).
 */
const LABEL_ROOM = 40;

/**
 * Unde sta eticheta cu numarul, pe dinafara chenarului, ca sa nu acopere continutul lui:
 *   - in stanga (de obicei marginea libera a paginii; nu cade nici peste chenarele care il
 *     cuprind, care incep de regula in aceeasi coloana);
 *   - deasupra, daca chenarul e lipit de marginea stanga;
 *   - sub el, daca e lipit si de marginea de sus a ecranului;
 *   - in coltul lui, pe dinauntru, daca nu are loc nicaieri (ex. un antet cat ecranul).
 */
function labelPlacement(
  box: { x: number; y: number; height: number },
  frame: { top: number; height: number },
): 'left' | 'above' | 'below' | 'inside' {
  if (box.x >= LABEL_ROOM) return 'left';
  if (box.y - frame.top >= LABEL_ROOM) return 'above';
  if (frame.top + frame.height - (box.y + box.height) >= LABEL_ROOM) return 'below';
  return 'inside';
}

/** Spatiul lasat deasupra elementului cand captura deruleaza pana la el, in pixeli de ecran. */
const SCROLL_MARGIN = 48;

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Un ecran al capturii: unde incepe in imagine, cat e de inalt, la ce derulare a fost facut. */
interface Frame {
  index: number;
  top: number;
  height: number;
  offset: number | null;
}

function framesOf(screenshot: ScreenshotInfo): Frame[] {
  const { frameHeight, frameOffsets } = screenshot;
  if (!frameHeight || frameOffsets.length === 0) {
    return [{ index: 0, top: 0, height: screenshot.height, offset: null }];
  }
  return frameOffsets.map((offset, index) => ({
    index,
    top: index * frameHeight,
    height: frameHeight,
    offset,
  }));
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
  const frames = framesOf(screenshot);
  const multiFrame = frames.length > 1;
  const frameAt = (y: number) =>
    frames.find((f) => y >= f.top && y < f.top + f.height) ?? frames[frames.length - 1]!;

  // Elementele care apar in captura (cele ascunse sau sub limita capturii nu au chenar)
  const visibleElements = rules.flatMap(({ rule, number }) =>
    rule.affectedElements
      .filter((el) => el.box && el.box.y < screenshot.height)
      .map((el) => ({ rule, number, element: el, box: el.box!, frame: frameAt(el.box!.y) })),
  );
  // Cat tot ecranul (ex. <html>): nu primeste chenar, ar acoperi tot
  const isPageLevel = (box: { width: number; height: number }, frame: Frame) =>
    box.width >= screenshot.width * PAGE_LEVEL_SHARE &&
    box.height >= frame.height * PAGE_LEVEL_SHARE;
  const markers = visibleElements.filter((m) => !isPageLevel(m.box, m.frame));
  // Regulile care privesc toata pagina (o eticheta pentru fiecare regula)
  const pageRules = rules.filter(({ rule }) =>
    visibleElements.some((m) => m.rule.id === rule.id && isPageLevel(m.box, m.frame)),
  );
  const pageRuleActive = pageRules.some(({ rule }) => rule.id === activeRuleId);
  // Primul element al fiecarei reguli poarta numarul ei
  const firstOfRule = new Set<string>();
  for (const m of [...markers].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) {
    if (![...firstOfRule].some((id) => id.startsWith(`${m.rule.id}:`))) {
      firstOfRule.add(`${m.rule.id}:${m.element.id}`);
    }
  }
  // Cele mari se deseneaza primele, ca chenarele mici sa ramana deasupra si sa poata fi apasate
  markers.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  const totalElements = rules.reduce((n, { rule }) => n + rule.affectedElements.length, 0);
  const hidden = totalElements - visibleElements.length;
  const lastFrame = frames[frames.length - 1]!;
  const shownHeight =
    lastFrame.offset === null ? screenshot.height : lastFrame.offset + lastFrame.height;

  // Regula activa: derulam captura pana la primul ei chenar (pozitia lui reala pe ecran)
  useEffect(() => {
    if (!activeRuleId) return;
    const viewport = viewportRef.current;
    const first = markers
      .filter((m) => m.rule.id === activeRuleId)
      .sort((a, b) => a.box.y - b.box.y)[0];
    if (!first || !viewport) return;
    const marker = viewport.querySelector(`[data-element-id="${first.element.id}"]`);
    if (!marker) return;
    const offset = marker.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    viewport.scrollTo({
      top: Math.max(0, viewport.scrollTop + offset - SCROLL_MARGIN),
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
      {multiFrame && (
        <p className="issue-map__intro">
          Pagina e fotografiată ecran cu ecran, cum o vede un vizitator când derulează. Elementele
          care rămân lipite pe ecran (meniuri, panouri animate) apar în mai multe ecrane.
        </p>
      )}
      {/* Zona derulabila se poate derula si din tastatura (focus + sageti), WCAG 2.1.1 */}
      <div
        ref={viewportRef}
        className="issue-map__viewport"
        tabIndex={0}
        role="region"
        aria-label="Captura paginii (se derulează cu săgețile)"
      >
        {frames.map((frame) => (
          <div key={frame.index} className="issue-map__frame">
            {multiFrame && (
              <p className="issue-map__frame-label" aria-hidden="true">
                Ecranul {frame.index + 1} din {frames.length}
                {frame.offset !== null && ` · derulat la ${frame.offset} px`}
              </p>
            )}
            <div
              className={`issue-map__canvas${activeRuleId ? ' issue-map__canvas--focused' : ''}${pageRuleActive ? ' issue-map__canvas--page' : ''}`}
              style={{ aspectRatio: `${screenshot.width} / ${frame.height}` }}
            >
              {/* Aceeasi imagine pentru toate ecranele (se descarca o data), decupata la ecranul lui */}
              <img
                className="issue-map__image"
                src={screenshot.url}
                width={screenshot.width}
                height={screenshot.height}
                style={{
                  height: `${(screenshot.height / frame.height) * 100}%`,
                  top: `-${(frame.top / frame.height) * 100}%`,
                }}
                alt={
                  frame.index === 0
                    ? `Captura paginii scanate${multiFrame ? `, în ${frames.length} ecrane` : ''}, cu ${markers.length} ${markers.length === 1 ? 'element marcat' : 'elemente marcate'}. Fiecare element este descris în lista regulilor.`
                    : ''
                }
                decoding="async"
              />
              <div className="issue-map__boxes" aria-hidden="true">
                {markers
                  .filter((m) => m.frame.index === frame.index)
                  .map(({ rule, number, element, box, frame: f }) => (
                    <div
                      key={element.id}
                      data-element-id={element.id}
                      className={`issue-map__box issue-map__box--${rule.category}${rule.id === activeRuleId ? ' is-active' : ''}`}
                      style={{
                        left: percent(box.x, screenshot.width),
                        top: percent(box.y - frame.top, frame.height),
                        width: percent(box.width, screenshot.width),
                        height: percent(box.height, frame.height),
                      }}
                      title={rule.trace.axeRule.titleRo ?? rule.title}
                      onClick={() => onSelectRule(rule.id)}
                    >
                      {(rule.id === activeRuleId ||
                        firstOfRule.has(`${rule.id}:${element.id}`)) && (
                        <span
                          className={`issue-map__number issue-map__number--${labelPlacement(box, f)}`}
                        >
                          {number}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {(hidden > 0 || screenshot.truncated) && (
        <p className="issue-map__note">
          {hidden > 0 &&
            `${hidden === 1 ? '1 element nu apare' : `${hidden} elemente nu apar`} în captură (ascunse, fără dimensiune, într-un cadru încorporat sau sub limita capturii). `}
          {screenshot.truncated &&
            `Pagina are ${screenshot.pageHeight} px înălțime; captura arată primii ${shownHeight} px.`}
        </p>
      )}
    </figure>
  );
}
