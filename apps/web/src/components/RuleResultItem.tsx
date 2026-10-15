/**
 * Un rezultat pe regula, afisat ca element expandabil (<details>): in forma restransa arata
 * titlul, gravitatea, criteriile WCAG si numarul de elemente; deschis, arata descrierea,
 * documentatia si fiecare element afectat (selector, explicatia motorului, fragmentul HTML).
 *
 * Securitate: fragmentul HTML al paginii scanate e afisat ca TEXT (React il "escapeaza"),
 * niciodata interpretat, deci un site rau intentionat nu poate injecta cod in aplicatia noastra.
 */
import type { RuleResult } from '@ro-a11y/shared';
import { ImpactBadge } from './Badges';

function selectorText(cssSelector: unknown): string {
  return Array.isArray(cssSelector) ? cssSelector.join(' → ') : JSON.stringify(cssSelector);
}

export function RuleResultItem({ result }: { result: RuleResult }) {
  const count = result.affectedElements.length;

  return (
    <li className="rule">
      <details>
        <summary>
          <span className="rule__title">{result.title}</span>
          <span className="rule__meta">
            <ImpactBadge impact={result.impact} />
            <code className="rule__id">{result.axeRuleId}</code>
            {result.wcagCriteria.map((c) => (
              <span key={c} className="tag">
                WCAG {c}
              </span>
            ))}
            {result.isBestPractice && <span className="tag tag--muted">Bună practică</span>}
            {count > 0 && (
              <span className="rule__count">
                {count} {count === 1 ? 'element' : 'elemente'}
              </span>
            )}
          </span>
        </summary>

        <div className="rule__body">
          <p>{result.description}</p>
          <p>
            <a href={result.docsUrl} target="_blank" rel="noreferrer">
              Documentația regulii {result.axeRuleId} (Deque, în engleză)
              <span className="visually-hidden"> — se deschide într-o filă nouă</span>
            </a>
          </p>

          {count > 0 && (
            <>
              <h3 className="rule__subheading">Elemente afectate</h3>
              <ol className="element-list">
                {result.affectedElements.map((el) => (
                  <li key={el.id} className="element">
                    <p className="element__label">Selector CSS</p>
                    <code className="element__selector">{selectorText(el.cssSelector)}</code>
                    {el.failureSummary && (
                      <>
                        <p className="element__label">Ce a găsit motorul</p>
                        <pre className="element__summary">{el.failureSummary}</pre>
                      </>
                    )}
                    <p className="element__label">Fragment HTML</p>
                    <pre className="element__html">
                      <code>{el.htmlSnippet}</code>
                    </pre>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </details>
    </li>
  );
}
