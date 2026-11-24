/**
 * Sectiunea "Verificare manuala" de pe pagina unei scanari de accesibilitate: cele 6 verificari
 * pe care le face un om pe aceasta pagina (ce nu poate verifica scanarea automata).
 *
 * Pentru fiecare verificare:
 *   - de ce conteaza, pasii (din sursele W3C), cand trece, atentionarile;
 *   - ce contine pagina (numarat la scanare): imaginile, campurile, lista titlurilor;
 *   - criteriile WCAG 2.2 si sursele, cu legaturi;
 *   - formularul: rezultatul (Trece / Nu trece / Nu se aplica / Nu pot determina), cine a
 *     verificat (un singur nume pentru toata pagina, tinut minte in browser) si notele;
 *     rezultatul se poate si sterge.
 * O verificare pe care pagina nu o contine (fara imagini, fara campuri) apare "Nu se aplica
 * (automat)", dar poate fi completata oricum (ex. un formular care apare abia la clic).
 *
 * Accesibilitate: fiecare verificare e un <details>; rezultatul e un grup de butoane radio
 * (fieldset + legend); erorile sunt legate de campuri (aria-describedby, aria-invalid), iar
 * salvarea e anuntata de cititorul de ecran (role="status").
 */
import { useId, useState, type FormEvent } from 'react';
import type { ManualCheck, ManualResult, PageFacts, Scan, ScanManualChecks } from '@ro-a11y/shared';
import { ApiRequestError } from '../api/client';
import { useManualChecks, useSaveManualCheck } from '../api/queries';
import { ErrorMessage, Loading } from './Feedback';
import { formatDate } from '../lib/labels';
import {
  MANUAL_RESULT_OPTIONS,
  MANUAL_STATUS_LABELS,
  manualProgressLabel,
} from '../lib/manual-labels';

/** Numele celui care verifica, tinut minte in acest browser (aplicatia nu are conturi). */
const EVALUATOR_KEY = 'w4a.evaluator';

