/**
 * Componenta principala. Deocamdata arata doar starea sistemului (API + baza de date),
 * ca dovada ca frontendul, API-ul si PostgreSQL comunica intre ele.
 *
 * Accesibilitate: zona de stare are `aria-live="polite"`, deci un cititor de ecran anunta
 * schimbarea starii fara sa intrerupa utilizatorul. Starea e transmisa prin text, nu doar prin culoare.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReadyResponse } from '@ro-a11y/shared';
import { fetchReadiness } from './api/health';

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: ReadyResponse }
  | { kind: 'unreachable'; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const check = useCallback((signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    fetchReadiness(signal)
      .then((data) => setState({ kind: 'loaded', data }))
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setState({
          kind: 'unreachable',
          message: err instanceof Error ? err.message : 'Eroare necunoscută',
        });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    check(controller.signal);
    return () => controller.abort();
  }, [check]);

  return (
    <main className="page">
      <h1>RO-A11y Observatory</h1>
      <p className="lead">Platformă de audit al accesibilității web pentru site-uri românești.</p>

      <section aria-labelledby="status-title" className="card">
        <h2 id="status-title">Starea sistemului</h2>
        <div aria-live="polite">
          <StatusDetails state={state} />
        </div>
        <button type="button" onClick={() => check()} disabled={state.kind === 'loading'}>
          Verifică din nou
        </button>
      </section>
    </main>
  );
}

function StatusDetails({ state }: { state: State }) {
  if (state.kind === 'loading') return <p>Se verifică...</p>;

  if (state.kind === 'unreachable') {
    return (
      <p className="status status--error">
        API indisponibil: {state.message}. Pornește-l cu <code>npm run dev:api</code>.
      </p>
    );
  }

  const { data } = state;
  return (
    <dl className="status-list">
      <div>
        <dt>API</dt>
        <dd className="status status--ok">funcționează</dd>
      </div>
      <div>
        <dt>Bază de date</dt>
        <dd className={`status status--${data.checks.database === 'ok' ? 'ok' : 'error'}`}>
          {data.checks.database === 'ok' ? 'conectată' : 'nu răspunde'}
        </dd>
      </div>
    </dl>
  );
}
