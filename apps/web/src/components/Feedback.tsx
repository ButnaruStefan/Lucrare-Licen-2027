/**
 * Mesajele de stare folosite in toate paginile: se incarca, eroare, lista goala.
 * Starea e transmisa prin text (nu doar prin culoare), iar erorile au role="alert",
 * ca sa fie anuntate imediat de cititorul de ecran.
 */
import type { ReactNode } from 'react';
import { ApiRequestError } from '../api/client';

export function Loading({ label = 'Se încarcă...' }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}
    </p>
  );
}

export function ErrorMessage({ error, title }: { error: unknown; title?: string }) {
  const message =
    error instanceof ApiRequestError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'A apărut o eroare neașteptată.';
  return (
    <div className="notice notice--error" role="alert">
      {title && <p className="notice__title">{title}</p>}
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
