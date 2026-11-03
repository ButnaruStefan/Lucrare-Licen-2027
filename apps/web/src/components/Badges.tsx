/**
 * Etichetele colorate pentru starea unei scanari, a unui audit si gravitatea unei probleme.
 * Culoarea doar insoteste textul: informatia e mereu scrisa (WCAG 1.4.1).
 */
import type { AuditStatus, Impact, ScanStatus } from '@ro-a11y/shared';
import { AUDIT_STATUS_LABELS, IMPACT_LABELS, SCAN_STATUS_LABELS } from '../lib/labels';

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

/** Culoarea urmeaza starea scanarilor: in curs (albastru), gata (verde), esuat (rosu). */
const AUDIT_BADGE_CLASS: Record<AuditStatus, ScanStatus> = {
  discovery_queued: 'queued',
  discovering: 'running',
  awaiting_selection: 'queued',
  scanning: 'running',
  completed: 'completed',
  failed: 'failed',
};

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  return (
    <span className={`badge badge--status-${AUDIT_BADGE_CLASS[status]}`}>
      {AUDIT_STATUS_LABELS[status]}
    </span>
  );
}
