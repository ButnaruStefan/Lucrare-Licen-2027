/**
 * Pagina unui proiect: profilul juridic (pe scurt), pornirea unui audit pe mai multe pagini,
 * pornirea unei scanari pe o singura pagina si istoricul auditurilor si al scanarilor.
 *
 * Auditul: worker-ul cauta paginile site-ului, iar utilizatorul alege ce se scaneaza (pe pagina
 * auditului). Scanarea simpla: alegerea paginii (implicit adresa proiectului), a profilului WCAG
 * si includerea "bunelor practici". Dupa pornire, utilizatorul ajunge pe pagina auditului sau a
 * scanarii, unde vede starea actualizata automat. Istoricele se actualizeaza singure cat timp
 * exista lucrari in curs.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AUDIT_DEFAULT_PAGES,
  AUDIT_MAX_PAGES,
  WCAG_PROFILES,
  type Project,
  type WcagProfile,
} from '@ro-a11y/shared';
import { ApiRequestError } from '../api/client';
import {
  useCreateAudit,
  useCreateScan,
  useLegalProfile,
  useProject,
  useProjectAudits,
  useProjectScans,
} from '../api/queries';
import { AuditStatusBadge, ScanStatusBadge } from '../components/Badges';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import { ApplicabilityBadge } from '../components/LegalAssessmentView';
import { PageHeading } from '../components/PageHeading';
import { TextField } from '../components/TextField';
import { useFocusFirstInvalid } from '../lib/focus';
import { formatDate, WCAG_PROFILE_LABELS } from '../lib/labels';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);

  if (project.isPending) return <Loading label="Se încarcă proiectul..." />;
  if (project.isError) {
    const notFound = project.error instanceof ApiRequestError && project.error.status === 404;
    return (
      <>
        <PageHeading title={notFound ? 'Proiectul nu există' : 'Eroare'} />
        <ErrorMessage error={project.error} />
        <p>
          <Link to="/proiecte">Înapoi la proiecte</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="breadcrumb">
        <Link to="/proiecte">Proiecte</Link> <span aria-hidden="true">›</span> {project.data.name}
      </p>
      <PageHeading title={project.data.name} />
      <p className="lead url">{project.data.baseUrl}</p>

      <LegalProfileSummary projectId={projectId} />
      <NewAuditForm project={project.data} />
      <NewScanForm project={project.data} />
      <AuditHistory projectId={projectId} />
      <ScanHistory projectId={projectId} />
    </>
  );
}

/** Profilul juridic pe scurt: statusul si legatura spre chestionar. */
function LegalProfileSummary({ projectId }: { projectId: string }) {
  const legalProfile = useLegalProfile(projectId);
  const profile = legalProfile.data?.profile ?? null;
  const href = `/proiecte/${projectId}/profil-juridic`;

  return (
    <section aria-labelledby="profil-juridic" className="section card">
      <h2 id="profil-juridic">Profil juridic (OUG 112/2018)</h2>
      {legalProfile.isPending && <Loading label="Se încarcă profilul juridic..." />}
      {legalProfile.isError && <ErrorMessage error={legalProfile.error} />}
      {legalProfile.data && !profile && (
        <>
          <p>
            <ApplicabilityBadge status="not_assessed" /> Răspunde la câteva întrebări despre cine
            administrează site-ul, ca să afli dacă legea accesibilității pentru sectorul public ar
            putea să se aplice.
          </p>
          <p>
            <Link to={href}>Completează profilul juridic</Link>
          </p>
        </>
      )}
      {profile && (
        <>
          <p>
            <ApplicabilityBadge status={profile.assessment.status} /> {profile.assessment.summary}
          </p>
          <p>
            <Link to={href}>Vezi detaliile sau modifică răspunsurile</Link>
          </p>
        </>
      )}
    </section>
  );
}

