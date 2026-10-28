/**
 * Afisarea evaluarii OUG 112/2018 a unui proiect: statusul, pe ce se bazeaza (cu citatele
 * exacte din lege), ce informatii lipsesc, ce trebuie confirmat de un specialist si sursa.
 *
 * Folosita pe pagina profilului juridic. `ApplicabilityBadge` e folosit si in pagina
 * proiectului si in Traceability Explorer.
 *
 * Statusul e scris in text (nu doar prin culoare), iar avertismentul ca evaluarea e doar
 * informativa apare mereu.
 */
import type { ReactNode } from 'react';
import type { ApplicabilityStatus, LegalProfile } from '@ro-a11y/shared';
import { APPLICABILITY_LABELS, formatDate } from '../lib/labels';

export function ApplicabilityBadge({ status }: { status: ApplicabilityStatus }) {
  return (
    <span className={`badge badge--legal-${status.replaceAll('_', '-')}`}>
      {APPLICABILITY_LABELS[status]}
    </span>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="assessment__block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function LegalAssessmentView({ profile }: { profile: LegalProfile }) {
  const { assessment } = profile;

  return (
    <div className="assessment">
      <p className="assessment__status">
        <ApplicabilityBadge status={assessment.status} />
      </p>
      <p className="assessment__summary">{assessment.summary}</p>
      <p className="muted">
        Evaluat la {formatDate(profile.updatedAt)} · versiunea catalogului{' '}
        {assessment.catalogVersion}
      </p>

      {assessment.reasons.length > 0 && (
        <Block title="Pe ce se bazează">
          <ul className="assessment__reasons">
            {assessment.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>
                <p>
                  <strong>{reason.articleRef}</strong>: {reason.text}
                </p>
                <blockquote className="trace__quote">„{reason.quote}”</blockquote>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {assessment.missingFacts.length > 0 && (
        <Block title="Ce informații lipsesc">
          <ul>
            {assessment.missingFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </Block>
      )}

      {assessment.toConfirm.length > 0 && (
        <Block title="De confirmat de un specialist">
          <ul>
            {assessment.toConfirm.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Block>
      )}

      {assessment.notes.length > 0 && (
        <Block title="De reținut">
          <ul>
            {assessment.notes.map((note) => (
              <li key={note.articleRef}>
                <strong>{note.articleRef}</strong>: {note.text}
              </li>
            ))}
          </ul>
        </Block>
      )}

      <p className="trace__source">
        Sursa:{' '}
        <a href={assessment.source.url} target="_blank" rel="noreferrer">
          {assessment.source.name}
          <span className="visually-hidden"> (se deschide într-o filă nouă)</span>
        </a>
        , Portalul Legislativ, consultat la {assessment.source.retrievedAt}.
      </p>
      <p className="trace__disclaimer">{assessment.disclaimer}</p>
    </div>
  );
}
