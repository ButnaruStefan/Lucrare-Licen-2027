/**
 * Textele in romana pentru verificarea manuala: starea fiecarei verificari, rezultatele pe care
 * le poate alege omul (cu explicatia lor) si progresul pe o pagina.
 *
 * Folosite de `ManualReviewPanel` (pagina scanarii) si de pagina auditului.
 */
import type { ManualResult, ManualStatus, ManualSummary } from '@ro-a11y/shared';

export const MANUAL_STATUS_LABELS: Record<ManualStatus, string> = {
  pass: 'Trece',
  fail: 'Nu trece',
  not_applicable: 'Nu se aplică',
  cannot_determine: 'Nu pot determina',
  pending: 'De verificat',
  auto_not_applicable: 'Nu se aplică (automat)',
};

/** Rezultatele, in ordinea din formular, cu explicatia fiecaruia. */
export const MANUAL_RESULT_OPTIONS: Array<{ value: ManualResult; label: string; help: string }> = [
  { value: 'pass', label: 'Trece', help: 'Am urmat pașii și totul e în regulă.' },
  {
    value: 'fail',
    label: 'Nu trece',
    help: 'Am găsit cel puțin o problemă (descrie-o în note).',
  },
  {
    value: 'not_applicable',
    label: 'Nu se aplică',
    help: 'Pagina nu conține ce se verifică aici.',
  },
  {
    value: 'cannot_determine',
    label: 'Nu pot determina',
    help: 'Nu am putut testa (de exemplu, formularul ar trimite o cerere reală).',
  },
];

/** Cate verificari raman de facut pe pagina, in cuvinte (ex. "2 din 5 verificari facute"). */
export function manualProgressLabel(summary: ManualSummary): string {
  const applicable = summary.total - summary.autoNotApplicable;
  const done = `${summary.completed} din ${applicable} ${applicable === 1 ? 'verificare făcută' : 'verificări făcute'}`;
  const failed =
    summary.failed > 0 ? `, ${summary.failed} nu ${summary.failed === 1 ? 'trece' : 'trec'}` : '';
  return done + failed;
}
