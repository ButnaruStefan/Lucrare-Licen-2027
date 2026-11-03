/**
 * Pagina unui audit pe mai multe pagini (/audituri/:auditId). Arata etapa curenta:
 *
 *   1. cautarea paginilor (actualizata automat);
 *   2. alegerea paginilor (`PageSelectionForm`);
 *   3. scanarea: progresul ("4 din 10 pagini gata") si lista paginilor, cu legaturi spre
 *      scanarea fiecarei pagini;
 *   4. rezultatele pe tot site-ul (`AuditResultsView`), cu limitele explicite ale auditului:
 *      cate pagini au fost verificate din cate au fost gasite, serviciile externe si
 *      documentele care NU au fost verificate.
 *
 * Accesibilitate: schimbarea etapei e anuntata (role="status"); dupa confirmarea paginilor,
 * focusul ajunge pe titlul sectiunii de progres (formularul dispare, focusul nu se pierde).
 */
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import type { Audit, Discovery, ExclusionReason } from '@ro-a11y/shared';
import { ApiRequestError } from '../api/client';
import { useAudit, useAuditResults, useProject } from '../api/queries';
import { AuditResultsView } from '../components/AuditResultsView';
import { AuditStatusBadge, ScanStatusBadge } from '../components/Badges';
import { ErrorMessage, Loading } from '../components/Feedback';
import { PageHeading } from '../components/PageHeading';
import { PageSelectionForm } from '../components/PageSelectionForm';
import {
  EXCLUSION_LABELS,
  formatDate,
  SELECTION_REASON_LABELS,
  WCAG_PROFILE_LABELS,
} from '../lib/labels';

export function AuditPage() {
  const { auditId = '' } = useParams();
  const audit = useAudit(auditId);

  if (audit.isPending) return <Loading label="Se încarcă auditul..." />;
  if (audit.isError) {
    const notFound = audit.error instanceof ApiRequestError && audit.error.status === 404;
    return (
      <>
        <PageHeading title={notFound ? 'Auditul nu există' : 'Eroare'} />
        <ErrorMessage error={audit.error} />
        <p>
          <Link to="/">Înapoi la proiecte</Link>
        </p>
      </>
    );
  }
  return <AuditView audit={audit.data} />;
}

