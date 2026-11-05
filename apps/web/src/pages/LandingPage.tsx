/**
 * Pagina de start (/): prezinta platforma si duce mai departe, ca un meniu, spre cele doua
 * zone ale aplicatiei: proiectele (unde se fac auditurile) si pagina "Despre si limitari".
 *
 * Sectiuni:
 *   1. deschiderea (hero): ce face W4A + butoanele principale + un exemplu de rezultat;
 *   2. cum functioneaza: cei trei pasi ai unui audit;
 *   3. trasabilitatea: un exemplu de lant problema -> WCAG -> EN 301 549 -> OUG 112/2018;
 *   4. limitele: de ce un scan automat nu inseamna "conform";
 *   5. indemnul final spre proiecte.
 *
 * Datele normative din exemplu (criteriul WCAG, clauza EN, citatul din lege) NU sunt scrise
 * aici de mana: vin din catalogul verificat al proiectului (`@ro-a11y/catalog`).
 * Cifrele din exemplul de rezultat sunt cele ale auditului real pe site-ul de antrenament
 * "Valea Verde (cu probleme)" (aceleasi verificate de testul audit.e2e.test.ts).
 */
import { Link } from 'react-router';
import {
  EN_EDITION,
  OUG_112_2018,
  enClauseFor,
  legalProvisionsFor,
  remediationFor,
  wcagCriterion,
} from '@ro-a11y/catalog';
import { PageHeading } from '../components/PageHeading';

/** Exemplul de lant de trasabilitate: regula axe "image-alt" (imagini fara text alternativ). */
const EXAMPLE_RULE = 'image-alt';
const EXAMPLE_CRITERION = '1.1.1';

/** Problemele comune gasite de auditul site-ului de antrenament (pe cate pagini din 6). */
const DEMO_PAGES = 6;
const DEMO_ISSUES = [
  { rule: 'link-name', pages: 6 },
  { rule: 'html-has-lang', pages: 6 },
  { rule: 'image-alt', pages: 2 },
];

