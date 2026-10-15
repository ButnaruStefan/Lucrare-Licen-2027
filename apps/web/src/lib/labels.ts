/**
 * Textele in romana afisate pentru valorile tehnice (stari, categorii, gravitate) si
 * formatarea datelor calendaristice. Un singur loc pentru toate etichetele interfetei.
 */
import type { Impact, ResultCategory, ScanStatus, WcagProfile } from '@ro-a11y/shared';

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  queued: 'În așteptare',
  running: 'În curs',
  completed: 'Finalizată',
  failed: 'Eșuată',
};

export const CATEGORY_LABELS: Record<ResultCategory, string> = {
  violation: 'Probleme detectate',
  incomplete: 'De verificat manual',
  pass: 'Reguli trecute',
  inapplicable: 'Nu se aplică',
};

export const CATEGORY_DESCRIPTIONS: Record<ResultCategory, string> = {
  violation: 'Reguli la care motorul automat a găsit probleme.',
  incomplete: 'Cazuri pe care motorul nu le poate decide singur: e nevoie de verificare umană.',
  pass: 'Verificări automate trecute (nu înseamnă conformitate generală).',
  inapplicable: 'Reguli care nu se aplică acestei pagini.',
};

export const IMPACT_LABELS: Record<Impact, string> = {
  critical: 'Critică',
  serious: 'Gravă',
  moderate: 'Moderată',
  minor: 'Minoră',
};

export const WCAG_PROFILE_LABELS: Record<WcagProfile, string> = {
  WCAG_2_2_AA: 'WCAG 2.2, nivel AA',
  WCAG_2_1_AA: 'WCAG 2.1, nivel AA',
};

const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

/** Durata dintre doua momente, ex. "4 s". */
export function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '—';
  const seconds = Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  return seconds < 60 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`;
}
