/**
 * Formularul de alegere a paginilor unui audit (dupa ce worker-ul a gasit paginile site-ului).
 *
 * Paginile sunt grupate pe sectiuni (meniul din care fac parte), cu cele propuse automat deja
 * bifate si motivul propunerii afisat langa ele. Utilizatorul poate bifa, debifa sau adauga
 * manual o adresa de pe acelasi site. Paginile interzise de robots.txt apar nebifate si
 * marcate: nu sunt propuse automat, dar utilizatorul le poate alege, constient.
 * Folosit de pagina auditului (`AuditPage`).
 *
 * Accesibilitate:
 *   - fiecare sectiune e un grup (fieldset + legend), fiecare pagina o casuta cu eticheta;
 *   - numarul de pagini alese e anuntat de cititorul de ecran (role="status");
 *   - grupurile mari isi ascund paginile nepropuse intr-un <details>, ca lista sa ramana scurta;
 *   - la o eroare, focusul ajunge pe mesaj (sau pe campul gresit).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AUDIT_MAX_PAGES, type Audit, type DiscoveredPage, type Discovery } from '@ro-a11y/shared';
import { useSelectAuditPages } from '../api/queries';
import { ErrorMessage } from './Feedback';
import { TextField } from './TextField';
import { useFocusFirstInvalid } from '../lib/focus';
import { SELECTION_REASON_LABELS } from '../lib/labels';

/** Cate pagini arata un grup inainte de "Arata inca N pagini". */
const VISIBLE_PER_GROUP = 6;

interface PageGroup {
  name: string;
  pages: DiscoveredPage[];
}

/** Grupeaza paginile pe sectiuni, in ordinea aparitiei; cele propuse primele in fiecare grup. */
function groupPages(discovery: Discovery): PageGroup[] {
  const groups = new Map<string, DiscoveredPage[]>();
  for (const page of discovery.pages) {
    const name = page.reasons.includes('start')
      ? 'Pagina de start'
      : (page.section ??
        (page.region === 'sitemap' ? 'Găsite doar în sitemap.xml' : 'Alte pagini'));
    const list = groups.get(name) ?? [];
    list.push(page);
    groups.set(name, list);
  }
  return [...groups.entries()].map(([name, pages]) => ({
    name,
    pages: [...pages].sort((a, b) => Number(b.proposed) - Number(a.proposed)),
  }));
}