/** Optiunile comune ale auditului si ale scanarii simple: standardul si bunele practici. */
function ScanOptions({
  wcagProfile,
  onProfileChange,
  includeBestPractices,
  onBestPracticesChange,
}: {
  wcagProfile: WcagProfile;
  onProfileChange: (value: WcagProfile) => void;
  includeBestPractices: boolean;
  onBestPracticesChange: (value: boolean) => void;
}) {
  const profileId = useId();
  const bestPracticesId = useId();
  return (
    <>
      <div className="field">
        <label htmlFor={profileId}>Standardul verificat</label>
        <select
          id={profileId}
          value={wcagProfile}
          onChange={(e) => onProfileChange(e.target.value as WcagProfile)}
        >
          {WCAG_PROFILES.map((profile) => (
            <option key={profile} value={profile}>
              {WCAG_PROFILE_LABELS[profile]}
            </option>
          ))}
        </select>
      </div>
      <div className="field field--checkbox">
        <input
          id={bestPracticesId}
          type="checkbox"
          checked={includeBestPractices}
          onChange={(e) => onBestPracticesChange(e.target.checked)}
        />
        <label htmlFor={bestPracticesId}>
          Include și bunele practici (reguli utile, dar care nu sunt criterii WCAG obligatorii)
        </label>
      </div>
    </>
  );
}

/** Pornirea unui audit pe mai multe pagini: worker-ul cauta paginile, utilizatorul alege. */
function NewAuditForm({ project }: { project: Project }) {
  const navigate = useNavigate();
  const createAudit = useCreateAudit(project.id);
  const [startUrl, setStartUrl] = useState('');
  const [maxPages, setMaxPages] = useState(AUDIT_DEFAULT_PAGES);
  const [wcagProfile, setWcagProfile] = useState<WcagProfile>('WCAG_2_2_AA');
  const [includeBestPractices, setIncludeBestPractices] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const maxPagesId = useId();

  const error = createAudit.error;
  useFocusFirstInvalid(formRef, error);
  const fieldErrors =
    error instanceof ApiRequestError
      ? Object.fromEntries(error.details.map((d) => [d.field, d.message]))
      : {};
  if (
    error instanceof ApiRequestError &&
    ['UNSAFE_URL', 'PAGE_NOT_IN_PROJECT'].includes(error.code)
  ) {
    fieldErrors.startUrl = error.message;
  }
  const generalError = error && Object.keys(fieldErrors).length === 0 ? error : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createAudit.mutate(
      {
        startUrl: startUrl.trim() || undefined,
        maxPages,
        wcagProfile,
        includeBestPractices,
      },
      { onSuccess: (audit) => navigate(`/audituri/${audit.id}`) },
    );
  }

  return (
    <section aria-labelledby="audit-nou" className="section card">
      <h2 id="audit-nou">Auditează mai multe pagini ale site-ului</h2>
      <p className="muted">
        Caut paginile site-ului (meniuri, sitemap.xml) și îți propun un eșantion variat: pagina de
        start, paginile esențiale și câte una din fiecare secțiune. Tu confirmi lista înainte de
        scanare.
      </p>
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        {generalError && <ErrorMessage error={generalError} title="Auditul nu a pornit" />}
        <TextField
          label="Pagina de start (opțional)"
          hint={`Lasă gol pentru adresa proiectului (${project.baseUrl}).`}
          name="startUrl"
          type="url"
          value={startUrl}
          onChange={(e) => setStartUrl(e.target.value)}
          error={fieldErrors.startUrl}
          placeholder={project.baseUrl}
        />
        <div className="field">
          <label htmlFor={maxPagesId}>Câte pagini să propun</label>
          <select
            id={maxPagesId}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
          >
            {[5, 10, 15, AUDIT_MAX_PAGES].map((n) => (
              <option key={n} value={n}>
                {n} pagini
              </option>
            ))}
          </select>
        </div>
        <ScanOptions
          wcagProfile={wcagProfile}
          onProfileChange={setWcagProfile}
          includeBestPractices={includeBestPractices}
          onBestPracticesChange={setIncludeBestPractices}
        />
        <button type="submit" disabled={createAudit.isPending}>
          {createAudit.isPending ? 'Se pornește...' : 'Caută paginile site-ului'}
        </button>
      </form>
    </section>
  );
}

