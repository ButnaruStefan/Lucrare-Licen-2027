/**
 * Traseele (rutele) aplicatiei: ce pagina se afiseaza pentru fiecare adresa.
 *
 *   /                      -> pagina de start (prezentarea platformei, cu drum spre proiecte
 *                             si spre limitari)
 *   /proiecte              -> lista proiectelor + adaugarea unui proiect
 *   /proiecte/:projectId   -> un proiect: pornirea unei scanari + istoricul scanarilor
 *   /proiecte/:projectId/profil-juridic -> chestionarul OUG 112/2018 si evaluarea lui
 *   /audituri/:auditId     -> un audit pe mai multe pagini: alegerea paginilor, progresul,
 *                             rezultatele pe tot site-ul
 *   /scanari/:scanId       -> o scanare: stare, sumar, rezultate cu filtre
 *   /despre                -> ce face platforma si ce NU poate face (limitari)
 *   orice altceva          -> pagina "nu exista"
 */
import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { AboutPage } from '../pages/AboutPage';
import { AuditPage } from '../pages/AuditPage';
import { LandingPage } from '../pages/LandingPage';
import { LegalProfilePage } from '../pages/LegalProfilePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectPage } from '../pages/ProjectPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { ScanPage } from '../pages/ScanPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/proiecte', element: <ProjectsPage /> },
      { path: '/proiecte/:projectId', element: <ProjectPage /> },
      { path: '/proiecte/:projectId/profil-juridic', element: <LegalProfilePage /> },
      { path: '/audituri/:auditId', element: <AuditPage /> },
      { path: '/scanari/:scanId', element: <ScanPage /> },
      { path: '/despre', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