function readEvaluator(): string {
  try {
    return window.localStorage.getItem(EVALUATOR_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberEvaluator(name: string) {
  try {
    window.localStorage.setItem(EVALUATOR_KEY, name);
  } catch {
    // browserul nu permite salvarea: numele va trebui scris din nou
  }
}

export function ManualReviewPanel({ scan }: { scan: Scan }) {
  const manual = useManualChecks(scan.id, scan.status === 'completed');

  return (
    <section aria-labelledby="verificare-manuala" className="section manual-panel">
      <h2 id="verificare-manuala">Verificare manuală</h2>
      <p className="notice notice--info">
        Scanarea automată nu poate verifica totul: de exemplu, dacă textul unei imagini are sens sau
        dacă pagina se poate folosi doar cu tastatura. Aici le verifici tu, pe această pagină,
        urmând pașii din ghidurile W3C. Rezultatele nu se completează niciodată automat și nu
        înseamnă că pagina e conformă.
      </p>
      {manual.isPending && <Loading label="Se încarcă verificarea manuală..." />}
      {manual.isError && <ErrorMessage error={manual.error} />}
      {manual.data && <ManualReview scanId={scan.id} data={manual.data} />}
    </section>
  );
}

function ManualReview({ scanId, data }: { scanId: string; data: ScanManualChecks }) {
  // Un singur nume pentru toate verificarile de pe pagina (cine verifica acum)
  const [evaluator, setEvaluator] = useState(readEvaluator);
  return (
    <>
      <p className="manual-panel__progress">
        <strong>{manualProgressLabel(data.summary)}</strong>
        {data.summary.autoNotApplicable > 0 && (
          <span className="muted">
            {' '}
            · {data.summary.autoNotApplicable} nu se aplică pe această pagină (detectat automat)
          </span>
        )}
      </p>
      {!data.facts && (
        <p className="muted">
          Scanare mai veche: nu știm ce conține pagina, deci toate verificările rămân de făcut.
        </p>
      )}
      <ul className="manual-checks">
        {data.checks.map((check) => (
          <li key={check.id}>
            <ManualCheckItem
              scanId={scanId}
              check={check}
              facts={data.facts}
              evaluator={evaluator}
              onEvaluatorChange={setEvaluator}
            />
          </li>
        ))}
      </ul>
      <p className="muted manual-panel__version">Versiunea pașilor: {data.checksVersion}.</p>
    </>
  );
}

function statusClass(status: ManualCheck['status']): string {
  if (status === 'pass') return 'badge--manual-pass';
  if (status === 'fail') return 'badge--manual-fail';
  if (status === 'pending') return 'badge--manual-pending';
  return 'badge--manual-other';
}

interface EvaluatorProps {
  /** Cine verifica (comun tuturor verificarilor de pe pagina). */
  evaluator: string;
  onEvaluatorChange: (name: string) => void;
}

function ManualCheckItem({
  scanId,
  check,
  facts,
  evaluator,
  onEvaluatorChange,
}: {
  scanId: string;
  check: ManualCheck;
  facts: PageFacts | null;
} & EvaluatorProps) {
  return (
    <details className={`manual-check manual-check--${check.status}`}>
      <summary className="manual-check__summary">
        <span className={`badge ${statusClass(check.status)}`}>
          {MANUAL_STATUS_LABELS[check.status]}
        </span>
        <span className="manual-check__title">{check.title}</span>
        <span className="manual-check__criteria">
          WCAG {check.criteria.map((c) => c.number).join(', ')}
        </span>
      </summary>
      <div className="manual-check__body">
        <p>{check.why}</p>
        {check.autoNotApplicable && !check.evaluation && (
          <p className="notice notice--info">
            {check.autoNotApplicable} Dacă pe pagină apare totuși ceva după o acțiune (de exemplu,
            un formular care se deschide la clic), poți completa verificarea mai jos.
          </p>
        )}
        <PageFactsHint check={check} facts={facts} />

        <h3 className="manual-check__heading">Pașii</h3>
        <ol className="manual-check__steps">
          {check.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          <strong>Trece dacă:</strong> {check.passWhen}
        </p>
        {check.cautions.length > 0 && (
          <ul className="manual-check__cautions">
            {check.cautions.map((caution) => (
              <li key={caution}>{caution}</li>
            ))}
          </ul>
        )}

        <h3 className="manual-check__heading">Criteriile și sursele</h3>
        <ul className="manual-check__links">
          {check.criteria.map((c) => (
            <li key={c.number}>
              {c.understandingUrl ? (
                <a href={c.understandingUrl} target="_blank" rel="noopener noreferrer">
                  WCAG {c.number} {c.titleRo ?? c.titleEn} ({c.titleEn})
                  <span className="visually-hidden"> (se deschide într-o filă nouă)</span>
                </a>
              ) : (
                `WCAG ${c.number} ${c.titleRo ?? c.titleEn}`
              )}
              {c.level && <span className="muted">, nivel {c.level}</span>}
            </li>
          ))}
          {check.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
                <span className="visually-hidden"> (se deschide într-o filă nouă)</span>
              </a>
            </li>
          ))}
        </ul>

        <EvaluationForm
          scanId={scanId}
          check={check}
          evaluator={evaluator}
          onEvaluatorChange={onEvaluatorChange}
        />
      </div>
    </details>
  );
}

/** Ce contine pagina, relevant pentru verificare (numarat la scanare). */
function PageFactsHint({ check, facts }: { check: ManualCheck; facts: PageFacts | null }) {
  if (!facts) return null;
  if (check.id === 'text-alternativ' && facts.images > 0) {
    return (
      <p className="manual-check__facts">
        Pe această pagină: {facts.images} {facts.images === 1 ? 'imagine' : 'imagini'}.
      </p>
    );
  }
  if (check.id === 'erori-formulare' && facts.formFields > 0) {
    return (
      <p className="manual-check__facts">
        Pe această pagină: {facts.forms} {facts.forms === 1 ? 'formular' : 'formulare'},{' '}
        {facts.formFields} {facts.formFields === 1 ? 'câmp' : 'câmpuri'} de completat.
      </p>
    );
  }
  if (check.id !== 'titluri') return null;
  if (facts.headings.length === 0) {
    return (
      <p className="manual-check__facts">
        Nu am găsit niciun titlu în codul paginii (h1–h6). Dacă pagina are texte care arată ca niște
        titluri, ele nu sunt marcate ca titluri.
      </p>
    );
  }
  return (
    <>
      <h3 className="manual-check__heading">Titlurile găsite la scanare</h3>
      <ol className="manual-check__headings">
        {facts.headings.map((h, i) => (
          <li key={i} style={{ marginLeft: `${(h.level - 1) * 1.25}rem` }}>
            <span className="manual-check__level">h{h.level}</span> {h.text || <em>(titlu gol)</em>}
            {h.hidden && <span className="muted"> (ascuns)</span>}
          </li>
        ))}
      </ol>
      {facts.headingsTruncated && (
        <p className="muted">Pagina are mai multe titluri; am păstrat primele 100.</p>
      )}
    </>
  );
}

function EvaluationForm({
  scanId,
  check,
  evaluator,
  onEvaluatorChange,
}: { scanId: string; check: ManualCheck } & EvaluatorProps) {
  const id = useId();
  const save = useSaveManualCheck(scanId);
  const [result, setResult] = useState<ManualResult | undefined>(check.evaluation?.result);
  const [notes, setNotes] = useState(check.evaluation?.notes ?? '');
  const [message, setMessage] = useState('');

  const fieldErrors = save.error instanceof ApiRequestError ? save.error.details : [];
  const errorOf = (field: string) => fieldErrors.find((e) => e.field === field)?.message;
  const resultError = errorOf('result');
  const evaluatorError = errorOf('evaluator');
  const notesError = errorOf('notes');
  const otherError = save.error && fieldErrors.length === 0 ? save.error : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!result) {
      setMessage('Alege un rezultat.');
      return;
    }
    save.mutate(
      { checkId: check.id, input: { result, evaluator, notes } },
      {
        onSuccess: () => {
          rememberEvaluator(evaluator.trim());
          setMessage('Rezultatul a fost salvat.');
        },
      },
    );
  }

  function reset() {
    setMessage('');
    save.mutate(
      { checkId: check.id, input: null },
      {
        onSuccess: () => {
          setResult(undefined);
          setNotes('');
          setMessage('Rezultatul a fost șters: verificarea e din nou de făcut.');
        },
      },
    );
  }

  const missingResult = message === 'Alege un rezultat.';

  return (
    <form className="manual-check__form" onSubmit={submit} noValidate>
      <h3 className="manual-check__heading">Rezultatul tău</h3>
      {check.evaluation && (
        <p className="muted">
          Salvat de {check.evaluation.evaluator}, pe {formatDate(check.evaluation.updatedAt)}.
        </p>
      )}
      <fieldset
        className="question"
        aria-describedby={resultError || missingResult ? `${id}-eroare-rezultat` : undefined}
      >
        <legend className="question__text">Ce ai constatat?</legend>
        {(resultError || missingResult) && (
          <p id={`${id}-eroare-rezultat`} className="field__error">
            <span aria-hidden="true">⚠ </span>
            {resultError ?? 'Alege un rezultat.'}
          </p>
        )}
        <div className="question__options">
          {MANUAL_RESULT_OPTIONS.map((option) => {
            const optionId = `${id}-${option.value}`;
            return (
              <div key={option.value} className="field--radio">
                <input
                  id={optionId}
                  type="radio"
                  name={`${id}-rezultat`}
                  value={option.value}
                  checked={result === option.value}
                  onChange={() => setResult(option.value)}
                  aria-describedby={`${optionId}-ajutor`}
                  aria-invalid={resultError || missingResult ? true : undefined}
                />
                <label htmlFor={optionId}>{option.label}</label>
                <p id={`${optionId}-ajutor`} className="field__hint question__option-help">
                  {option.help}
                </p>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={`${id}-evaluator`}>Cine a verificat</label>
        <input
          id={`${id}-evaluator`}
          type="text"
          autoComplete="name"
          value={evaluator}
          onChange={(e) => onEvaluatorChange(e.target.value)}
          aria-invalid={evaluatorError ? true : undefined}
          aria-describedby={evaluatorError ? `${id}-eroare-evaluator` : undefined}
        />
        {evaluatorError && (
          <p id={`${id}-eroare-evaluator`} className="field__error">
            <span aria-hidden="true">⚠ </span>
            {evaluatorError}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${id}-note`}>Note</label>
        <p id={`${id}-note-ajutor`} className="field__hint">
          Ce ai observat (obligatoriu la „Nu trece”): unde e problema, ce se întâmplă.
        </p>
        <textarea
          id={`${id}-note`}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-invalid={notesError ? true : undefined}
          aria-describedby={[`${id}-note-ajutor`, notesError ? `${id}-eroare-note` : null]
            .filter(Boolean)
            .join(' ')}
        />
        {notesError && (
          <p id={`${id}-eroare-note`} className="field__error">
            <span aria-hidden="true">⚠ </span>
            {notesError}
          </p>
        )}
      </div>

      {otherError && <ErrorMessage error={otherError} />}

      <div className="manual-check__actions">
        <button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Se salvează...' : 'Salvează rezultatul'}
        </button>
        {check.evaluation && (
          <button
            type="button"
            className="button-secondary"
            onClick={reset}
            disabled={save.isPending}
          >
            Șterge rezultatul
          </button>
        )}
      </div>
      <p role="status" className="manual-check__message">
        {message && !missingResult ? message : ''}
      </p>
    </form>
  );
}
