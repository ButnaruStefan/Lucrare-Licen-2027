/**
 * Sectiunea "Aspect si afisare" de pe pagina unei scanari: rezultatul verificarii aspectului
 * paginii (separata complet de accesibilitate si de legislatie).
 *
 * Arata:
 *   - cate latimi ale ferestrei au fost verificate si cat a durat;
 *   - sumarul semnalelor, pe niveluri ("Se vede sigur", "De confirmat");
 *   - fiecare semnal: ce s-a intamplat, la ce latimi, captura decupata la latimea problemei
 *     (cu chenarele elementelor si, la derulare, marginea ecranului), elementele implicate,
 *     cum se repara si sursa regulii;
 *   - breakpoint-urile gasite in CSS-ul paginii si eticheta meta viewport (informativ).
 *
 * Accesibilitate: fiecare semnal e un <details> (se deschide din tastatura); captura are text
 * alternativ, iar chenarele sunt doar decor (elementele sunt descrise si in text).
 */
import type { LayoutIssue, Scan, ScanLayout } from '@ro-a11y/shared';
import { useScanLayout } from '../api/queries';
import { EmptyState, ErrorMessage, Loading } from './Feedback';
import {
  LAYOUT_KIND_INFO,
  LAYOUT_LEVEL_DESCRIPTIONS,
  LAYOUT_LEVEL_LABELS,
  widthRangeLabel,
} from '../lib/layout-labels';

export function LayoutPanel({ scan }: { scan: Scan }) {
  const layout = useScanLayout(scan.id, scan.status === 'completed');

  return (
    <section aria-labelledby="aspect" className="section layout-panel">
      <h2 id="aspect">Aspect și afișare</h2>
      <p className="notice notice--info">
        Aici verificăm cum se aranjează pagina pe ecrane de lățimi diferite (de la telefon la
        calculator): elemente suprapuse, tăiate sau ieșite din pagină. Nu sunt verificări de
        accesibilitate și nu au legătură cu legislația. Fiecare semnal e găsit automat: confirmă-l
        privind captura.
      </p>
      {layout.isPending && <Loading label="Se încarcă verificarea aspectului..." />}
      {layout.isError && <ErrorMessage error={layout.error} />}
      {layout.data && <LayoutResult layout={layout.data} />}
    </section>
  );
}

function LayoutResult({ layout }: { layout: ScanLayout }) {
  if (layout.error) {
    return (
      <div className="notice notice--error">
        <p className="notice__title">Verificarea aspectului nu s-a putut face</p>
        <p>{layout.error}</p>
        <p className="muted">Restul scanării a fost salvat normal.</p>
      </div>
    );
  }

  const visible = layout.issues.filter((i) => i.level === 'visible');
  const possible = layout.issues.filter((i) => i.level === 'possible');
  const widest = layout.widths[0];
  const narrowest = layout.widths.at(-1);

  return (
    <>
      <p className="layout-panel__intro">
        Am verificat pagina la {layout.widths.length} lățimi ale ferestrei
        {widest !== undefined && narrowest !== undefined && (
          <>
            , de la {widest} la {narrowest} px
          </>
        )}{' '}
        (în {Math.max(1, Math.round(layout.durationMs / 1000))} s), comparând aranjarea la lățimi
        vecine.
      </p>
      {layout.partial && (
        <p className="notice notice--info">
          Pagina e foarte mare: verificarea s-a oprit la limita de timp, înainte de cele mai mici
          lățimi. Semnalele de mai jos sunt cele găsite până atunci.
        </p>
      )}

      <ul className="summary-grid">
        <LevelCard level="visible" count={visible.length} />
        <LevelCard level="possible" count={possible.length} />
        <li className="summary-card summary-card--inapplicable">
          <p className="summary-card__label">Breakpoint-uri în CSS</p>
          <p className="summary-card__value">{uniqueBreakpoints(layout)}</p>
          <p className="summary-card__detail">Lățimile la care pagina își schimbă aranjarea.</p>
        </li>
      </ul>

      {layout.issues.length === 0 ? (
        <EmptyState>Nu am găsit defecte de aranjare la lățimile verificate.</EmptyState>
      ) : (
        <ul className="layout-issues">
          {layout.issues.map((issue) => (
            <LayoutIssueItem key={issue.id} issue={issue} />
          ))}
        </ul>
      )}

      <BreakpointDetails layout={layout} />
    </>
  );
}

function LevelCard({ level, count }: { level: 'visible' | 'possible'; count: number }) {
  return (
    <li
      className={`summary-card ${level === 'visible' ? 'summary-card--violation' : 'summary-card--incomplete'}`}
    >
      <p className="summary-card__label">{LAYOUT_LEVEL_LABELS[level]}</p>
      <p className="summary-card__value">
        {count} <span className="summary-card__unit">{count === 1 ? 'semnal' : 'semnale'}</span>
      </p>
      <p className="summary-card__detail">{LAYOUT_LEVEL_DESCRIPTIONS[level]}</p>
    </li>
  );
}

function uniqueBreakpoints(layout: ScanLayout): number {
  return new Set(layout.breakpoints.map((b) => b.px)).size;
}

