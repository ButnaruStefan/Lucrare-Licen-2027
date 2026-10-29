/**
 * Pagina unei scanari: starea (actualizata automat cat timp ruleaza), detaliile tehnice,
 * sumarul pe categorii si lista rezultatelor, cu filtre.
 *
 * Accesibilitate:
 *   - schimbarea starii scanarii e anuntata de cititorul de ecran (role="status");
 *   - filtrele sunt grupate (fieldset + legend), iar numarul de rezultate afisate e anuntat;
 *   - filtrele sunt copiate in adresa paginii (?categorie=...), deci "Inapoi" le pastreaza.
 */
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  IMPACTS,
  RESULT_CATEGORIES,
  type Impact,
  type ResultCategory,
  type RuleResult,
  type Scan,
} from '@ro-a11y/shared';
import { ApiRequestError } from '../api/client';
import { useProject, useScan, useScanResults } from '../api/queries';
import { ScanStatusBadge } from '../components/Badges';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import { PageHeading } from '../components/PageHeading';
import { RuleResultItem, type OtherCategory } from '../components/RuleResultItem';
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  formatDate,
  formatDuration,
  IMPACT_LABELS,
  WCAG_PROFILE_LABELS,
} from '../lib/labels';

export function ScanPage() {
  const { scanId = '' } = useParams();
  const scan = useScan(scanId);

  if (scan.isPending) return <Loading label="Se încarcă scanarea..." />;
  if (scan.isError) {
    const notFound = scan.error instanceof ApiRequestError && scan.error.status === 404;
    return (
      <>
        <PageHeading title={notFound ? 'Scanarea nu există' : 'Eroare'} />
        <ErrorMessage error={scan.error} />
        <p>
          <Link to="/">Înapoi la proiecte</Link>
        </p>
      </>
    );
  }

  return <ScanView scan={scan.data} />;
}