function NewScanForm({ project }: { project: Project }) {
  const navigate = useNavigate();
  const createScan = useCreateScan(project.id);
  const [pageUrl, setPageUrl] = useState('');
  const [wcagProfile, setWcagProfile] = useState<WcagProfile>('WCAG_2_2_AA');
  const [includeBestPractices, setIncludeBestPractices] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const error = createScan.error;
  useFocusFirstInvalid(formRef, error);
  const fieldErrors =
    error instanceof ApiRequestError
      ? Object.fromEntries(error.details.map((d) => [d.field, d.message]))
      : {};
  // Adresa nesigura sau de pe alt site e o eroare a campului "pagina"
  if (
    error instanceof ApiRequestError &&
    ['UNSAFE_URL', 'PAGE_NOT_IN_PROJECT'].includes(error.code)
  ) {
    fieldErrors.pageUrl = error.message;
  }
  const generalError = error && Object.keys(fieldErrors).length === 0 ? error : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createScan.mutate(
      { pageUrl: pageUrl.trim() || undefined, wcagProfile, includeBestPractices },
      {
        onSuccess: (scan) => navigate(`/scanari/${scan.id}`),
      },
    );
  }

  return (
    <section aria-labelledby="scanare-noua" className="section card">
      <h2 id="scanare-noua">Scanează o singură pagină</h2>
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        {generalError && <ErrorMessage error={generalError} title="Scanarea nu a pornit" />}
        <TextField
          label="Pagina de scanat (opțional)"
          hint={`Lasă gol pentru adresa proiectului (${project.baseUrl}). Pagina trebuie să fie de pe același site.`}
          name="pageUrl"
          type="url"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          error={fieldErrors.pageUrl}
          placeholder={project.baseUrl}
        />
        <ScanOptions
          wcagProfile={wcagProfile}
          onProfileChange={setWcagProfile}
          includeBestPractices={includeBestPractices}
          onBestPracticesChange={setIncludeBestPractices}
        />
        <button type="submit" disabled={createScan.isPending}>
          {createScan.isPending ? 'Se pornește...' : 'Scanează pagina'}
        </button>
      </form>
    </section>
  );
}

function AuditHistory({ projectId }: { projectId: string }) {
  const audits = useProjectAudits(projectId);

  return (
    <section aria-labelledby="istoric-audituri" className="section">
      <h2 id="istoric-audituri">Istoricul auditurilor</h2>
      {audits.isPending && <Loading label="Se încarcă auditurile..." />}
      {audits.isError && <ErrorMessage error={audits.error} />}
      {audits.data && audits.data.items.length === 0 && (
        <EmptyState>Niciun audit încă. Pornește un audit pe mai multe pagini mai sus.</EmptyState>
      )}
      {audits.data && audits.data.items.length > 0 && (
        <div className="table-wrapper">
          <table>
            <caption className="visually-hidden">
              Auditurile proiectului, cele mai noi primele
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Pagina de start</th>
                <th scope="col">Stare</th>
                <th scope="col">Pagini găsite</th>
                <th scope="col">Pagini verificate</th>
              </tr>
            </thead>
            <tbody>
              {audits.data.items.map((audit) => (
                <tr key={audit.id}>
                  <th scope="row">
                    <Link to={`/audituri/${audit.id}`}>{formatDate(audit.createdAt)}</Link>
                  </th>
                  <td className="url">{audit.startUrl}</td>
                  <td>
                    <AuditStatusBadge status={audit.status} />
                  </td>
                  <td>{audit.pagesFound ?? '—'}</td>
                  <td>
                    {audit.progress.total > 0
                      ? `${audit.progress.completed} din ${audit.progress.total}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ScanHistory({ projectId }: { projectId: string }) {
  const scans = useProjectScans(projectId);

  return (
    <section aria-labelledby="istoric" className="section">
      <h2 id="istoric">Istoricul scanărilor separate</h2>
      {scans.isPending && <Loading label="Se încarcă scanările..." />}
      {scans.isError && <ErrorMessage error={scans.error} />}
      {scans.data && scans.data.items.length === 0 && (
        <EmptyState>Nicio scanare încă. Pornește prima scanare mai sus.</EmptyState>
      )}
      {scans.data && scans.data.items.length > 0 && (
        <div className="table-wrapper">
          <table>
            <caption className="visually-hidden">
              Scanările proiectului, cele mai noi primele
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Pagina</th>
                <th scope="col">Stare</th>
                <th scope="col">Probleme detectate</th>
                <th scope="col">De verificat manual</th>
              </tr>
            </thead>
            <tbody>
              {scans.data.items.map((scan) => (
                <tr key={scan.id}>
                  <th scope="row">
                    <Link to={`/scanari/${scan.id}`}>{formatDate(scan.createdAt)}</Link>
                  </th>
                  <td className="url">{scan.pageUrl}</td>
                  <td>
                    <ScanStatusBadge status={scan.status} />
                  </td>
                  <td>{scan.summary ? scan.summary.violations : '—'}</td>
                  <td>{scan.summary ? scan.summary.incomplete : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