function AuditView({ audit }: { audit: Audit }) {
  const project = useProject(audit.projectId);
  const results = useAuditResults(audit.id, audit.status === 'completed');
  const progressHeading = useRef<HTMLHeadingElement>(null);
  const previousStatus = useRef(audit.status);

  // Dupa confirmarea paginilor, formularul dispare: mutam focusul pe sectiunea de progres
  useEffect(() => {
    if (previousStatus.current === 'awaiting_selection' && audit.status !== 'awaiting_selection') {
      progressHeading.current?.focus();
    }
    previousStatus.current = audit.status;
  }, [audit.status]);

  const showPages = audit.status === 'scanning' || audit.status === 'completed';

  return (
    <>
      <p className="breadcrumb">
        <Link to="/">Proiecte</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/proiecte/${audit.projectId}`}>{project.data?.name ?? 'Proiect'}</Link>{' '}
        <span aria-hidden="true">›</span> Audit
      </p>
      <PageHeading title={`Audit din ${formatDate(audit.createdAt)}`} />
      <p className="lead url">{audit.startUrl}</p>

      <div role="status" className="scan-status">
        <StatusText audit={audit} />
      </div>

      {audit.status === 'awaiting_selection' && audit.discovery && (
        <PageSelectionForm audit={audit} />
      )}

      {showPages && (
        <section aria-labelledby="pagini-auditate" className="section">
          <h2 id="pagini-auditate" ref={progressHeading} tabIndex={-1}>
            Paginile verificate
          </h2>
          <PagesTable audit={audit} />
        </section>
      )}

      {audit.status === 'completed' && audit.discovery && (
        <p className="notice notice--info">
          Au fost verificate {audit.progress.completed} din {audit.discovery.pages.length}{' '}
          {audit.discovery.pages.length === 1 ? 'pagină găsită' : 'pagini găsite'} pe{' '}
          {audit.discovery.scope}. Rezultatul <strong>nu</strong> descrie întregul site, iar
          testarea automată găsește doar o parte din problemele de accesibilitate: zero probleme
          detectate nu înseamnă conformitate cu WCAG.
        </p>
      )}

      {audit.status === 'completed' && (
        <>
          {results.isPending && <Loading label="Se încarcă rezultatele..." />}
          {results.isError && <ErrorMessage error={results.error} />}
          {results.data && <AuditResultsView results={results.data} />}
        </>
      )}

      {audit.discovery && <DiscoveryDetails discovery={audit.discovery} />}
      <AuditDetails audit={audit} />
    </>
  );
}

function StatusText({ audit }: { audit: Audit }) {
  const { progress } = audit;
  switch (audit.status) {
    case 'discovery_queued':
    case 'discovering':
      return (
        <p>
          <AuditStatusBadge status={audit.status} /> Caut paginile site-ului (linkuri din pagina de
          start, robots.txt, sitemap.xml). Pagina se actualizează automat.
        </p>
      );
    case 'awaiting_selection':
      return (
        <p>
          <AuditStatusBadge status={audit.status} /> Paginile au fost găsite. Verifică propunerea de
          mai jos și pornește scanarea.
        </p>
      );
    case 'scanning':
      return (
        <p>
          <AuditStatusBadge status={audit.status} /> {progress.completed + progress.failed} din{' '}
          {progress.total} pagini gata. Pagina se actualizează automat.
        </p>
      );
    case 'completed':
      return (
        <p>
          <AuditStatusBadge status={audit.status} /> Toate cele {progress.total} pagini au fost
          procesate
          {progress.failed > 0 ? ` (${progress.failed} nu au putut fi scanate)` : ''}.
        </p>
      );
    case 'failed':
      return (
        <div className="notice notice--error">
          <p className="notice__title">
            <AuditStatusBadge status="failed" /> Paginile site-ului nu au putut fi găsite
          </p>
          <p>{audit.errorMessage}</p>
          <p className="muted">
            Cod: <code>{audit.errorCode}</code>. Un eșec tehnic nu înseamnă că site-ul este
            inaccesibil.
          </p>
        </div>
      );
  }
}

function PagesTable({ audit }: { audit: Audit }) {
  return (
    <div className="table-wrapper">
      <table>
        <caption className="visually-hidden">Paginile auditului, în ordinea scanării</caption>
        <thead>
          <tr>
            <th scope="col">Pagina</th>
            <th scope="col">De ce</th>
            <th scope="col">Stare</th>
            <th scope="col">Probleme detectate</th>
            <th scope="col">De verificat manual</th>
          </tr>
        </thead>
        <tbody>
          {audit.pages.map((page) => (
            <tr key={page.scanId}>
              <th scope="row">
                <Link to={`/scanari/${page.scanId}`}>{page.label ?? page.pageUrl}</Link>
                <span className="url muted audit-page__url">{new URL(page.pageUrl).pathname}</span>
              </th>
              <td>
                {page.reasons.map((r) => SELECTION_REASON_LABELS[r]).join(', ') || '—'}
                {page.robotsBlocked && (
                  <>
                    {' '}
                    <span className="tag tag--muted">interzisă de robots.txt</span>
                  </>
                )}
              </td>
              <td>
                <ScanStatusBadge status={page.status} />
              </td>
              <td>{page.summary ? page.summary.violations : '—'}</td>
              <td>{page.summary ? page.summary.incomplete : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ce s-a gasit si NU a fost verificat: servicii externe, documente, linkuri excluse. */
function DiscoveryDetails({ discovery }: { discovery: Discovery }) {
  const excluded = Object.entries(discovery.excluded) as Array<[ExclusionReason, number]>;
  return (
    <section aria-labelledby="ce-nu-s-a-verificat" className="section">
      <h2 id="ce-nu-s-a-verificat">Ce nu a fost verificat automat</h2>

      <h3>Servicii externe ({discovery.external.length})</h3>
      <p className="muted">
        Linkuri spre alte site-uri (ex. plăți online, portaluri). Fac parte din serviciul public,
        dar nu sunt scanate în acest audit; pot fi auditate separat, ca proiect nou.
      </p>
      {discovery.external.length > 0 ? (
        <ul className="audit-page-links">
          {discovery.external.map((service) => (
            <li key={service.origin}>
              {service.label} <span className="url muted">{service.origin}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Niciun serviciu extern găsit în pagina de start.</p>
      )}

      <h3>Documente ({discovery.documents.length})</h3>
      <p className="muted">
        Fișiere PDF, Word sau Excel. Trebuie să fie și ele accesibile, dar axe-core verifică doar
        pagini web: documentele cer verificare separată.
      </p>
      {discovery.documents.length > 0 ? (
        <ul className="audit-page-links">
          {discovery.documents.map((doc) => (
            <li key={doc.url}>
              {doc.label} <span className="tag">{doc.extension.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Niciun document găsit în pagina de start.</p>
      )}

      <h3>Linkuri excluse</h3>
      {excluded.length > 0 ? (
        <ul>
          {excluded.map(([reason, count]) => (
            <li key={reason}>
              {count} {EXCLUSION_LABELS[reason]}
            </li>
          ))}
        </ul>
      ) : (
        <p>Niciun link exclus.</p>
      )}
      <p className="muted">
        Linkuri citite din pagina de start: {discovery.linksFound}. robots.txt:{' '}
        {discovery.robots.found
          ? `găsit; ${discovery.robots.blocked} pagini interzise, nepropuse automat`
          : 'nu există'}
        . sitemap.xml:{' '}
        {discovery.sitemap.found ? `găsit (${discovery.sitemap.urls} adrese)` : 'nu există'}.
      </p>
    </section>
  );
}

function AuditDetails({ audit }: { audit: Audit }) {
  return (
    <details className="section card scan-details">
      <summary>Detalii tehnice ale auditului</summary>
      <dl className="details-list">
        <dt>Pagina de start</dt>
        <dd className="url">{audit.startUrl}</dd>
        <dt>Pagini propuse, cel mult</dt>
        <dd>{audit.maxPages}</dd>
        <dt>Standard</dt>
        <dd>{WCAG_PROFILE_LABELS[audit.config.wcagProfile]}</dd>
        <dt>Bune practici incluse</dt>
        <dd>{audit.config.includeBestPractices ? 'Da' : 'Nu'}</dd>
        <dt>Versiunea catalogului normativ</dt>
        <dd>{audit.catalogVersion}</dd>
        <dt>Pornit / pagini găsite / pagini alese / terminat</dt>
        <dd>
          {formatDate(audit.createdAt)} / {formatDate(audit.discoveredAt)} /{' '}
          {formatDate(audit.selectedAt)} / {formatDate(audit.finishedAt)}
        </dd>
      </dl>
    </details>
  );
}
