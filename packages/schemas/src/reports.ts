/** What a moderator may do on a report: a status (`PATCH`) or an escalation. */
export type ReportAction = 'reviewing' | 'resolved' | 'dismissed' | 'escalate';

/**
 * The panel's report workflow (ADR 0024 › Update 2026-10-08), stricter than `social`: an open
 * report is claimed first (`reviewing`), then confirmed, dismissed or escalated; escalating
 * sends it back to `open`, to be claimed at its new level. Closed reports allow nothing.
 */
export function reportActions(status: string): ReportAction[] {
  if (status === 'open') return ['reviewing'];
  if (status === 'reviewing') return ['resolved', 'dismissed', 'escalate'];
  return [];
}
