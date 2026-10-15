/**
 * Pagina "Despre si limitari": ce face platforma si, la fel de important, ce NU poate face.
 * Transparenta asupra limitelor testarii automate e un principiu de baza al proiectului.
 */
import { PageHeading } from '../components/PageHeading';

export function AboutPage() {
  return (
    <>
      <PageHeading title="Despre și limitări" />
      <p className="lead">
        W4A (Web For All) verifică automat accesibilitatea paginilor web, folosind motorul
        open-source axe-core într-un browser real.
      </p>

      <section aria-labelledby="ce-face" className="section">
        <h2 id="ce-face">Ce face</h2>
        <ul>
          <li>Deschide pagina într-un browser real și rulează regulile automate axe-core.</li>
          <li>
            Leagă fiecare problemă de criteriile WCAG relevante și arată elementele afectate din
            pagină.
          </li>
          <li>
            Separă clar problemele detectate de cazurile pe care motorul nu le poate decide singur
            („de verificat manual”).
          </li>
          <li>
            Păstrează configurația și versiunile folosite, ca rezultatele să fie reproductibile.
          </li>
        </ul>
      </section>

      <section aria-labelledby="ce-nu-face" className="section">
        <h2 id="ce-nu-face">Ce nu face</h2>
        <ul>
          <li>
            <strong>Nu certifică conformitatea.</strong> Testarea automată găsește doar o parte din
            probleme; zero probleme detectate nu înseamnă conformitate cu WCAG.
          </li>
          <li>
            <strong>Nu dă verdicte juridice.</strong> Rezultatele sunt constatări tehnice, nu
            încălcări ale legii.
          </li>
          <li>
            Nu evaluează sensul conținutului (de exemplu, dacă un text alternativ descrie corect o
            imagine) și nici utilizarea reală cu tastatura sau cu un cititor de ecran.
          </li>
          <li>Scanează o singură pagină odată, fără autentificare.</li>
        </ul>
      </section>

      <section aria-labelledby="siguranta" className="section">
        <h2 id="siguranta">Siguranță</h2>
        <p>
          Scannerul refuză adresele care duc spre rețele interne, adrese locale sau servicii de
          metadate cloud, inclusiv prin redirecționări. O scanare poate viza doar pagini de pe
          site-ul proiectului.
        </p>
      </section>
    </>
  );
}
