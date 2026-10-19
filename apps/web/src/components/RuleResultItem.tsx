/**
 * Un rezultat pe regula, afisat ca element expandabil (<details>).
 *
 * Restrans: titlul (in romana, daca exista explicatie), gravitatea, criteriile WCAG, numarul de
 * elemente. Deschis: explicatia si remedierea in romana, lantul de trasabilitate (Traceability
 * Explorer) si fiecare element afectat (selector, explicatia motorului, fragmentul HTML).
 *
 * Securitate: fragmentul HTML al paginii scanate e afisat ca TEXT (React il "escapeaza"),
 * niciodata interpretat, deci un site rau intentionat nu poate injecta cod in aplicatia noastra.
 */
import type { RuleResult } from '@ro-a11y/shared';
import { ImpactBadge } from './Badges';
import { RemediationPanel } from './RemediationPanel';
import { TraceabilityExplorer } from './TraceabilityExplorer';

function selectorText(cssSelector: unknown): string {
  return Array.isArray(cssSelector) ? cssSelector.join(' → ') : JSON.stringify(cssSelector);
}

export function RuleResultItem({ result }: { result: RuleResult }) {
  const count = result.affectedElements.length;
  const remediation = result.trace.remediation;

  return (
    <li className="rule">
      <details>
        <summary>
          <span className="rule__title">{remediation?.titleRo ?? result.title}</span>
          {remediation && (
            <span className="rule__title-en" lang="en">
              {result.title}
            </span>
          )}
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
          {remediation ? (
            <RemediationPanel remediation={remediation} status={result.trace.remediationStatus} />
          ) : (
            <p>
              <span lang="en">{result.description}</span>{' '}
              <span className="muted">(descrierea motorului, în engleză)</span>
            </p>
          )}

          <TraceabilityExplorer trace={result.trace} elementCount={count} />

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
                        <p className="element__label">Ce a găsit motorul (în engleză)</p>
                        <pre className="element__summary" lang="en">
                          {el.failureSummary}
                        </pre>
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
