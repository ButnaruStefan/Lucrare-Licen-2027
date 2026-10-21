/**
 * Remedierea in romana pentru o regula, in doua parti afisate in sectiuni separate:
 *   - `HowToFix`: pasii de reparare si exemplul "inainte / dupa";
 *   - `HowToVerify`: cum se verifica reparatia, plus statusul continutului (de revizuit).
 * Codul din exemple e afisat ca text, niciodata interpretat.
 */
import type { Remediation } from '@ro-a11y/shared';

export function HowToFix({ remediation }: { remediation: Remediation }) {
  return (
    <>
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
    </>
  );
}

export function HowToVerify({ remediation, status }: { remediation: Remediation; status: string }) {
  return (
    <>
      <ul>
        {remediation.howToVerify.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      <p className="muted remediation__status">Conținut {status}.</p>
    </>
  );
}
