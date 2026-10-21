/**
 * Sectiune pliabila: un titlu pe care il apesi ca sa vezi continutul (element HTML <details>).
 *
 * Titlul e un <h3>, deci cititoarele de ecran pot naviga intre sectiuni dupa titluri, iar
 * `hint` arata un rezumat scurt (ex. "3 elemente"), ca utilizatorul sa stie ce gaseste inainte
 * sa deschida. <details> e accesibil nativ: se deschide din tastatura (Enter sau Spatiu) si
 * starea (deschis / inchis) e anuntata de cititorul de ecran.
 */
import type { ReactNode } from 'react';

export function CollapsibleSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="fold">
      <summary className="fold__summary">
        <h3 className="fold__title">{title}</h3>
        {hint && <span className="fold__hint">{hint}</span>}
      </summary>
      <div className="fold__body">{children}</div>
    </details>
  );
}
