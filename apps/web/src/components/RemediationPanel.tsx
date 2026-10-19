/**
 * Explicatia si remedierea in romana pentru o regula: ce inseamna, pe cine afecteaza,
 * cum se repara (cu exemplu "inainte / dupa") si cum se verifica reparatia.
 * Codul din exemple e afisat ca text, niciodata interpretat.
 */
import type { Remediation } from '@ro-a11y/shared';

export function RemediationPanel({
  remediation,
  status,
}: {
  remediation: Remediation;
  status: string;
}) {
  return (
    <section className="remediation" aria-label={`Cum repari: ${remediation.titleRo}`}>
      <h3 className="rule__subheading">Ce înseamnă și cum repari</h3>
      <p>{remediation.whatItMeans}</p>
      <p>
        <strong>Pe cine afectează:</strong> {remediation.whoIsAffected}
      </p>

      <h4 className="remediation__heading">Cum repari</h4>
      <ul>
        {remediation.howToFix.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <div className="remediation__example">
        <div>
          <p className="element__label">Înainte</p>
          <pre className="code code--before">
            <code>{remediation.example.before}</code>
          </pre>
        </div>
        <div>
          <p className="element__label">După</p>
          <pre className="code code--after">
            <code>{remediation.example.after}</code>
          </pre>
        </div>
      </div>
      {remediation.example.note && <p className="muted">{remediation.example.note}</p>}

      <h4 className="remediation__heading">Cum verifici reparația</h4>
      <ul>
        {remediation.howToVerify.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      <p className="muted remediation__status">Conținut {status}.</p>
    </section>
  );
}
