/**
 * Camp de formular accesibil: eticheta legata de camp, text de ajutor, avertisment si mesaj de
 * eroare legate prin aria-describedby, iar campul gresit marcat cu aria-invalid.
 *
 * - `warning`: informatie care NU blocheaza trimiterea (ex. "numele mai e folosit");
 * - `error`: problema care trebuie corectata;
 * - `extra`: continut afisat sub camp (ex. o legatura spre proiectul existent).
 */
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  warning?: string;
  error?: string;
  extra?: ReactNode;
}

export function TextField({ label, hint, warning, error, extra, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-ajutor` : undefined;
  const warningId = warning ? `${id}-avertisment` : undefined;
  const errorId = error ? `${id}-eroare` : undefined;
  const describedBy = [hintId, warningId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
      {warning && (
        <p id={warningId} className="field__warning">
          <span aria-hidden="true">ℹ </span>
          {warning}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
      {extra}
    </div>
  );
}