function ScanView({ scan }: { scan: Scan }) {
  const project = useProject(scan.projectId);
  const results = useScanResults(scan.id, scan.status === 'completed');

  return (
    <>
      <p className="breadcrumb">
        <Link to="/">Proiecte</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/proiecte/${scan.projectId}`}>{project.data?.name ?? 'Proiect'}</Link>{' '}
        <span aria-hidden="true">›</span> Scanare
      </p>
      <PageHeading title={`Scanare din ${formatDate(scan.createdAt)}`} />
      <p className="lead url">{scan.pageUrl}</p>

      <div role="status" className="scan-status">
        <StatusText scan={scan} />
      </div>

      <ScanDetails scan={scan} />

      {scan.status === 'completed' && scan.summary && (
        <section aria-labelledby="sumar" className="section">
          <h2 id="sumar">Sumar</h2>
          <ul className="summary-grid">
            <SummaryCard
              category="violation"
              rules={scan.summary.violations}
              elements={scan.summary.violationElements}
            />
            <SummaryCard
              category="incomplete"
              rules={scan.summary.incomplete}
              elements={scan.summary.incompleteElements}
            />
            <SummaryCard category="pass" rules={scan.summary.passes} />
            <SummaryCard category="inapplicable" rules={scan.summary.inapplicable} />
          </ul>
          <p className="notice notice--info">
            Testarea automată găsește doar o parte din problemele de accesibilitate. Zero probleme
            detectate <strong>nu</strong> înseamnă că pagina este conformă cu WCAG; unele aspecte
            pot fi evaluate doar de un om.
          </p>
        </section>
      )}

      {scan.status === 'completed' && (
        <section aria-labelledby="rezultate" className="section">
          <h2 id="rezultate">Rezultate pe reguli</h2>
          {results.isPending && <Loading label="Se încarcă rezultatele..." />}
          {results.isError && <ErrorMessage error={results.error} />}
          {results.data && (
            <ResultsExplorer
              items={results.data.items}
              legalProfileHref={`/proiecte/${scan.projectId}/profil-juridic`}
            />
          )}
        </section>
      )}
    </>
  );
}

function StatusText({ scan }: { scan: Scan }) {
  switch (scan.status) {
    case 'queued':
      return (
        <p>
          <ScanStatusBadge status="queued" /> Scanarea așteaptă să fie preluată. Pagina se
          actualizează automat.
        </p>
      );
    case 'running':
      return (
        <p>
          <ScanStatusBadge status="running" /> Scanarea este în curs. Pagina se actualizează
          automat.
        </p>
      );
    case 'failed':
      return (
        <div className="notice notice--error">
          <p className="notice__title">
            <ScanStatusBadge status="failed" /> Scanarea nu a putut fi finalizată
          </p>
          <p>{scan.errorMessage}</p>
          <p className="muted">
            Cod: <code>{scan.errorCode}</code>. Un eșec tehnic nu înseamnă că site-ul este
            inaccesibil.
          </p>
        </div>
      );
    case 'completed':
      return (
        <p>
          <ScanStatusBadge status="completed" /> Scanarea s-a încheiat în{' '}
          {formatDuration(scan.startedAt, scan.finishedAt)}.
        </p>
      );
  }
}

function ScanDetails({ scan }: { scan: Scan }) {
  return (
    <details className="section card scan-details">
      <summary>Detalii tehnice ale scanării</summary>
      <dl className="details-list">
        <dt>Pagina cerută</dt>
        <dd className="url">{scan.pageUrl}</dd>
        <dt>Pagina încărcată</dt>
        <dd className="url">{scan.finalUrl ?? '—'}</dd>
        <dt>Cod HTTP</dt>
        <dd>{scan.httpStatus ?? '—'}</dd>
        <dt>Standard</dt>
        <dd>{WCAG_PROFILE_LABELS[scan.config.wcagProfile]}</dd>
        <dt>Bune practici incluse</dt>
        <dd>{scan.config.includeBestPractices ? 'Da' : 'Nu'}</dd>
        <dt>Ecran simulat</dt>
        <dd>
          {scan.config.viewport.width} × {scan.config.viewport.height} pixeli, limba{' '}
          {scan.config.locale}
        </dd>
        <dt>Versiunea catalogului normativ</dt>
        <dd>{scan.catalogVersion ?? '—'}</dd>
        <dt>Motor</dt>
        <dd>
          {scan.engineName ?? '—'} {scan.engineVersion ?? ''}
        </dd>
        <dt>Browser</dt>
        <dd>{scan.browserVersion ?? '—'}</dd>
        <dt>Pornită / terminată</dt>
        <dd>
          {formatDate(scan.startedAt)} / {formatDate(scan.finishedAt)}
        </dd>
      </dl>
    </details>
  );
}

function SummaryCard({
  category,
  rules,
  elements,
}: {
  category: ResultCategory;
  rules: number;
  elements?: number;
}) {
  return (
    <li className={`summary-card summary-card--${category}`}>
      <p className="summary-card__label">{CATEGORY_LABELS[category]}</p>
      <p className="summary-card__value">
        {rules} <span className="summary-card__unit">{rules === 1 ? 'regulă' : 'reguli'}</span>
      </p>
      {elements !== undefined && (
        <p className="summary-card__detail">
          {elements} {elements === 1 ? 'element afectat' : 'elemente afectate'}
        </p>
      )}
      <p className="summary-card__detail">{CATEGORY_DESCRIPTIONS[category]}</p>
    </li>
  );
}

interface Filters {
  category: ResultCategory;
  impact: Impact | null;
  showBestPractices: boolean;
  query: string;
}

/** Citeste filtrele din adresa paginii (ex. ?categorie=incomplete&gravitate=critical). */
function filtersFromParams(params: URLSearchParams): Filters {
  const category = params.get('categorie') ?? '';
  const impact = params.get('gravitate') ?? '';
  return {
    category: (RESULT_CATEGORIES as readonly string[]).includes(category)
      ? (category as ResultCategory)
      : 'violation',
    impact: (IMPACTS as readonly string[]).includes(impact) ? (impact as Impact) : null,
    showBestPractices: params.get('bune-practici') !== 'nu',
    query: params.get('cauta') ?? '',
  };
}

/**
 * Lista rezultatelor, cu filtre.
 *
 * Filtrele sunt tinute in starea componentei (raspuns imediat la tastare si click) si sunt
 * copiate in adresa paginii, ca butonul "Inapoi" sau un link trimis cuiva sa le pastreze.
 * Daca am citi valoarea DOAR din adresa, campul ar ramane o clipa la valoarea veche (adresa se
 * actualizeaza cu intarziere), iar la tastare s-ar putea pierde litere.
 */
function ResultsExplorer({
  items,
  legalProfileHref,
}: {
  items: RuleResult[];
  legalProfileHref: string;
}) {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(params));
  const { category, impact, showBestPractices, query } = filters;

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const search = new URLSearchParams();
    if (next.category !== 'violation') search.set('categorie', next.category);
    if (next.impact) search.set('gravitate', next.impact);
    if (!next.showBestPractices) search.set('bune-practici', 'nu');
    if (next.query) search.set('cauta', next.query);
    setParams(search, { replace: true, preventScrollReset: true });
  }

  // Aceeasi regula in mai multe categorii (cu elemente diferite): doar problemele sigure si
  // cazurile de verificat manual conteaza aici (regulile trecute nu pastreaza elemente).
  const categoriesByRule = new Map<string, OtherCategory[]>();
  for (const item of items) {
    if (item.category !== 'violation' && item.category !== 'incomplete') continue;
    const list = categoriesByRule.get(item.axeRuleId) ?? [];
    list.push({ category: item.category, elementCount: item.affectedElements.length });
    categoriesByRule.set(item.axeRuleId, list);
  }

  /** Trece la alta categorie si muta focusul pe butonul ei din filtre (nu se pierde). */
  function showCategory(next: ResultCategory) {
    update('category', next);
    document.querySelector<HTMLInputElement>(`input[name="categorie"][value="${next}"]`)?.focus();
  }

  const counts = Object.fromEntries(
    RESULT_CATEGORIES.map((c) => [c, items.filter((i) => i.category === c).length]),
  ) as Record<ResultCategory, number>;

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      item.category === category &&
      (!impact || item.impact === impact) &&
      (showBestPractices || !item.isBestPractice) &&
      (!needle ||
        item.axeRuleId.toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle) ||
        item.wcagCriteria.some((c) => c.includes(needle))),
  );
  const showImpactFilter = category === 'violation' || category === 'incomplete';

  return (
    <>
      <form
        className="filters card"
        aria-label="Filtrează rezultatele"
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset className="filters__group">
          <legend>Categorie</legend>
          <div className="segmented">
            {RESULT_CATEGORIES.map((c) => (
              <label key={c} className="segmented__option">
                <input
                  type="radio"
                  name="categorie"
                  value={c}
                  checked={category === c}
                  onChange={() => update('category', c)}
                />
                <span>
                  {CATEGORY_LABELS[c]} ({counts[c]})
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="filters__row">
          {showImpactFilter && (
            <div className="field">
              <label htmlFor="filtru-gravitate">Gravitate</label>
              <select
                id="filtru-gravitate"
                value={impact ?? ''}
                onChange={(e) => update('impact', (e.target.value || null) as Impact | null)}
              >
                <option value="">Toate</option>
                {IMPACTS.map((i) => (
                  <option key={i} value={i}>
                    {IMPACT_LABELS[i]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="filtru-cauta">Caută regulă sau criteriu WCAG</label>
            <input
              id="filtru-cauta"
              type="search"
              value={query}
              onChange={(e) => update('query', e.target.value)}
            />
          </div>
          <div className="field field--checkbox">
            <input
              id="filtru-bune-practici"
              type="checkbox"
              checked={showBestPractices}
              onChange={(e) => update('showBestPractices', e.target.checked)}
            />
            <label htmlFor="filtru-bune-practici">Arată și bunele practici</label>
          </div>
        </div>
      </form>

      <p role="status" className="results-count">
        {visible.length === 1 ? '1 regulă afișată' : `${visible.length} reguli afișate`}
      </p>

      {visible.length === 0 ? (
        <EmptyState>Niciun rezultat pentru filtrele alese.</EmptyState>
      ) : (
        <ul className="rule-list">
          {visible.map((item) => (
            <RuleResultItem
              key={item.id}
              result={item}
              legalProfileHref={legalProfileHref}
              otherCategories={(categoriesByRule.get(item.axeRuleId) ?? []).filter(
                (o) => o.category !== item.category,
              )}
              onShowCategory={showCategory}
            />
          ))}
        </ul>
      )}
    </>
  );
}
