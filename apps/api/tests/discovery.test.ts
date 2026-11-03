/**
 * Teste pentru functiile "pure" ale descoperirii de pagini (fara browser, fara retea):
 * clasificarea linkurilor, robots.txt, sitemap.xml, propunerea esantionului si
 * construirea rezultatului descoperirii.
 */
import { describe, expect, it } from 'vitest';
import { buildDiscovery } from '../src/discovery/discover';
import { classifyLink, dedupeKey, scopeFor, scopeLabel } from '../src/discovery/links';
import { parseRobots } from '../src/discovery/robots';
import { proposeSample, randomSlotsFor, type CandidatePage } from '../src/discovery/sample';
import { parseSitemap } from '../src/discovery/sitemap';

const START = 'https://www.primarie.ro/';
const scope = scopeFor(START);

describe('classifyLink', () => {
  it('pagina de pe acelasi site devine pagina candidata, fara # si parametri de urmarire', () => {
    expect(
      classifyLink('https://www.primarie.ro/anunturi?utm_source=fb&id=3#sus', scope, START),
    ).toEqual({ kind: 'page', url: 'https://www.primarie.ro/anunturi?id=3' });
  });

  it('www, http si https ale aceluiasi domeniu sunt acelasi site', () => {
    expect(classifyLink('http://primarie.ro/contact', scope, START)).toEqual({
      kind: 'page',
      url: 'https://www.primarie.ro/contact',
    });
  });

  it('pastreaza parametrii care schimba pagina (ex. adresele Lotus Domino "?Open")', () => {
    expect(
      classifyLink('https://www.primarie.ro/portal.nsf/pagini/consiliu-0001?Open', scope, START),
    ).toEqual({
      kind: 'page',
      url: 'https://www.primarie.ro/portal.nsf/pagini/consiliu-0001?Open',
    });
  });

  it('alt domeniu este serviciu extern', () => {
    expect(classifyLink('https://www.ghiseul.ro/plata', scope, START)).toEqual({
      kind: 'external',
      origin: 'https://www.ghiseul.ro',
      url: 'https://www.ghiseul.ro/plata',
    });
  });

  it.each([
    ['https://www.primarie.ro/docs/hotarare.pdf', 'pdf'],
    ['https://www.primarie.ro/formular.DOCX', 'docx'],
    ['https://www.primarie.ro/buget.xlsx#foaia2', 'xlsx'],
  ])('%s este document (%s)', (href, extension) => {
    expect(classifyLink(href, scope, START)).toMatchObject({ kind: 'document', extension });
  });

  it.each([
    ['mailto:primarie@exemplu.ro', 'non_http'],
    ['tel:+40230000000', 'non_http'],
    ['javascript:void(0)', 'non_http'],
    ['https://www.primarie.ro/#continut', 'same_page'],
    ['https://www.primarie.ro/poze/sediu.jpg', 'file'],
    ['https://www.primarie.ro/logout', 'action'],
    ['https://www.primarie.ro/cont/autentificare.html', 'action'],
    ['https://www.primarie.ro/cautare?q=taxe', 'action'],
    ['https://www.primarie.ro/index.php?action=print&id=2', 'action'],
  ])('%s este exclus (%s)', (href, reason) => {
    expect(classifyLink(href, scope, START)).toEqual({ kind: 'excluded', reason });
  });

  it('nu confunda cuvintele care doar contin un cuvant de actiune (ex. "costuri", "contact")', () => {
    expect(classifyLink('https://www.primarie.ro/costuri-utilitati', scope, START).kind).toBe(
      'page',
    );
    expect(classifyLink('https://www.primarie.ro/contact', scope, START).kind).toBe('page');
  });

  it('o pagina din afara sectiunii auditate e exclusa', () => {
    const section = scopeFor('http://localhost:4000/broken/');
    expect(scopeLabel(section)).toBe('http://localhost:4000/broken/');
    expect(
      classifyLink('http://localhost:4000/accessible/', section, 'http://localhost:4000/broken/'),
    ).toEqual({ kind: 'excluded', reason: 'outside_scope' });
    expect(
      classifyLink(
        'http://localhost:4000/broken/contact.html',
        section,
        'http://localhost:4000/broken/',
      ),
    ).toEqual({ kind: 'page', url: 'http://localhost:4000/broken/contact.html' });
  });

  it('/pagina si /pagina/ au aceeasi cheie (nu apar de doua ori)', () => {
    expect(dedupeKey('https://a.ro/pagina/')).toBe(dedupeKey('https://a.ro/pagina'));
    expect(dedupeKey('https://a.ro/')).toBe('https://a.ro/');
  });
});

