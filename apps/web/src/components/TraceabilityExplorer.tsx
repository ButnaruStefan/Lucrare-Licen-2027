/**
 * Traceability Explorer: lantul care leaga o problema tehnica de normele relevante,
 *
 *   regula axe -> criteriu WCAG -> clauza EN 301 549 -> prevederi OUG 112/2018 -> aplicabilitate
 *
 * afisat ca lista ordonata de pasi (in sectiunea pliabila "Trasabilitate normativa"). Fiecare pas arata sursa si statusul verificarii (confirmat,
 * dedus, conflict, de validat), ca utilizatorul sa vada clar ce e sigur si ce nu.
 * Lantul arata relevanta normativa POSIBILA, nu o incalcare a legii.
 */
import type { ReactNode } from 'react';
import type { Trace, TraceEn } from '@ro-a11y/shared';

const PRINCIPLE_LABELS = {
  perceptibil: 'Perceptibil',
  operabil: 'Operabil',
  inteligibil: 'Inteligibil',
  robust: 'Robust',
} as const;

const EN_STATUS_LABELS: Record<TraceEn['status'], string> = {
  confirmed: 'Confirmat (2 surse)',
  derived: 'Dedus, de verificat',
  none: 'Fără clauză în această ediție',
  conflict: 'Conflict între surse',
};

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <span className="visually-hidden"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

export function TraceabilityExplorer({
  trace,
  elementCount,
}: {
  trace: Trace;
  elementCount: number;
}) {
  return (
    <section className="trace" aria-label={`Trasabilitate pentru regula ${trace.axeRule.id}`}>
      <ol className="trace__steps">
        <li className="trace__step">
          <p className="trace__kind">Constatare tehnică</p>
          <p className="trace__main">
            Regula <code>{trace.axeRule.id}</code> (axe-core {trace.axeRule.engineVersion ?? ''})
            {elementCount > 0 &&
              ` — ${elementCount} ${elementCount === 1 ? 'element afectat' : 'elemente afectate'}`}
          </p>
          <p className="trace__source">
            <ExternalLink href={trace.axeRule.docsUrl}>Documentația regulii (Deque)</ExternalLink>
          </p>
        </li>

        {trace.isBestPractice || trace.wcag.length === 0 ? (
          <li className="trace__step trace__step--end">
            <p className="trace__kind">Fără legătură normativă</p>
            <p className="trace__main">
              {trace.isBestPractice
                ? 'Este o regulă de bună practică: nu corespunde unui criteriu WCAG, deci nu are legătură cu EN 301 549 sau cu legislația.'
                : 'Regula nu are un criteriu WCAG asociat în catalog.'}
            </p>
          </li>
        ) : (
          <>
            <li className="trace__step">
              <p className="trace__kind">Criteriu WCAG 2.2</p>
              <ul className="trace__list">
                {trace.wcag.map((c) => (
                  <li key={c.number}>
                    <p className="trace__main">
                      <strong>{c.number}</strong> {c.titleRo ?? c.titleEn}{' '}
                      <span className="tag">Nivel {c.level}</span>{' '}
                      <span className="tag">Principiul {PRINCIPLE_LABELS[c.principle]}</span>
                      {c.newInWcag22 && <span className="tag tag--muted">Nou în WCAG 2.2</span>}
                    </p>
                    <p className="trace__source">
                      Titlul oficial: <span lang="en">{c.titleEn}</span>.{' '}
                      {c.titleRo && <>Titlul în română: {c.titleRoStatus}. </>}
                      {c.understandingUrl && (
                        <ExternalLink href={c.understandingUrl}>
                          Explicația oficială W3C
                        </ExternalLink>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </li>

            <li className="trace__step">
              <p className="trace__kind">
                {trace.enEdition.standard} {trace.enEdition.version}
              </p>
              <ul className="trace__list">
                {trace.en.map((link) => (
                  <li key={link.wcagNumber}>
                    <p className="trace__main">
                      {link.clause ? (
                        <>
                          Clauza <strong>{link.clause}</strong>
                        </>
                      ) : (
                        <>Criteriul {link.wcagNumber}</>
                      )}{' '}
                      <span className={`badge badge--trace-${link.status}`}>
                        {EN_STATUS_LABELS[link.status]}
                      </span>
                    </p>
                    <p className="trace__source">{link.explanation}</p>
                  </li>
                ))}
              </ul>
              <p className="trace__source">
                Standard armonizat prin{' '}
                <ExternalLink href={trace.enEdition.harmonisedBySourceUrl}>
                  {trace.enEdition.harmonisedBy}
                </ExternalLink>{' '}
                (verificat la {trace.enEdition.verifiedAt}).
              </p>
            </li>

            {trace.legal.length > 0 && (
              <li className="trace__step">
                <p className="trace__kind">OUG nr. 112/2018</p>
                <ul className="trace__list">
                  {trace.legal.map((provision) => (
                    <li key={provision.articleRef}>
                      <p className="trace__main">
                        <strong>{provision.articleRef}</strong>{' '}
                        <span className="badge badge--trace-review">
                          Text verificat · relevanță de validat
                        </span>
                      </p>
                      <blockquote className="trace__quote">„{provision.quote}”</blockquote>
                      <p className="trace__source">{provision.explanation}</p>
                    </li>
                  ))}
                </ul>
                <p className="trace__source">
                  Sursa:{' '}
                  <ExternalLink href={trace.legalFramework.sourceUrl}>
                    Portalul Legislativ
                  </ExternalLink>
                  , consultat la {trace.legalFramework.retrievedAt}.
                </p>
              </li>
            )}

            <li className="trace__step trace__step--end">
              <p className="trace__kind">Aplicabilitate pentru acest site</p>
              <p className="trace__main">
                <span className="badge badge--trace-none">Neevaluată</span>{' '}
                {trace.applicability.message}
              </p>
            </li>
          </>
        )}
      </ol>
      <p className="trace__disclaimer">
        Lanțul arată relevanța normativă posibilă a unei constatări tehnice. Nu reprezintă o
        concluzie juridică și nu stabilește încălcarea vreunei legi.
      </p>
    </section>
  );
}

/** Rezumatul lantului, afisat in titlul sectiunii (ex. "WCAG 1.1.1 · EN 9.1.1.1 · OUG 112/2018"). */
export function traceSummary(trace: Trace): string {
  if (trace.isBestPractice || trace.wcag.length === 0)
    return 'Bună practică: fără legătură normativă';
  const parts = [`WCAG ${trace.wcag.map((c) => c.number).join(', ')}`];
  const clauses = trace.en.filter((l) => l.clause).map((l) => l.clause);
  parts.push(clauses.length > 0 ? `EN ${clauses.join(', ')}` : 'fără clauză EN');
  if (trace.legal.length > 0) parts.push('OUG 112/2018');
  return parts.join(' · ');
}
