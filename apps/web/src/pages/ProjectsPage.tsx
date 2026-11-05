/**
 * Pagina proiectelor (/proiecte): lista site-urilor analizate (cu cautare) si, alaturi,
 * formularul de adaugare a unui proiect nou.
 *
 * La trimiterea formularului, datele sunt validate de server. Daca un camp e gresit, mesajul
 * apare langa camp, iar focusul se muta pe primul camp gresit. Dupa creare, utilizatorul ajunge
 * direct pe pagina noului proiect.
 *
 * Duplicate: daca exista deja un proiect pentru aceeasi adresa, serverul refuza (409) si
 * formularul ofera o legatura spre proiectul existent. Un nume deja folosit (la alta adresa) e
 * permis, dar formularul avertizeaza din timp, in timp ce scrii.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useCreateProject, useProjects } from '../api/queries';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import { PageHeading } from '../components/PageHeading';
import { TextField } from '../components/TextField';
import type { Project } from '@ro-a11y/shared';
import { useFocusFirstInvalid } from '../lib/focus';
import { formatDate } from '../lib/labels';

export function ProjectsPage() {
  const projects = useProjects();

  return (
    <>
      <PageHeading title="Proiecte" />
      <p className="lead">
        Un proiect este un site pe care vrei să-l verifici. Alege un proiect ca să pornești o
        scanare de accesibilitate sau adaugă unul nou.
      </p>

      <div className="projects-layout">
        <section aria-labelledby="lista-proiecte" className="projects-layout__list">
          {projects.isPending && <Loading label="Se încarcă proiectele..." />}
          {projects.isError && <ErrorMessage error={projects.error} />}
          {projects.data && <ProjectList projects={projects.data.items} />}
        </section>

        <NewProjectForm existingProjects={projects.data?.items ?? []} />
      </div>
    </>
  );
}

/** Adresa fara "https://" si fara "/" final, ex. "primaria-iasi.ro" sau "github.com/ButnaruStefan". */
function shortAddress(baseUrl: string): string {
  const url = new URL(baseUrl);
  const path = url.pathname.replace(/\/$/, '');
  return `${url.host.replace(/^www\./, '')}${path}`;
}

/** Site-urile de antrenament ruleaza pe calculatorul local. */
function isLocal(baseUrl: string): boolean {
  return ['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname);
}

/** Lista proiectelor, cu cautare. Fiecare rand e o legatura spre proiect (numele proiectului). */
function ProjectList({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? projects.filter((p) => `${p.name} ${p.baseUrl}`.toLowerCase().includes(needle))
    : projects;

  return (
    <>
      <div className="list-toolbar">
        <h2 id="lista-proiecte" className="list-toolbar__title">
          Proiectele tale <span className="count-pill">{projects.length}</span>
        </h2>
        {projects.length > 0 && (
          <div className="search-field">
            <label htmlFor="cauta-proiect" className="visually-hidden">
              Caută în proiecte
            </label>
            <input
              id="cauta-proiect"
              type="search"
              placeholder="Caută după nume sau adresă"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {projects.length === 0 && (
        <EmptyState>
          Nu există încă niciun proiect. Adaugă primul site în formularul alăturat.
        </EmptyState>
      )}
      {projects.length > 0 && (
        <p role="status" className={needle ? 'list-status' : 'visually-hidden'}>
          {visible.length === 0
            ? `Niciun proiect nu se potrivește cu „${query.trim()}”.`
            : `${visible.length} din ${projects.length} proiecte`}
        </p>
      )}
      {visible.length > 0 && (
        <ul className="project-list">
          {visible.map((project) => (
            <li key={project.id} className="project-row">
              <span className="project-row__avatar" aria-hidden="true">
                {project.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="project-row__main">
                <Link to={`/proiecte/${project.id}`} className="project-row__name">
                  {project.name}
                </Link>
                <span className="project-row__address">{shortAddress(project.baseUrl)}</span>
              </div>
              {isLocal(project.baseUrl) && <span className="tag">site de test</span>}
              <span className="project-row__date">Adăugat {formatDate(project.createdAt)}</span>
              <span className="project-row__chevron" aria-hidden="true">
                →
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NewProjectForm({ existingProjects }: { existingProjects: Project[] }) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const error = createProject.error;
  // Dupa o eroare, focusul merge pe primul camp marcat gresit (unde trebuie corectat).
  useFocusFirstInvalid(formRef, error);
  const fieldErrors =
    error instanceof ApiRequestError
      ? Object.fromEntries(error.details.map((d) => [d.field, d.message]))
      : {};
  const generalError = error && Object.keys(fieldErrors).length === 0 ? error : null;
  const existingProjectId =
    error instanceof ApiRequestError && error.code === 'PROJECT_EXISTS'
      ? error.existingId
      : undefined;

  const typedName = name.trim().toLowerCase();
  const sameName = typedName
    ? existingProjects.find((p) => p.name.trim().toLowerCase() === typedName)
    : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createProject.mutate(
      { name, baseUrl },
      {
        onSuccess: (project) => navigate(`/proiecte/${project.id}`),
      },
    );
  }

  return (
    <section aria-labelledby="proiect-nou" className="card projects-layout__form">
      <h2 id="proiect-nou">Adaugă un proiect</h2>
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        {generalError && <ErrorMessage error={generalError} title="Proiectul nu a fost adăugat" />}
        <TextField
          label="Nume"
          hint="Ex.: Primăria Valea Verde"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          warning={
            sameName
              ? `Există deja un proiect cu acest nume (${sameName.baseUrl}). Poți continua, dar alege un nume diferit ca să le deosebești ușor.`
              : undefined
          }
          autoComplete="off"
          required
        />
        <TextField
          label="Adresa site-ului"
          hint="Adresa completă, începând cu https:// sau http://"
          name="baseUrl"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          error={fieldErrors.baseUrl}
          extra={
            existingProjectId && (
              <p className="field__extra">
                <Link to={`/proiecte/${existingProjectId}`}>Deschide proiectul existent</Link>
              </p>
            )
          }
          autoComplete="url"
          required
        />
        <button type="submit" disabled={createProject.isPending}>
          {createProject.isPending ? 'Se adaugă...' : 'Adaugă proiectul'}
        </button>
      </form>
    </section>
  );
}
