/**
 * Pagina unui proiect: profilul juridic (pe scurt), o "verificare noua" si istoricul auditurilor
 * si al scanarilor.
 *
 * Verificarea noua are doi pasi:
 *   1. "Ce vrei sa verifici?": accesibilitatea (criteriile WCAG, axe-core), aspectul paginii
 *      (responsive, elemente suprapuse sau taiate; separat de WCAG) sau ambele;
 *   2. "Cate pagini?": "Mai multe pagini" (audit, implicit) sau "O singura pagina" (scanare
 *      simpla). Se afiseaza doar formularul ales.
 * Alegerile sunt pastrate in adresa (?verifica=aspect&verificare=o-pagina), ca butonul
 * "Inapoi" si linkurile sa le pastreze.
 *
 * Auditul: worker-ul cauta paginile site-ului, iar utilizatorul alege ce se scaneaza (pe pagina
 * auditului). Scanarea simpla: alegerea paginii (implicit adresa proiectului) si, daca se
 * verifica accesibilitatea, a profilului WCAG si includerea "bunelor practici". Dupa pornire, utilizatorul ajunge pe pagina auditului sau a
 * scanarii, unde vede starea actualizata automat. Istoricele se actualizeaza singure cat timp
 * exista lucrari in curs.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AUDIT_DEFAULT_PAGES,
  AUDIT_MAX_PAGES,
  WCAG_PROFILES,
  type Project,
  type ScanChecks,
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
import { Icon, type IconName } from '../components/Icon';
import { ApplicabilityBadge } from '../components/LegalAssessmentView';
import { PageHeading } from '../components/PageHeading';
import { TextField } from '../components/TextField';
import { useFocusFirstInvalid } from '../lib/focus';
import { formatDate, WCAG_PROFILE_LABELS } from '../lib/labels';
import { checksLabel } from '../lib/layout-labels';

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
      <NewCheck project={project.data} />
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

type CheckMode = 'multi' | 'single';

/** Verificarile alese, din adresa: ?verifica=aspect | ambele (implicit: accesibilitatea). */
function checksFromParams(params: URLSearchParams): ScanChecks {
  const value = params.get('verifica');
  if (value === 'aspect') return { accessibility: false, layout: true };
  if (value === 'ambele') return { accessibility: true, layout: true };
  if (value === 'nimic') return { accessibility: false, layout: false };
  return { accessibility: true, layout: false };
}

function checksParam(checks: ScanChecks): string | null {
  if (checks.accessibility && checks.layout) return 'ambele';
  if (checks.layout) return 'aspect';
  if (!checks.accessibility) return 'nimic';
  return null;
}