describe('parseRobots', () => {
  const robots = parseRobots(`
# comentariu
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /admin/
Disallow: /*.php$
Allow: /admin/public/
Disallow:

Sitemap: https://www.primarie.ro/sitemap.xml
`);

  it('aplica grupul general (*) cand nu exista unul pentru W4A', () => {
    expect(robots.isAllowed('/anunturi')).toBe(true);
    expect(robots.isAllowed('/admin/setari')).toBe(false);
  });

  it('regula mai precisa (mai lunga) castiga: Allow face exceptie din Disallow', () => {
    expect(robots.isAllowed('/admin/public/raport')).toBe(true);
  });

  it('intelege "*" si "$"', () => {
    expect(robots.isAllowed('/pagina.php')).toBe(false);
    expect(robots.isAllowed('/pagina.php?id=2')).toBe(true);
  });

  it('citeste sitemap-urile si numara regulile Disallow care ni se aplica', () => {
    expect(robots.sitemaps).toEqual(['https://www.primarie.ro/sitemap.xml']);
    expect(robots.disallowCount).toBe(2);
  });

  it('un grup cu numele nostru inlocuieste grupul general', () => {
    const own = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: W4A\nDisallow: /privat/');
    expect(own.isAllowed('/anunturi')).toBe(true);
    expect(own.isAllowed('/privat/x')).toBe(false);
  });
});

