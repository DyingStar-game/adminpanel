/**
 * Live refresh rates (ADR 0009). Persistence has no push for the admin, so views poll the BFF,
 * which coalesces identical reads of several viewers.
 */
export const LIVE_INTERVALS = {
  /** The entity on screen: inspector, object page, orbit centre. */
  entity: 5000,
  /** The visible table page and expanded tree levels. */
  list: 5000,
  /** Child counts cost one full scan per known type on the service. */
  counts: 15000,
} as const;

export type LiveKind = keyof typeof LIVE_INTERVALS;

/** How long a changed field or row stays highlighted. */
export const CHANGE_HIGHLIGHT_MS = 1500;
