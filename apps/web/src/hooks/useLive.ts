import { LIVE_INTERVALS, type LiveKind } from '@/lib/live';
import { usePreferences } from '@/stores/preferences';

/**
 * Polling interval for a kind of query, or `false` when live refresh is paused. TanStack Query
 * also stops polling while the tab is hidden (`refetchIntervalInBackground` is off).
 */
export function useLiveInterval(kind: LiveKind, enabled = true): number | false {
  const live = usePreferences((s) => s.live);
  return live && enabled ? LIVE_INTERVALS[kind] : false;
}
