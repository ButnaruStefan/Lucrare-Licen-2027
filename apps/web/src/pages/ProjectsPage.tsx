/**
 * Pagina principala: lista proiectelor (site-urile analizate) si formularul de adaugare.
 *
 * La trimiterea formularului, datele sunt validate de server. Daca un camp e gresit, mesajul
 * apare langa camp, iar focusul se muta pe primul camp gresit. Dupa creare, utilizatorul ajunge
 * direct pe pagina noului proiect.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useCreateProject, useProjects } from '../api/queries';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import { PageHeading } from '../components/PageHeading';
import { TextField } from '../components/TextField';
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

      <section aria-labelledby="lista-proiecte" className="section">
        <h2 id="lista-proiecte">Proiectele tale</h2>
        {projects.isPending && <Loading label="Se încarcă proiectele..." />}
        {projects.isError && <ErrorMessage error={projects.error} />}
        {projects.data && projects.data.items.length === 0 && (
          <EmptyState>Nu există încă niciun proiect. Adaugă primul proiect mai jos.</EmptyState>
        )}
        {projects.data && projects.data.items.length > 0 && (
          <div className="table-wrapper">
            <table>
              <caption className="visually-hidden">Lista proiectelor</caption>
              <thead>
                <tr>
                  <th scope="col">Nume</th>
                  <th scope="col">Adresa site-ului</th>
                  <th scope="col">Adăugat</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.items.map((project) => (
                  <tr key={project.id}>
                    <th scope="row">
                      <Link to={`/proiecte/${project.id}`}>{project.name}</Link>
                    </th>
                    <td className="url">{project.baseUrl}</td>
                    <td>{formatDate(project.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <NewProjectForm />
    </>
  );
}

function NewProjectForm() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const error = createProject.error;
  const fieldErrors =
    error instanceof ApiRequestError
      ? Object.fromEntries(error.details.map((d) => [d.field, d.message]))
      : {};
  const generalError = error && Object.keys(fieldErrors).length === 0 ? error : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createProject.mutate(
      { name, baseUrl },
      {
        onSuccess: (project) => navigate(`/proiecte/${project.id}`),
        onError: () => {
          // Focus pe primul camp marcat gresit, ca utilizatorul sa stie unde sa corecteze.
          requestAnimationFrame(() =>
            formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
          );
        },
      },
    );
  }

  return (
    <section aria-labelledby="proiect-nou" className="section card">
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
