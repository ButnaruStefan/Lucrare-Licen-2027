/**
 * Etichetele colorate pentru starea unei scanari si gravitatea unei probleme.
 * Culoarea doar insoteste textul: informatia e mereu scrisa (WCAG 1.4.1).
 */
import type { Impact, ScanStatus } from '@ro-a11y/shared';
import { IMPACT_LABELS, SCAN_STATUS_LABELS } from '../lib/labels';

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return <span className={`badge badge--status-${status}`}>{SCAN_STATUS_LABELS[status]}</span>;
}

export function ImpactBadge({ impact }: { impact: Impact | null }) {
  if (!impact) return null;
  return (
    <span className={`badge badge--impact-${impact}`}>
      <span className="visually-hidden">Gravitate: </span>
      {IMPACT_LABELS[impact]}
    </span>
  );
}
