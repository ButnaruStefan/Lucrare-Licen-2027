/**
 * Rezultatele unui audit pe mai multe pagini, adunate pe tot site-ul. Folosit de `AuditPage`.
 *
 *   - "Probleme comune": acelasi element, cu aceeasi problema, pe mai multe pagini (de obicei
 *     meniul sau subsolul, venite din sablonul site-ului). Se repara o singura data.
 *     Sunt grupate pe reguli (un site real poate avea zeci de elemente comune la aceeasi
 *     regula, ex. contrastul culorilor): un card pe regula, cu primul element vizibil si
 *     restul intr-o sectiune pliabila. Problemele detectate apar inaintea celor de verificat.
 *   - "Pe reguli": fiecare regula cu probleme sau de verificat manual, cu numarul de pagini
 *     si de elemente; lista paginilor duce la scanarea fiecarei pagini (detaliile complete,
 *     remedierea si lantul de trasabilitate).
 *
 * Titlurile sunt in romana (din catalogul de remedieri), cu numele tehnic al regulii alaturi.
 */
import { Link } from 'react-router';
import type { AuditResults, AuditRule, CommonIssue } from '@ro-a11y/shared';
import { ImpactBadge } from './Badges';
import { CollapsibleSection } from './CollapsibleSection';
import { EmptyState } from './Feedback';
import { CATEGORY_LABELS } from '../lib/labels';

function pagesText(count: number, total: number): string {
  return `pe ${count} din ${total} ${total === 1 ? 'pagină' : 'pagini'}`;
}