describe('parseSitemap', () => {
  it('citeste adresele unei liste de pagini (cu &amp; decodat)', () => {
    const parsed = parseSitemap(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc> https://a.ro/ </loc></url>
  <url><loc>https://a.ro/pagina?x=1&amp;y=2</loc><lastmod>2026-01-01</lastmod></url>
</urlset>`);
    expect(parsed).toEqual({
      kind: 'urlset',
      locs: ['https://a.ro/', 'https://a.ro/pagina?x=1&y=2'],
    });
  });

  it('recunoaste un index de sitemap-uri', () => {
    const parsed = parseSitemap(
      '<sitemapindex><sitemap><loc>https://a.ro/sitemap-1.xml</loc></sitemap></sitemapindex>',
    );
    expect(parsed).toEqual({ kind: 'index', locs: ['https://a.ro/sitemap-1.xml'] });
  });
});

/** Un site ca al unei primarii: meniuri cu mai multe pagini fiecare. */
function municipalSite(): CandidatePage[] {
  const pages: CandidatePage[] = [{ url: START, label: 'Start', section: null, region: 'main' }];
  const menus: Record<string, string[]> = {
    Primăria: ['conducerea', 'organigrama', 'directii', 'program-audiente'],
    'Consiliul local': ['consilieri', 'hotarari', 'sedinte', 'proiecte-hotarari'],
    Informații: ['acte-necesare', 'formulare', 'buget-local', 'licitatii', 'concursuri'],
    Transparență: ['declaratii-avere', 'achizitii', 'rapoarte'],
  };
  for (const [section, slugs] of Object.entries(menus)) {
    for (const slug of slugs) {
      pages.push({ url: `${START}${slug}`, label: slug, section, region: 'nav' });
    }
  }
  pages.push({ url: `${START}contact`, label: 'Contact', section: null, region: 'footer' });
  pages.push({
    url: `${START}declaratie-accesibilitate`,
    label: 'Declarație de accesibilitate',
    section: null,
    region: 'footer',
  });
  for (let i = 1; i <= 30; i++) {
    pages.push({ url: `${START}stiri/${i}`, label: `Știre ${i}`, section: null, region: 'main' });
  }
  return pages;
}

describe('proposeSample', () => {
  it('pagina de start, paginile esentiale, cate una din fiecare meniu si 2 aleatorii', () => {
    const sample = proposeSample(START, municipalSite(), 10, 'audit-1');

    expect(sample.size).toBe(10);
    expect(sample.get(START)).toEqual(['start']);
    expect(sample.get(`${START}contact`)).toEqual(['essential']);
    expect(sample.get(`${START}declaratie-accesibilitate`)).toEqual(['essential']);
    // Prima pagina din fiecare meniu
    for (const slug of ['conducerea', 'consilieri', 'acte-necesare', 'declaratii-avere']) {
      expect(sample.get(`${START}${slug}`), slug).toEqual(['section']);
    }
    expect([...sample.values()].filter((r) => r.includes('random'))).toHaveLength(2);
  });

  it('alegerea aleatorie e reproductibila: aceeasi samanta, aceeasi alegere', () => {
    const a = proposeSample(START, municipalSite(), 10, 'audit-1');
    const b = proposeSample(START, municipalSite(), 10, 'audit-1');
    expect([...a.keys()]).toEqual([...b.keys()]);
  });

  it('un site mic: propune toate paginile, fara aleatorii', () => {
    const pages = municipalSite().slice(0, 4);
    const sample = proposeSample(START, pages, 10, 'x');
    expect(sample.size).toBe(4);
    expect(randomSlotsFor(10, 4)).toBe(0);
  });

  it('respecta numarul maxim de pagini', () => {
    expect(proposeSample(START, municipalSite(), 3, 'x').size).toBe(3);
    expect(proposeSample(START, municipalSite(), 1, 'x')).toEqual(new Map([[START, ['start']]]));
  });
});

describe('buildDiscovery', () => {
  it('clasifica linkurile, marcheaza paginile din robots.txt, adauga sitemap-ul si propune esantionul', () => {
    const discovery = buildDiscovery(
      START,
      {
        links: [
          { href: `${START}anunturi`, text: 'Anunțuri', region: 'nav', section: null },
          { href: `${START}anunturi/`, text: 'Anunțuri (dublura)', region: 'main', section: null },
          { href: `${START}admin/`, text: 'Administrare', region: 'footer', section: null },
          { href: `${START}hcl.pdf`, text: 'Hotărâre', region: 'main', section: null },
          { href: 'https://www.ghiseul.ro/', text: 'Ghișeul', region: 'footer', section: null },
          { href: 'mailto:a@b.ro', text: 'E-mail', region: 'footer', section: null },
        ],
        robotsText: 'User-agent: *\nDisallow: /admin/',
        sitemapLocs: [`${START}declaratie-accesibilitate`, 'https://alt-site.ro/pagina'],
        sitemapFound: true,
      },
      { maxPages: 10, seed: 'audit' },
    );

    expect(discovery.pages.map((p) => [p.url, p.region, p.proposed, p.robotsBlocked])).toEqual([
      [START, 'main', true, false],
      [`${START}anunturi`, 'nav', true, false],
      // Interzisa de robots.txt: ramane in lista, dar nu e propusa automat
      [`${START}admin/`, 'footer', false, true],
      [`${START}declaratie-accesibilitate`, 'sitemap', true, false],
    ]);
    expect(discovery.pages[3]!.label).toBe('declaratie accesibilitate');
    expect(discovery.pages.some((p) => p.selected)).toBe(false);
    expect(discovery.documents).toEqual([
      { url: `${START}hcl.pdf`, label: 'Hotărâre', extension: 'pdf' },
    ]);
    expect(discovery.external.map((e) => e.origin)).toEqual([
      'https://www.ghiseul.ro',
      'https://alt-site.ro',
    ]);
    expect(discovery.excluded).toEqual({ non_http: 1 });
    expect(discovery.robots).toEqual({ found: true, blocked: 1 });
    expect(discovery.sitemap).toEqual({ found: true, urls: 2 });
    expect(discovery.linksFound).toBe(6);
  });
});
