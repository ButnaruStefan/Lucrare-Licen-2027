/**
 * Pagina unui proiect: pornirea unei scanari noi si istoricul scanarilor.
 *
 * Formularul permite alegerea paginii (implicit adresa proiectului), a profilului WCAG si
 * includerea "bunelor practici". Dupa pornire, utilizatorul ajunge pe pagina scanarii, unde
 * vede starea actualizata automat. Istoricul se actualizeaza singur cat timp exista scanari in curs.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { WCAG_PROFILES, type Project, type WcagProfile } from '@ro-a11y/shared';
import { ApiRequestError } from '../api/client';
import { useCreateScan, useProject, useProjectScans } from '../api/queries';
import { ScanStatusBadge } from '../components/Badges';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import { PageHeading } from '../components/PageHeading';
import { TextField } from '../components/TextField';
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
          <Link to="/">Înapoi la proiecte</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="breadcrumb">
        <Link to="/">Proiecte</Link> <span aria-hidden="true">›</span> {project.data.name}
      </p>
      <PageHeading title={project.data.name} />
      <p className="lead url">{project.data.baseUrl}</p>

      <NewScanForm project={project.data} />
      <ScanHistory projectId={projectId} />
    </>
  );
}

function NewScanForm({ project }: { project: Project }) {
  const navigate = useNavigate();
  const createScan = useCreateScan(project.id);
  const [pageUrl, setPageUrl] = useState('');
  const [wcagProfile, setWcagProfile] = useState<WcagProfile>('WCAG_2_2_AA');
  const [includeBestPractices, setIncludeBestPractices] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const profileId = useId();
  const bestPracticesId = useId();

  const error = createScan.error;
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
        onError: () =>
          requestAnimationFrame(() =>
            formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
          ),
      },
    );
  }

  return (
    <section aria-labelledby="scanare-noua" className="section card">
      <h2 id="scanare-noua">Pornește o scanare</h2>
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
        <div className="field">
          <label htmlFor={profileId}>Standardul verificat</label>
          <select
            id={profileId}
            value={wcagProfile}
            onChange={(e) => setWcagProfile(e.target.value as WcagProfile)}
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
            onChange={(e) => setIncludeBestPractices(e.target.checked)}
          />
          <label htmlFor={bestPracticesId}>
            Include și bunele practici (reguli utile, dar care nu sunt criterii WCAG obligatorii)
          </label>
        </div>
        <button type="submit" disabled={createScan.isPending}>
          {createScan.isPending ? 'Se pornește...' : 'Scanează pagina'}
        </button>
      </form>
    </section>
  );
}

function ScanHistory({ projectId }: { projectId: string }) {
  const scans = useProjectScans(projectId);

  return (
    <section aria-labelledby="istoric" className="section">
      <h2 id="istoric">Istoricul scanărilor</h2>
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
