/**
 * Structura comuna a tuturor paginilor: legatura "Sari la continut", antetul cu navigarea,
 * zona principala (<main>) in care se afiseaza pagina curenta si subsolul cu starea sistemului.
 *
 * Reperele HTML (header, nav, main, footer) permit utilizatorilor de cititoare de ecran sa
 * sara direct la zona dorita.
 */
import { NavLink, Outlet } from 'react-router';
import { SystemStatus } from '../components/SystemStatus';

export function Layout() {
  return (
    <>
      <a className="skip-link" href="#continut">
        Sari la conținutul principal
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <NavLink to="/" className="brand">
            W4A <span className="brand__sub">Web For All</span>
          </NavLink>
          <nav aria-label="Navigare principală">
            <ul className="nav-list">
              <li>
                <NavLink to="/" end>
                  Proiecte
                </NavLink>
              </li>
              <li>
                <NavLink to="/despre">Despre și limitări</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="continut" className="container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <SystemStatus />
          <p className="muted">
            Rezultatele automate sunt constatări tehnice, nu verdicte juridice. Platforma nu
            certifică conformitatea cu WCAG sau cu legislația.
          </p>
        </div>
      </footer>
    </>
  );
}