/** Verificarea noua: ce se verifica, cate pagini si formularul ales. */
function NewCheck({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const mode: CheckMode = params.get('verificare') === 'o-pagina' ? 'single' : 'multi';
  const checks = checksFromParams(params);
  const noneChosen = !checks.accessibility && !checks.layout;

  function update(nextMode: CheckMode, nextChecks: ScanChecks) {
    const search: Record<string, string> = {};
    const verifica = checksParam(nextChecks);
    if (verifica) search.verifica = verifica;
    if (nextMode === 'single') search.verificare = 'o-pagina';
    setParams(search, { replace: true, preventScrollReset: true });
  }

  return (
    <section aria-labelledby="verificare-noua" className="section card check">
      <h2 id="verificare-noua">Verificare nouă</h2>
      <fieldset
        className="mode-picker"
        aria-describedby={noneChosen ? 'nicio-verificare' : undefined}
      >
        <legend className="mode-picker__legend">Ce vrei să verifici?</legend>
        <div className="mode-picker__options">
          <CheckOption
            checked={checks.accessibility}
            onChange={(on) => update(mode, { ...checks, accessibility: on })}
            icon="access"
            title="Accesibilitatea"
            description="Criteriile WCAG (axe-core): probleme pentru persoanele cu dizabilități, cu legătura spre EN 301 549 și OUG 112/2018."
          />
          <CheckOption
            checked={checks.layout}
            onChange={(on) => update(mode, { ...checks, layout: on })}
            icon="devices"
            title="Aspectul paginii"
            badge="Fără legătură cu WCAG"
            description="Cum se aranjează pagina de la telefon la calculator: elemente suprapuse, tăiate sau ieșite din pagină, breakpoint-uri."
          />
        </div>
        {noneChosen && (
          <p id="nicio-verificare" className="field__error mode-picker__error">
            Alege cel puțin o verificare.
          </p>
        )}
      </fieldset>
      <fieldset className="mode-picker">
        <legend className="mode-picker__legend">Câte pagini?</legend>
        <div className="mode-picker__options">
          <ModeOption
            value="multi"
            current={mode}
            onSelect={(next) => update(next, checks)}
            icon="pages"
            title="Mai multe pagini"
            badge="Recomandat"
            description="Găsesc paginile site-ului (meniu, sitemap.xml) și îți propun un eșantion de până la 20. Tu confirmi lista."
          />
          <ModeOption
            value="single"
            current={mode}
            onSelect={(next) => update(next, checks)}
            icon="page"
            title="O singură pagină"
            description="Verifici rapid o pagină anume, de exemplu după o reparație."
          />
        </div>
      </fieldset>
      <div className="check__form" key={mode}>
        {mode === 'multi' ? (
          <NewAuditForm project={project} checks={noneChosen ? null : checks} />
        ) : (
          <NewScanForm project={project} checks={noneChosen ? null : checks} />
        )}
      </div>
    </section>
  );
}

/**
 * O verificare (accesibilitate sau aspect): o casuta de bifat nativa (Spatiu o bifeaza),
 * afisata ca un card, la fel ca optiunile de mai jos. Se pot bifa amandoua.
 */
function CheckOption({
  checked,
  onChange,
  icon,
  title,
  badge,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: IconName;
  title: string;
  badge?: string;
  description: string;
}) {
  const id = useId();
  return (
    <div className="mode-option mode-option--checkbox">
      <input
        id={id}
        className="mode-option__input"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-descriere`}
      />
      <span className="mode-option__icon">
        <Icon name={icon} />
      </span>
      <span className="mode-option__text">
        <label htmlFor={id} className="mode-option__title">
          {title}
        </label>
        {badge && <span className="mode-option__badge">{badge}</span>}
        <span id={`${id}-descriere`} className="mode-option__description">
          {description}
        </span>
      </span>
      <span className="mode-option__check" aria-hidden="true" />
    </div>
  );
}

/**
 * O optiune a selectorului: un buton radio nativ (tastatura: sagetile schimba optiunea),
 * afisat ca un card. Eticheta radio-ului e doar titlul; descrierea e legata prin aria-describedby.
 */
function ModeOption({
  value,
  current,
  onSelect,
  icon,
  title,
  badge,
  description,
}: {
  value: CheckMode;
  current: CheckMode;
  onSelect: (value: CheckMode) => void;
  icon: IconName;
  title: string;
  badge?: string;
  description: string;
}) {
  const id = useId();
  return (
    <div className="mode-option">
      <input
        id={id}
        className="mode-option__input"
        type="radio"
        name="mod-verificare"
        value={value}
        checked={current === value}
        onChange={() => onSelect(value)}
        aria-describedby={`${id}-descriere`}
      />
      <span className="mode-option__icon">
        <Icon name={icon} />
      </span>
      <span className="mode-option__text">
        <label htmlFor={id} className="mode-option__title">
          {title}
        </label>
        {badge && <span className="mode-option__badge">{badge}</span>}
        <span id={`${id}-descriere`} className="mode-option__description">
          {description}
        </span>
      </span>
      <span className="mode-option__check" aria-hidden="true" />
    </div>
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
function NewAuditForm({ project, checks }: { project: Project; checks: ScanChecks | null }) {
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
    if (!checks) return;
    createAudit.mutate(
      {
        startUrl: startUrl.trim() || undefined,
        maxPages,
        checks: checks!,
        wcagProfile,
        includeBestPractices,
      },
      { onSuccess: (audit) => navigate(`/audituri/${audit.id}`) },
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label="Audit pe mai multe pagini">
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
      {checks?.accessibility && (
        <ScanOptions
          wcagProfile={wcagProfile}
          onProfileChange={setWcagProfile}
          includeBestPractices={includeBestPractices}
          onBestPracticesChange={setIncludeBestPractices}
        />
      )}
      <button
        type="submit"
        disabled={createAudit.isPending || !checks}
        aria-describedby={checks ? undefined : 'nicio-verificare'}
      >
        {createAudit.isPending ? 'Se pornește...' : 'Caută paginile site-ului'}
      </button>
    </form>
  );
}

function NewScanForm({ project, checks }: { project: Project; checks: ScanChecks | null }) {
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
    if (!checks) return;
    createScan.mutate(
      { pageUrl: pageUrl.trim() || undefined, checks, wcagProfile, includeBestPractices },
      {
        onSuccess: (scan) => navigate(`/scanari/${scan.id}`),
      },
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-label="Scanarea unei singure pagini"
    >
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
      {checks?.accessibility && (
        <ScanOptions
          wcagProfile={wcagProfile}
          onProfileChange={setWcagProfile}
          includeBestPractices={includeBestPractices}
          onBestPracticesChange={setIncludeBestPractices}
        />
      )}
      <button
        type="submit"
        disabled={createScan.isPending || !checks}
        aria-describedby={checks ? undefined : 'nicio-verificare'}
      >
        {createScan.isPending ? 'Se pornește...' : 'Scanează pagina'}
      </button>
    </form>
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
        <EmptyState>
          Niciun audit încă. Alege „Mai multe pagini” în „Verificare nouă”, mai sus.
        </EmptyState>
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
        <EmptyState>
          Nicio scanare separată încă. Alege „O singură pagină” în „Verificare nouă”, mai sus.
        </EmptyState>
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
                <th scope="col">Verificări</th>
                <th scope="col">Stare</th>
                <th scope="col">Probleme detectate</th>
                <th scope="col">De verificat manual</th>
                <th scope="col">Semnale de aspect</th>
              </tr>
            </thead>
            <tbody>
              {scans.data.items.map((scan) => (
                <tr key={scan.id}>
                  <th scope="row">
                    <Link to={`/scanari/${scan.id}`}>{formatDate(scan.createdAt)}</Link>
                  </th>
                  <td className="url">{scan.pageUrl}</td>
                  <td>{checksLabel(scan.config.checks)}</td>
                  <td>
                    <ScanStatusBadge status={scan.status} />
                  </td>
                  <td>
                    {scan.summary && scan.config.checks.accessibility
                      ? scan.summary.violations
                      : '—'}
                  </td>
                  <td>
                    {scan.summary && scan.config.checks.accessibility
                      ? scan.summary.incomplete
                      : '—'}
                  </td>
                  <td>
                    {scan.layout && !scan.layout.failed
                      ? scan.layout.visible + scan.layout.possible
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
