/**
 * Traseele (rutele) aplicatiei: ce pagina se afiseaza pentru fiecare adresa.
 *
 *   /                      -> lista proiectelor + adaugarea unui proiect
 *   /proiecte/:projectId   -> un proiect: pornirea unei scanari + istoricul scanarilor
 *   /scanari/:scanId       -> o scanare: stare, sumar, rezultate cu filtre
 *   /despre                -> ce face platforma si ce NU poate face (limitari)
 *   orice altceva          -> pagina "nu exista"
 */
import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { AboutPage } from '../pages/AboutPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectPage } from '../pages/ProjectPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { ScanPage } from '../pages/ScanPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <ProjectsPage /> },
      { path: '/proiecte/:projectId', element: <ProjectPage /> },
      { path: '/scanari/:scanId', element: <ScanPage /> },
      { path: '/despre', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
