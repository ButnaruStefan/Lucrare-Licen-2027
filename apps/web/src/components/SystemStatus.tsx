/**
 * Starea sistemului (API + baza de date), afisata discret in subsolul fiecarei pagini.
 * Daca serverul sau baza de date nu raspund, utilizatorul afla imediat de ce nu merge nimic.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchReadiness } from '../api/health';

export function SystemStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchReadiness(signal),
    refetchInterval: 30_000,
  });

  let text = 'Se verifică starea sistemului...';
  let tone = 'muted';
  if (isError) {
    text = 'Serverul nu răspunde. Pornește-l cu npm run dev:api.';
    tone = 'error';
  } else if (!isPending && data) {
    const dbOk = data.checks.database === 'ok';
    text = dbOk
      ? 'Sistem funcțional: server și bază de date conectate.'
      : 'Baza de date nu răspunde.';
    tone = dbOk ? 'ok' : 'error';
  }

  return (
    <p className={`system-status system-status--${tone}`} role="status">
      {text}
    </p>
  );
}