function LayoutIssueItem({ issue }: { issue: LayoutIssue }) {
  const info = LAYOUT_KIND_INFO[issue.kind];
  const range = widthRangeLabel(issue.widthMin, issue.widthMax);
  return (
    <li>
      <details className={`layout-issue layout-issue--${issue.level}`}>
        <summary className="layout-issue__summary">
          <span className={`badge badge--layout-${issue.level}`}>
            {LAYOUT_LEVEL_LABELS[issue.level]}
          </span>
          <span className="layout-issue__title">{info.title}</span>
          {range && <span className="layout-issue__range">{range}</span>}
        </summary>
        <div className="layout-issue__body">
          <p>{info.explanation}</p>
          <IssueFacts issue={issue} />
          {issue.image && <IssueImage issue={issue} />}
          {issue.elements.length > 0 && (
            <>
              <h3 className="layout-issue__heading">
                {issue.elements.length === 1 ? 'Elementul implicat' : 'Elementele implicate'}
              </h3>
              <ul className="layout-issue__elements">
                {issue.elements.map((element) => (
                  <li key={element.selector}>
                    {element.text && <p className="layout-issue__text">„{element.text}”</p>}
                    <code className="layout-issue__selector">{element.selector}</code>
                    <pre className="element__html">
                      <code>{element.htmlSnippet}</code>
                    </pre>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="layout-issue__heading">Cum se repară</h3>
          <p>{info.fix}</p>
          <p className="muted layout-issue__source">
            Sursa regulii:{' '}
            <a href={info.source.url} target="_blank" rel="noopener noreferrer">
              {info.source.label}
              <span className="visually-hidden"> (se deschide într-o filă nouă)</span>
            </a>
          </p>
        </div>
      </details>
    </li>
  );
}

/** Masuratorile semnalului, in cuvinte (cu cat iese, cat se suprapun, regulile CSS). */
function IssueFacts({ issue }: { issue: LayoutIssue }) {
  const { details } = issue;
  const facts: string[] = [];
  if (issue.kind === 'derulare-orizontala' && details.pageWidth && details.overflowPx) {
    facts.push(
      `Pagina are ${details.pageWidth} px lățime, cu ${details.overflowPx} px mai mult decât ecranul.`,
    );
  } else if (details.overflowPx) {
    facts.push(`Iese cu ${details.overflowPx} px.`);
  }
  if (details.overlap) {
    facts.push(`Se suprapun pe ${details.overlap.width} × ${details.overlap.height} px.`);
  }
  if (details.metaViewport !== undefined) {
    facts.push(`Eticheta găsită: content="${details.metaViewport}".`);
  }
  return (
    <>
      {facts.length > 0 && <p className="layout-issue__facts">{facts.join(' ')}</p>}
      {details.rules && (
        <ul className="layout-issue__rules">
          {details.rules.map((rule) => (
            <li key={rule.text}>
              <code>@media {rule.text}</code>
              {rule.source && <span className="muted url"> — {rule.source}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Captura decupata, cu chenarele elementelor (in procente, ca sa urmeze imaginea micsorata). */
function IssueImage({ issue }: { issue: LayoutIssue }) {
  const image = issue.image!;
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  return (
    <figure className="layout-shot">
      <div className="layout-shot__canvas" style={{ maxWidth: image.width }}>
        <img
          src={image.url}
          width={image.width}
          height={image.height}
          alt={`Captura paginii la lățimea de ${image.viewportWidth} px, în jurul elementelor implicate.`}
          className="layout-shot__image"
          loading="lazy"
        />
        {issue.boxes.map((box, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="layout-shot__box"
            style={{
              left: pct(box.x, image.width),
              top: pct(box.y, image.height),
              width: pct(box.width, image.width),
              height: pct(box.height, image.height),
            }}
          />
        ))}
        {issue.details.edgeX !== undefined && (
          <span
            aria-hidden="true"
            className="layout-shot__edge"
            style={{ left: pct(issue.details.edgeX, image.width) }}
          >
            <span className="layout-shot__edge-label">marginea ecranului</span>
          </span>
        )}
      </div>
      <figcaption className="muted">
        Fereastra browserului avea {image.viewportWidth} px lățime.
        {issue.details.edgeX !== undefined &&
          ' Linia punctată arată unde se termină ecranul; ce e în dreapta ei se vede doar derulând.'}
      </figcaption>
    </figure>
  );
}

function BreakpointDetails({ layout }: { layout: ScanLayout }) {
  return (
    <details className="section card scan-details">
      <summary>Breakpoint-urile paginii și eticheta meta viewport</summary>
      <dl className="details-list">
        <dt>Meta viewport</dt>
        <dd>
          {layout.metaViewport === null ? (
            'lipsește'
          ) : (
            <code>{layout.metaViewport || '(goală)'}</code>
          )}
        </dd>
        <dt>Lățimi verificate</dt>
        <dd>{layout.widths.join(', ')} px</dd>
      </dl>
      {layout.breakpoints.length === 0 ? (
        <p>Nu am găsit reguli CSS care să depindă de lățimea ecranului.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <caption className="visually-hidden">Breakpoint-urile găsite în CSS</caption>
            <thead>
              <tr>
                <th scope="col">Lățime</th>
                <th scope="col">Regula @media</th>
                <th scope="col">Fișierul</th>
              </tr>
            </thead>
            <tbody>
              {layout.breakpoints.map((b) => (
                <tr key={`${b.feature}|${b.px}|${b.text}|${b.source ?? ''}`}>
                  <td>
                    {b.feature} {b.px} px
                  </td>
                  <td>
                    <code>{b.text}</code>
                  </td>
                  <td className="url">{b.source ?? 'în pagină'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        Nu există o listă de breakpoint-uri „corecte”: ele trebuie puse acolo unde conținutul are
        nevoie. Le arătăm doar ca informație; semnalele de mai sus arată unde se strică aranjarea.
      </p>
    </details>
  );
}
