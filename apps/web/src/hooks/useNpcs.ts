import { useState } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { z } from 'zod';
import {
  zGetActivityActionsResponse,
  zGetNpcLogsResponse,
  zGetNpcResponse,
  zGetScheduleLegendResponse,
  zGetSettingsResponse,
  zGetTaskKindsResponse,
  zListEventsResponse,
  zListNpcTasksResponse,
  zListNpcsResponse,
  zListPatternsResponse,
  zListVillagesResponse,
  type LogLine,
  type Role,
} from '@dyingstar-admin/contracts/npc';
import { apiGet } from '@/lib/api';
import type { LiveKind } from '@/lib/live';
import { NPC_PAGE_SIZE } from '@/lib/npcSearch';
import { useLiveInterval } from './useLive';

/**
 * Reads of the NPCs section (ADR 0026), through `/api/npc`. What the runtime changes (the
 * switch's counts, the roster, an NPC, its tasks, its logs, the events) is polled (ADR 0009,
 * paused with the live switch): lists every 5 s, the NPC on screen and its logs every 3 s; the
 * catalogue (task kinds, legend) is read once, the schedules and villages when opened.
 */

const PATH = '/api/npc';
const enc = encodeURIComponent;
/** Query string of the given values, empty ones left out. */
const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.size ? `?${search}` : '';
};

function useLive<S extends z.ZodType>(
  key: unknown[],
  path: string,
  schema: S,
  { enabled = true, kind = 'list' }: { enabled?: boolean; kind?: LiveKind } = {},
) {
  const refetchInterval = useLiveInterval(kind, enabled);
  return useQuery({
    queryKey: ['npc', ...key],
    queryFn: () => apiGet(path, schema),
    placeholderData: keepPreviousData,
    refetchInterval,
    enabled,
  });
}

/** The global switch and the counts. */
export const useNpcSettings = () => useLive(['settings'], `${PATH}/settings`, zGetSettingsResponse);

export interface RosterFilters {
  village?: string | undefined;
  role?: Role | undefined;
  enabled?: 'true' | 'false' | undefined;
  online?: 'true' | 'false' | undefined;
  q?: string | undefined;
}

/** A page of the roster with its live status. */
export const useNpcRoster = (filters: RosterFilters, page: number) =>
  useLive(
    ['npcs', filters, page],
    `${PATH}/npcs${qs({ ...filters, limit: NPC_PAGE_SIZE, offset: (page - 1) * NPC_PAGE_SIZE })}`,
    zListNpcsResponse,
  );

/** One NPC: configuration, live status, routine, recent tasks, FSM state, workplace. */
export const useNpc = (id: string) =>
  useLive(['npc', id], `${PATH}/npcs/${enc(id)}`, zGetNpcResponse, { kind: 'npc' });

/** An NPC's tasks: open first, then the most recent finished. */
export const useNpcTasks = (id: string) =>
  useLive(['npc', id, 'tasks'], `${PATH}/npcs/${enc(id)}/tasks`, zListNpcTasksResponse);

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * An NPC's log lines, appended as they come: every 3 s the lines after the last one seen
 * (`since`), at `level` or above. Changing the level reads them again from the start; `clear`
 * empties the view and keeps going from the last line.
 */
export function useNpcLogs(id: string, level: LogLevel | undefined) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<LogLine[]>([]);
  // A new level (or NPC) starts over: the service filters by level.
  const key = `${id}|${level ?? ''}`;
  const [shownKey, setShownKey] = useState(key);
  if (key !== shownKey) {
    setShownKey(key);
    setLines([]);
  }
  const refetchInterval = useLiveInterval('npc');
  const query = useQuery({
    queryKey: ['npc', 'npc', id, 'logs', level ?? ''],
    // After the last line this query read (its own previous page); a level left is forgotten
    // at once (`gcTime: 0`), so coming back to it reads from the start.
    queryFn: ({ queryKey }) => {
      const previous = queryClient.getQueryData<z.infer<typeof zGetNpcLogsResponse>>(queryKey);
      return apiGet(
        `${PATH}/npcs/${enc(id)}/logs${qs({ since: previous?.lastSeq ?? 0, level })}`,
        zGetNpcLogsResponse,
      );
    },
    refetchInterval,
    gcTime: 0,
  });
  // A new page appends its lines (React's "adjust state while rendering" pattern).
  const page = query.data;
  const [appended, setAppended] = useState<typeof page>(undefined);
  if (page !== appended) {
    setAppended(page);
    if (page?.items.length) {
      const last = lines[lines.length - 1]?.seq ?? -1;
      setLines([...lines, ...page.items.filter((line) => line.seq > last)]);
    }
  }
  return { lines, error: query.error, isError: query.isError, clear: () => setLines([]) };
}

const EVENTS_PAGE = 50;

/**
 * Key events, newest first, by kind: an NPC's (`npcId`) or every one's with the service-wide
 * ones. `fetchNextPage` loads the older ones (`before` the last id).
 */
export function useNpcEvents(npcId: string | null, kind: string | undefined) {
  const refetchInterval = useLiveInterval('list');
  const base = npcId ? `${PATH}/npcs/${enc(npcId)}/events` : `${PATH}/events`;
  return useInfiniteQuery({
    queryKey: ['npc', 'events', npcId ?? '', kind ?? ''],
    queryFn: ({ pageParam }) =>
      apiGet(`${base}${qs({ kind, before: pageParam, limit: EVENTS_PAGE })}`, zListEventsResponse),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.items.length === EVENTS_PAGE
        ? String(last.items[last.items.length - 1]?.id ?? '')
        : undefined,
    refetchInterval,
  });
}

/** Task kinds, their parameters, the actions run by hand and their config fields (catalogue). */
export const useTaskKinds = () =>
  useQuery({
    queryKey: ['npc', 'task-kinds'],
    queryFn: () => apiGet(`${PATH}/task-kinds`, zGetTaskKindsResponse),
    staleTime: 5 * 60_000,
  });

/** What each grid letter means (catalogue). */
export const useScheduleLegend = () =>
  useQuery({
    queryKey: ['npc', 'legend'],
    queryFn: () => apiGet(`${PATH}/schedule/legend`, zGetScheduleLegendResponse),
    staleTime: 5 * 60_000,
  });

/** Shift patterns. */
export const usePatterns = () =>
  useQuery({
    queryKey: ['npc', 'patterns'],
    queryFn: () => apiGet(`${PATH}/schedule/patterns`, zListPatternsResponse),
  });

/** The activity → actions mapping (`always`: in every activity). */
export const useActivityActions = () =>
  useQuery({
    queryKey: ['npc', 'activity-actions'],
    queryFn: () => apiGet(`${PATH}/schedule/activity-actions`, zGetActivityActionsResponse),
  });

/** Mining villages with their NPCs, storekeepers and workplace; Factory villages. */
export const useNpcVillages = () =>
  useLive(['villages'], `${PATH}/villages`, zListVillagesResponse);
