/**
 * Structura comuna a tuturor paginilor (inclusiv pagina de start): legatura "Sari la continut", antetul cu navigarea,
 * zona principala (<main>) in care se afiseaza pagina curenta si subsolul cu starea sistemului.
 *
 * Reperele HTML (header, nav, main, footer) permit utilizatorilor de cititoare de ecran sa
 * sara direct la zona dorita. Antetul afiseaza logo-ul (public/logo.png si varianta pentru
 * modul intunecat, public/logo-intunecat.png).
 */
import { NavLink, Outlet, useLocation } from 'react-router';
import { SystemStatus } from '../components/SystemStatus';

export function Layout() {
  // Pagina de start are sectiuni pe toata latimea ecranului, deci nu e incadrata in .container
  const isLanding = useLocation().pathname === '/';

  return (
    <>
      <a className="skip-link" href="#continut">
        Sari la conținutul principal
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          {/* Logo-ul are doua variante: textul inchis pe fundal deschis si invers. */}
          <NavLink to="/" className="brand">
            <picture>
              <source srcSet="/logo-intunecat.png" media="(prefers-color-scheme: dark)" />
              <img
                className="brand__logo"
                src="/logo.png"
                alt="W4A, Web For All: pagina principală"
                width={630}
                height={120}
              />
            </picture>
          </NavLink>
          <nav aria-label="Navigare principală">
            <ul className="nav-list">
              <li>
                <NavLink to="/proiecte">Proiecte</NavLink>
              </li>
              <li>
                <NavLink to="/despre">Despre și limitări</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="continut" className={isLanding ? 'landing-main' : 'container'}>
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
