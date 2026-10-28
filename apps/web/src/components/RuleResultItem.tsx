/**
 * Un rezultat pe regula, afisat ca element expandabil (<details>).
 *
 * Restrans: titlul (in romana, daca exista explicatie), gravitatea, criteriile WCAG, numarul de
 * elemente. Deschis: un rezumat scurt mereu vizibil ("Pe scurt") si sectiuni pliabile, in ordinea
 * in care le cauta de obicei utilizatorul:
 *   1. Unde apare (elementele afectate)   -> "unde e problema?"
 *   2. Cum repari                          -> "ce fac?"
 *   3. Cum verifici reparatia              -> dupa reparare
 *   4. Trasabilitate normativa             -> WCAG -> EN 301 549 -> OUG 112/2018
 *   5. Detalii tehnice                     -> regula axe, documentatia, textul original
 *
 * Securitate: fragmentul HTML al paginii scanate e afisat ca TEXT (React il "escapeaza"),
 * niciodata interpretat, deci un site rau intentionat nu poate injecta cod in aplicatia noastra.
 */
import type { RuleResult } from '@ro-a11y/shared';
import { ImpactBadge } from './Badges';
import { CollapsibleSection } from './CollapsibleSection';
import { HowToFix, HowToVerify } from './RemediationPanel';
import { TraceabilityExplorer, traceSummary } from './TraceabilityExplorer';

function selectorText(cssSelector: unknown): string {
  return Array.isArray(cssSelector) ? cssSelector.join(' → ') : JSON.stringify(cssSelector);
}

export function RuleResultItem({
  result,
  legalProfileHref,
}: {
  result: RuleResult;
  legalProfileHref?: string;
}) {
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
          <div className="rule__intro">
            {remediation ? (
              <>
                <p>{remediation.whatItMeans}</p>
                <p>
                  <strong>Pe cine afectează:</strong> {remediation.whoIsAffected}
                </p>
              </>
            ) : (
              <p>
                <span lang="en">{result.description}</span>{' '}
                <span className="muted">(descrierea motorului, în engleză)</span>
              </p>
            )}
          </div>

          {count > 0 && (
            <CollapsibleSection
              title="Unde apare: elemente afectate"
              hint={`${count} ${count === 1 ? 'element' : 'elemente'}`}
            >
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
            </CollapsibleSection>
          )}

          {remediation && (
            <>
              <CollapsibleSection
                title="Cum repari"
                hint={`${remediation.howToFix.length} pași · exemplu înainte / după`}
              >
                <HowToFix remediation={remediation} />
              </CollapsibleSection>
              <CollapsibleSection
                title="Cum verifici reparația"
                hint={`${remediation.howToVerify.length} ${remediation.howToVerify.length === 1 ? 'pas' : 'pași'}`}
              >
                <HowToVerify remediation={remediation} status={result.trace.remediationStatus} />
              </CollapsibleSection>
            </>
          )}

          <CollapsibleSection title="Trasabilitate normativă" hint={traceSummary(result.trace)}>
            <TraceabilityExplorer
              trace={result.trace}
              elementCount={count}
              legalProfileHref={legalProfileHref}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Detalii tehnice" hint={`axe-core · ${result.axeRuleId}`}>
            <dl className="details-list">
              <dt>Regula axe-core</dt>
              <dd>
                <code>{result.axeRuleId}</code>
              </dd>
              <dt>Versiunea motorului</dt>
              <dd>{result.trace.axeRule.engineVersion ?? '—'}</dd>
              <dt>Titlul original</dt>
              <dd lang="en">{result.title}</dd>
              <dt>Descrierea originală</dt>
              <dd lang="en">{result.description}</dd>
              <dt>Etichete</dt>
              <dd>
                <code>{result.axeTags.join(', ')}</code>
              </dd>
              <dt>Documentație</dt>
              <dd>
                <a href={result.docsUrl} target="_blank" rel="noreferrer">
                  Documentația regulii {result.axeRuleId} (Deque, în engleză)
                  <span className="visually-hidden"> (se deschide într-o filă nouă)</span>
                </a>
              </dd>
            </dl>
          </CollapsibleSection>
        </div>
      </details>
    </li>
  );
}