export function LandingPage() {
  return (
    <div className="landing">
      <Hero />
      <Steps />
      <TraceShowcase />
      <Honesty />
      <FinalCall />
    </div>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-titlu">
      <HeroRibbons />
      <div className="landing__inner hero__grid">
        <div className="hero__text">
          <p className="hero__kicker">Audit de accesibilitate pentru site-urile din România</p>
          <PageHeading title="Audit de accesibilitate web" className="hero__title">
            <span id="hero-titlu">
              Un web pe care îl poate folosi <span className="hero__accent">oricine</span>.
            </span>
          </PageHeading>
          <p className="hero__lead">
            W4A verifică paginile unui site într-un browser real și leagă fiecare problemă de
            criteriul WCAG, de standardul european EN 301 549 și de OUG 112/2018. Primești ce e de
            reparat, explicat în română, nu un verdict.
          </p>
          <div className="hero__actions">
            <Link className="cta cta--primary" to="/proiecte">
              Mergi la proiecte <span aria-hidden="true">→</span>
            </Link>
            <Link className="cta cta--ghost" to="/despre">
              Ce nu poate face platforma
            </Link>
          </div>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Panglicile din fundalul deschiderii, desenate dupa forma "W"-ului din logo (doar decor). */
function HeroRibbons() {
  return (
    <svg
      className="hero__ribbons"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="panglica-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#25d398" stopOpacity="0.55" />
          <stop offset="1" stopColor="#5df5a8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="panglica-2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5df5a8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#03644a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="hero__ribbon hero__ribbon--1"
        d="M640 -40 C 760 260, 820 420, 900 470 S 1080 300, 1180 40"
        stroke="url(#panglica-1)"
      />
      <path
        className="hero__ribbon hero__ribbon--2"
        d="M760 640 C 860 380, 940 240, 1040 260 S 1180 520, 1260 600"
        stroke="url(#panglica-2)"
      />
      <circle className="hero__dot" cx="1110" cy="96" r="38" fill="#5df5a8" fillOpacity="0.16" />
    </svg>
  );
}

/** Un exemplu de rezultat, construit din auditul real pe site-ul de antrenament. */
function HeroPreview() {
  return (
    <figure className="preview">
      <div className="preview__bar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="preview__body">
        <p className="preview__eyebrow">Audit · {DEMO_PAGES} pagini verificate</p>
        <p className="preview__title">Probleme comune pe tot site-ul</p>
        <ul className="preview__list">
          {DEMO_ISSUES.map(({ rule, pages }) => (
            <li key={rule} className="preview__item">
              <span className="preview__label">{remediationFor(rule)?.titleRo ?? rule}</span>
              <span className="preview__meter" aria-hidden="true">
                <span style={{ width: `${(pages / DEMO_PAGES) * 100}%` }} />
              </span>
              <span className="preview__count">
                pe {pages} din {DEMO_PAGES} pagini
              </span>
            </li>
          ))}
        </ul>
        <p className="preview__hint">Se repară o singură dată, în șablonul site-ului.</p>
      </div>
      <figcaption className="preview__caption">
        Exemplu real: auditul site-ului de antrenament „Valea Verde”.
      </figcaption>
    </figure>
  );
}

function Steps() {
  return (
    <section className="landing-section" aria-labelledby="cum-functioneaza">
      <div className="landing__inner">
        <h2 id="cum-functioneaza" className="landing__heading">
          De la o adresă la o listă de reparat
        </h2>
        <ol className="steps">
          <li className="step">
            <h3 className="step__title">Adaugi site-ul</h3>
            <p>
              Un proiect înseamnă un site. Dai adresa lui și, dacă vrei, răspunzi la câteva
              întrebări despre cine îl administrează, ca să afli dacă OUG 112/2018 se poate aplica.
            </p>
          </li>
          <li className="step">
            <h3 className="step__title">Alegi paginile</h3>
            <p>
              W4A găsește paginile din meniu și din sitemap.xml și îți propune un eșantion variat,
              de până la 20 de pagini. Tu confirmi sau schimbi lista.
            </p>
          </li>
          <li className="step">
            <h3 className="step__title">Primești ce e de reparat</h3>
            <p>
              Problemele de pe fiecare pagină, cele comune tuturor paginilor și, pentru fiecare, cum
              o repari și de ce contează.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}

function TraceShowcase() {
  const criterion = wcagCriterion(EXAMPLE_CRITERION);
  const remediation = remediationFor(EXAMPLE_RULE);
  const en = enClauseFor(EXAMPLE_CRITERION, []);
  const [law] = criterion ? legalProvisionsFor(criterion.principle, en.clause !== null) : [];
  if (!criterion || !remediation || !law) return null;

  return (
    <section className="landing-section landing-section--tinted" aria-labelledby="trasabilitate">
      <div className="landing__inner">
        <h2 id="trasabilitate" className="landing__heading">
          Fiecare problemă, legată de regula din care vine
        </h2>
        <p className="landing__intro">
          Un raport spune „imagine fără text alternativ”. W4A îți arată și de unde vine cerința: din
          ghidul internațional, prin standardul european, până la legea românească.
        </p>
        <ol className="chain">
          <li className="chain__node">
            <p className="chain__kind">Problema găsită</p>
            <p className="chain__main">{remediation.titleRo}</p>
            <p className="chain__detail">
              regula axe-core <code>{EXAMPLE_RULE}</code>
            </p>
          </li>
          <li className="chain__node">
            <p className="chain__kind">WCAG 2.2</p>
            <p className="chain__main">{criterion.number}</p>
            <p className="chain__detail">
              {criterion.titleRo ?? criterion.titleEn}, nivel {criterion.level}
            </p>
          </li>
          <li className="chain__node">
            <p className="chain__kind">
              {EN_EDITION.standard} {EN_EDITION.version.split(' ')[0]}
            </p>
            <p className="chain__main">clauza {en.clause}</p>
            <p className="chain__detail">standardul armonizat la nivelul Uniunii Europene</p>
          </li>
          <li className="chain__node chain__node--law">
            <p className="chain__kind">OUG 112/2018</p>
            <p className="chain__main">{law.articleRef}</p>
            <blockquote className="chain__quote">„{law.quote}”</blockquote>
          </li>
        </ol>
        <p className="landing__note">
          Citatele din lege sunt copiate exact de pe{' '}
          <a href={OUG_112_2018.sourceUrl}>Portalul Legislativ</a>. Dacă legea se aplică unui site
          anume depinde de cine îl administrează și rămâne de confirmat de un specialist.
        </p>
      </div>
    </section>
  );
}

function Honesty() {
  return (
    <section className="landing-section" aria-labelledby="limite">
      <div className="landing__inner honesty">
        <h2 id="limite" className="honesty__statement">
          Un test automat nu poate spune că un site e accesibil. Poate doar să găsească{' '}
          <span className="honesty__mark">unde sigur nu este</span>.
        </h2>
        <div className="honesty__body">
          <p>
            Motorul axe-core verifică automat doar o parte din criteriile WCAG; restul cer ochiul
            unui om. De aceea W4A vorbește despre „probleme detectate” și „de verificat manual”,
            niciodată despre „conform” sau „încalcă legea”.
          </p>
          <Link className="text-link" to="/despre">
            Citește ce face și ce nu face platforma <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="final-call" aria-labelledby="incepe">
      <div className="landing__inner final-call__inner">
        <h2 id="incepe" className="final-call__title">
          Începe cu primul site.
        </h2>
        <Link className="cta cta--primary" to="/proiecte">
          Mergi la proiecte <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