function shortPath(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

export function AuditResultsView({ results }: { results: AuditResults }) {
  const total = results.pagesScanned;
  const violations = results.rules.filter((r) => r.category === 'violation');
  const incomplete = results.rules.filter((r) => r.category === 'incomplete');

  return (
    <>
      <section aria-labelledby="probleme-comune" className="section">
        <h2 id="probleme-comune">Probleme comune ({results.commonIssues.length})</h2>
        <p className="muted">
          Același element, cu aceeași problemă, pe mai multe pagini: de obicei vine din șablonul
          site-ului (meniu, antet, subsol). Se repară o singură dată și dispare de pe toate
          paginile, probabil și de pe cele neverificate.
        </p>
        {results.commonIssues.length === 0 ? (
          <EmptyState>Nicio problemă nu se repetă pe mai multe pagini.</EmptyState>
        ) : (
          <ul className="rule-list">
            {groupCommonIssues(results.commonIssues).map((group) => (
              <CommonIssueGroupItem key={group.key} group={group} total={total} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pe-reguli" className="section">
        <h2 id="pe-reguli">Pe reguli, pe tot site-ul</h2>
        <RuleGroup
          title={`${CATEGORY_LABELS.violation} (${violations.length})`}
          rules={violations}
          total={total}
          empty="Nicio problemă detectată automat pe paginile verificate."
        />
        <RuleGroup
          title={`${CATEGORY_LABELS.incomplete} (${incomplete.length})`}
          rules={incomplete}
          total={total}
          empty="Niciun caz de verificat manual."
        />
      </section>
    </>
  );
}

interface CommonIssueGroup {
  key: string;
  first: CommonIssue;
  issues: CommonIssue[];
  /** Paginile pe care apare cel putin unul dintre elemente (fara dubluri). */
  pages: CommonIssue['pages'];
}

/** Grupeaza problemele comune pe regula + categorie; detectatele primele, apoi dupa numar. */
function groupCommonIssues(issues: CommonIssue[]): CommonIssueGroup[] {
  const groups = new Map<string, CommonIssueGroup>();
  for (const issue of issues) {
    const key = `${issue.category}-${issue.axeRuleId}`;
    const group = groups.get(key) ?? { key, first: issue, issues: [], pages: [] };
    group.issues.push(issue);
    for (const page of issue.pages) {
      if (!group.pages.some((p) => p.scanId === page.scanId)) group.pages.push(page);
    }
    groups.set(key, group);
  }
  const order = { violation: 0, incomplete: 1 };
  return [...groups.values()].sort(
    (a, b) =>
      order[a.first.category] - order[b.first.category] || b.issues.length - a.issues.length,
  );
}

function CommonIssueGroupItem({ group, total }: { group: CommonIssueGroup; total: number }) {
  const { first, issues } = group;
  const others = issues.slice(1);
  return (
    <li className="rule">
      <div className="rule__card">
        <p className="rule__title">{first.titleRo ?? first.title}</p>
        <p className="rule__meta">
          <ImpactBadge impact={first.impact} />
          <span className="tag">{CATEGORY_LABELS[first.category]}</span>
          <code className="rule__id">{first.axeRuleId}</code>
          <span className="rule__count">
            {issues.length === 1 ? '1 element' : `${issues.length} elemente`},{' '}
            {pagesText(group.pages.length, total)}
          </span>
        </p>
        <p className="element__label">{issues.length === 1 ? 'Elementul' : 'Primul element'}</p>
        <pre className="element__html">{first.htmlSnippet}</pre>
        <CollapsibleSection
          title="Paginile pe care apare"
          icon="where"
          hint={`${group.pages.length} ${group.pages.length === 1 ? 'pagină' : 'pagini'}`}
        >
          <PageLinks pages={group.pages} />
        </CollapsibleSection>
        {others.length > 0 && (
          <CollapsibleSection
            title="Celelalte elemente"
            icon="code"
            hint={others.length === 1 ? 'încă 1 element' : `încă ${others.length} elemente`}
          >
            <ol className="element-list">
              {others.map((issue) => (
                <li key={issue.key}>
                  <pre className="element__html">{issue.htmlSnippet}</pre>
                  <p className="rule__count">{pagesText(issue.pages.length, total)}</p>
                </li>
              ))}
            </ol>
          </CollapsibleSection>
        )}
      </div>
    </li>
  );
}

function RuleGroup({
  title,
  rules,
  total,
  empty,
}: {
  title: string;
  rules: AuditRule[];
  total: number;
  empty: string;
}) {
  return (
    <>
      <h3 className="audit-rules__heading">{title}</h3>
      {rules.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="rule-list">
          {rules.map((rule) => (
            <li key={`${rule.axeRuleId}-${rule.category}`} className="rule">
              <div className="rule__card">
                <p className="rule__title">
                  {rule.titleRo ?? rule.title}
                  {rule.isBestPractice && (
                    <>
                      {' '}
                      <span className="tag tag--muted">bună practică</span>
                    </>
                  )}
                </p>
                <p className="rule__meta">
                  <ImpactBadge impact={rule.impact} />
                  <code className="rule__id">{rule.axeRuleId}</code>
                  {rule.wcagCriteria.length > 0 && (
                    <span className="tag">WCAG {rule.wcagCriteria.join(', ')}</span>
                  )}
                  <span className="rule__count">
                    {pagesText(rule.pages.length, total)},{' '}
                    {rule.elementCount === 1 ? '1 element' : `${rule.elementCount} elemente`}
                  </span>
                </p>
                <CollapsibleSection
                  title="Paginile pe care apare"
                  icon="where"
                  hint={`${rule.pages.length} ${rule.pages.length === 1 ? 'pagină' : 'pagini'}`}
                >
                  <PageLinks pages={rule.pages} />
                </CollapsibleSection>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PageLinks({
  pages,
}: {
  pages: Array<{ scanId: string; pageUrl: string; elementCount?: number }>;
}) {
  return (
    <ul className="audit-page-links">
      {pages.map((page) => (
        <li key={page.scanId}>
          <Link to={`/scanari/${page.scanId}`} className="url">
            {shortPath(page.pageUrl)}
          </Link>
          {page.elementCount !== undefined && (
            <span className="muted">
              {' '}
              — {page.elementCount === 1 ? '1 element' : `${page.elementCount} elemente`}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
