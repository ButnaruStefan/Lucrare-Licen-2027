/**
 * Pagina unui audit pe mai multe pagini (/audituri/:auditId). Arata etapa curenta:
 *
 *   1. cautarea paginilor (actualizata automat);
 *   2. alegerea paginilor (`PageSelectionForm`);
 *   3. scanarea: panoul de sumar (bara de progres "4 din 10 pagini verificate") si lista
 *      paginilor, cu legaturi spre scanarea fiecarei pagini;
 *   4. rezultatele pe tot site-ul (`AuditResultsView`), asezate imediat dupa sumar, cu limitele
 *      explicite ale auditului: cate pagini au fost verificate din cate au fost gasite,
 *      serviciile externe si documentele care NU au fost verificate.
 *
 * Accesibilitate: schimbarea etapei e anuntata (role="status"); dupa confirmarea paginilor,
 * focusul ajunge pe titlul sectiunii de progres (formularul dispare, focusul nu se pierde).
 */
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import type {
  Audit,
  AuditPage as AuditPageItem,
  AuditResults,
  Discovery,
  ExclusionReason,
} from '@ro-a11y/shared';
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
          <Link to="/proiecte">Înapoi la proiecte</Link>
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
        <Link to="/proiecte">Proiecte</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/proiecte/${audit.projectId}`}>{project.data?.name ?? 'Proiect'}</Link>{' '}
        <span aria-hidden="true">›</span> Audit
      </p>
      <PageHeading title={`Audit din ${formatDate(audit.createdAt)}`} />
      <p className="page-subtitle">
        <a href={audit.startUrl} className="url">
          {audit.startUrl}
        </a>
        <span aria-hidden="true"> · </span>
        {WCAG_PROFILE_LABELS[audit.config.wcagProfile]}
      </p>

      <div role="status" className="scan-status">
        <StatusText audit={audit} />
      </div>

      {audit.status === 'awaiting_selection' && audit.discovery && (
        <PageSelectionForm audit={audit} />
      )}

      {showPages && <AuditOverview audit={audit} results={results.data} />}

      {audit.status === 'completed' && (
        <>
          {results.isPending && <Loading label="Se încarcă rezultatele..." />}
          {results.isError && <ErrorMessage error={results.error} />}
          {results.data && <AuditResultsView results={results.data} />}
        </>
      )}

      {showPages && (
        <section aria-labelledby="pagini-auditate" className="section">
          <h2 id="pagini-auditate" ref={progressHeading} tabIndex={-1}>
            Paginile verificate
          </h2>
          <PagesList audit={audit} />
        </section>
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

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

/** Panoul de sumar: progresul scanarii si cifrele principale ale auditului. */
function AuditOverview({ audit, results }: { audit: Audit; results: AuditResults | undefined }) {
  const { progress } = audit;
  const done = progress.completed + progress.failed;
  const percent = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const count = (value: number | undefined) => (value === undefined ? '—' : value);
  const violations = results?.rules.filter((r) => r.category === 'violation').length;
  const incomplete = results?.rules.filter((r) => r.category === 'incomplete').length;

  return (
    <section aria-labelledby="sumar-audit" className="overview">
      <div className="overview__progress">
        <h2 id="sumar-audit" className="overview__title">
          {done} din {progress.total} pagini verificate
        </h2>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <dl className="overview__stats">
        <div className="stat">
          <dt>Probleme comune</dt>
          <dd>{count(results?.commonIssues.length)}</dd>
        </div>
        <div className="stat stat--violation">
          <dt>Reguli cu probleme detectate</dt>
          <dd>{count(violations)}</dd>
        </div>
        <div className="stat stat--incomplete">
          <dt>Reguli de verificat manual</dt>
          <dd>{count(incomplete)}</dd>
        </div>
        <div className="stat">
          <dt>Pagini găsite pe site</dt>
          <dd>{count(audit.discovery?.pages.length)}</dd>
        </div>
      </dl>
      {audit.status === 'completed' && audit.discovery && (
        <p className="overview__note">
          Au fost verificate {audit.progress.completed} din {audit.discovery.pages.length}{' '}
          {audit.discovery.pages.length === 1 ? 'pagină găsită' : 'pagini găsite'} pe{' '}
          {audit.discovery.scope}. Rezultatul <strong>nu</strong> descrie întregul site, iar
          testarea automată găsește doar o parte din problemele de accesibilitate: zero probleme
          detectate nu înseamnă conformitate cu WCAG.
        </p>
      )}
    </section>
  );
}

/** Paginile auditului, in ordinea scanarii; fiecare rand duce la scanarea paginii. */
function PagesList({ audit }: { audit: Audit }) {
  return (
    <ol className="page-rows">
      {audit.pages.map((page) => (
        <PageRow key={page.scanId} page={page} />
      ))}
    </ol>
  );
}

function PageRow({ page }: { page: AuditPageItem }) {
  const path = new URL(page.pageUrl).pathname;
  const reasons = page.reasons.map((r) => SELECTION_REASON_LABELS[r]).join(', ');
  return (
    <li className="page-row">
      <div className="page-row__main">
        <Link to={`/scanari/${page.scanId}`} className="page-row__name">
          {page.label ?? page.pageUrl}
        </Link>
        <span className="page-row__path">{path}</span>
      </div>
      <div className="page-row__reasons">
        {reasons && <span className="tag">{reasons}</span>}
        {page.robotsBlocked && <span className="tag tag--muted">interzisă de robots.txt</span>}
      </div>
      <div className="page-row__result">
        {page.status === 'completed' && page.summary ? (
          <>
            <span className={`count ${page.summary.violations > 0 ? 'count--violation' : ''}`}>
              {plural(page.summary.violations, 'problemă', 'probleme')}
            </span>
            <span className={`count ${page.summary.incomplete > 0 ? 'count--incomplete' : ''}`}>
              {page.summary.incomplete} de verificat
            </span>
          </>
        ) : (
          <ScanStatusBadge status={page.status} />
        )}
      </div>
      <span className="page-row__chevron" aria-hidden="true">
        →
      </span>
    </li>
  );
}

/** Ce s-a gasit si NU a fost verificat: servicii externe, documente, linkuri excluse. */
function DiscoveryDetails({ discovery }: { discovery: Discovery }) {
  const excluded = Object.entries(discovery.excluded) as Array<[ExclusionReason, number]>;
  return (
    <section aria-labelledby="ce-nu-s-a-verificat" className="section">
      <h2 id="ce-nu-s-a-verificat">Ce nu a fost verificat automat</h2>
      <div className="info-panels">
        <div className="info-panel">
          <h3>Servicii externe ({discovery.external.length})</h3>
          <p className="muted">
            Linkuri spre alte site-uri (ex. plăți online, portaluri). Fac parte din serviciul
            public, dar nu sunt scanate în acest audit; pot fi auditate separat, ca proiect nou.
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
        </div>
        <div className="info-panel">
          <h3>Documente ({discovery.documents.length})</h3>
          <p className="muted">
            Fișiere PDF, Word sau Excel. Trebuie să fie și ele accesibile, dar axe-core verifică
            doar pagini web: documentele cer verificare separată.
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
        </div>
        <div className="info-panel">
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
        </div>
      </div>
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