/** Calea paginii, mai scurta decat adresa completa (ex. "/servicii/taxe.html"). */
function shortPath(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

export function PageSelectionForm({ audit }: { audit: Audit }) {
  const discovery = audit.discovery!;
  const select = useSelectAuditPages(audit.id);
  const [checked, setChecked] = useState(
    () => new Set(discovery.pages.filter((p) => p.proposed).map((p) => p.url)),
  );
  const [manual, setManual] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  /** Creste la fiecare trimitere respinsa (local sau de server): mutam focusul pe mesaj. */
  const [rejectedSubmits, setRejectedSubmits] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useFocusFirstInvalid(formRef, manualError ? failedSubmits : 0);
  // Dupa desenarea mesajului de eroare (efectul ruleaza dupa desen, deci mesajul exista)
  useEffect(() => {
    if (rejectedSubmits > 0) errorRef.current?.focus();
  }, [rejectedSubmits]);

  const groups = groupPages(discovery);
  const proposedCount = discovery.pages.filter((p) => p.proposed).length;
  const chosenCount = checked.size + manual.length;
  const scopeHost = new URL(discovery.finalUrl).hostname.replace(/^www\./, '');

  function toggle(url: string, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(url);
    else next.delete(url);
    setChecked(next);
  }

  function addManual() {
    let url: URL;
    try {
      url = new URL(manualInput.trim());
    } catch {
      setManualError('Adresa nu este validă (ex. https://site.ro/pagina).');
      setFailedSubmits((n) => n + 1);
      return;
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname.replace(/^www\./, '') !== scopeHost
    ) {
      setManualError(`Pagina trebuie să fie de pe site-ul auditat (${discovery.scope}).`);
      setFailedSubmits((n) => n + 1);
      return;
    }
    url.hash = '';
    const value = url.toString();
    const known = discovery.pages.find((p) => p.url === value);
    if (known) {
      toggle(known.url, true);
    } else if (!manual.includes(value)) {
      setManual([...manual, value]);
    }
    setManualInput('');
    setManualError(undefined);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const urls = [
      ...discovery.pages.filter((p) => checked.has(p.url)).map((p) => p.url),
      ...manual,
    ];
    if (urls.length === 0 || urls.length > AUDIT_MAX_PAGES) {
      setLocalError(
        urls.length === 0
          ? 'Alege cel puțin o pagină.'
          : `Poți alege cel mult ${AUDIT_MAX_PAGES} de pagini. Acum sunt ${urls.length}.`,
      );
      setRejectedSubmits((n) => n + 1);
      return;
    }
    setLocalError(null);
    select.mutate({ urls }, { onError: () => setRejectedSubmits((n) => n + 1) });
  }

  return (
    <section aria-labelledby="alege-pagini" className="section">
      <h2 id="alege-pagini">Alege paginile de verificat</h2>
      <p>
        Am găsit <strong>{discovery.pages.length}</strong>{' '}
        {discovery.pages.length === 1 ? 'pagină' : 'pagini'} pe{' '}
        <span className="url">{discovery.scope}</span> și am propus <strong>{proposedCount}</strong>
        : pagina de start, paginile esențiale (contact, accesibilitate), câte una din fiecare
        secțiune a site-ului și câteva alese la întâmplare. Poți modifica lista; cel mult{' '}
        {AUDIT_MAX_PAGES} de pagini.
      </p>
      {discovery.robots.blocked > 0 && (
        <p className="notice notice--info">
          Fișierul robots.txt al site-ului cere programelor automate să nu viziteze{' '}
          {discovery.robots.blocked === 1 ? 'o pagină' : `${discovery.robots.blocked} pagini`} din
          listă. Nu le-am propus; sunt marcate și le poți bifa doar tu, conștient (ex. dacă
          administrezi site-ul sau ai acordul lui). Alegerea apare în raport.
        </p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="page-selection">
        <div ref={errorRef} tabIndex={-1}>
          {localError && (
            <div className="notice notice--error" role="alert">
              <p>{localError}</p>
            </div>
          )}
          {select.error && (
            <ErrorMessage error={select.error} title="Scanarea paginilor nu a pornit" />
          )}
        </div>

        {groups.map((group) => {
          const visible = group.pages.slice(0, Math.max(VISIBLE_PER_GROUP, countProposed(group)));
          const hidden = group.pages.slice(visible.length);
          return (
            <fieldset key={group.name} className="page-group">
              <legend>
                {group.name}{' '}
                <span className="muted">
                  ({group.pages.length} {group.pages.length === 1 ? 'pagină' : 'pagini'})
                </span>
              </legend>
              <PageCheckboxes pages={visible} checked={checked} onToggle={toggle} />
              {hidden.length > 0 && (
                <details className="page-group__more">
                  <summary>
                    Arată încă {hidden.length} {hidden.length === 1 ? 'pagină' : 'pagini'}
                  </summary>
                  <PageCheckboxes pages={hidden} checked={checked} onToggle={toggle} />
                </details>
              )}
            </fieldset>
          );
        })}

        {manual.length > 0 && (
          <fieldset className="page-group">
            <legend>Adăugate de tine</legend>
            <ul className="page-list">
              {manual.map((url) => (
                <li key={url} className="field field--checkbox">
                  <input
                    id={`manual-${url}`}
                    type="checkbox"
                    checked
                    onChange={() => setManual(manual.filter((m) => m !== url))}
                  />
                  <label htmlFor={`manual-${url}`}>
                    <span className="url">{shortPath(url)}</span>{' '}
                    <span className="tag tag--muted">{SELECTION_REASON_LABELS.manual}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <div className="page-selection__add">
          <TextField
            label="Adaugă o pagină care lipsește (opțional)"
            hint={`Adresa completă, de pe ${discovery.scope}`}
            name="pagina-manuala"
            type="url"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (manualInput.trim()) addManual();
              }
            }}
            error={manualError}
          />
          <button
            type="button"
            className="button-secondary"
            onClick={addManual}
            disabled={!manualInput.trim()}
          >
            Adaugă pagina
          </button>
        </div>

        <p role="status" className="page-selection__count">
          {chosenCount === 1 ? '1 pagină aleasă' : `${chosenCount} pagini alese`} (cel mult{' '}
          {AUDIT_MAX_PAGES})
        </p>
        <button type="submit" disabled={select.isPending}>
          {select.isPending ? 'Se pornește...' : `Scanează paginile alese (${chosenCount})`}
        </button>
      </form>
    </section>
  );
}

function countProposed(group: PageGroup): number {
  return group.pages.filter((p) => p.proposed).length;
}

function PageCheckboxes({
  pages,
  checked,
  onToggle,
}: {
  pages: DiscoveredPage[];
  checked: Set<string>;
  onToggle: (url: string, on: boolean) => void;
}) {
  return (
    <ul className="page-list">
      {pages.map((page) => {
        const id = `pagina-${page.url}`;
        return (
          <li key={page.url} className="field field--checkbox">
            <input
              id={id}
              type="checkbox"
              name="pagini"
              value={page.url}
              checked={checked.has(page.url)}
              onChange={(e) => onToggle(page.url, e.target.checked)}
            />
            <label htmlFor={id}>
              {page.label} <span className="url muted">{shortPath(page.url)}</span>
              {page.proposed && (
                <>
                  {' '}
                  <span className="tag">
                    Propusă: {page.reasons.map((r) => SELECTION_REASON_LABELS[r]).join(', ')}
                  </span>
                </>
              )}
              {page.robotsBlocked && (
                <>
                  {' '}
                  <span className="tag tag--muted">robots.txt cere să nu fie vizitată</span>
                </>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
