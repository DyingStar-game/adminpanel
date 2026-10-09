import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import {
  zGetCommunityStatsResponse,
  zGetModerationLogResponse,
  zGetPlayerRecordResponse,
  zGetProfileResponse,
  zGetReportResponse,
  zListReportsResponse,
  zListSanctionsResponse,
  zSearchProfilesResponse,
  type EscalationLevel,
  type ProfileKind,
  type ReportStatus,
} from '@dyingstar-admin/contracts/social';
import { apiGet } from '@/lib/api';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';

/** `limit` / `offset` of a 1-based page. */
const pageParams = (page: number) =>
  new URLSearchParams({
    limit: String(MODERATION_PAGE_SIZE),
    offset: String((page - 1) * MODERATION_PAGE_SIZE),
  });

const withParams = (path: string, params: URLSearchParams) => `${path}?${params}`;

/** Community analytics of `social` (ADR 0024). */
export const useSocialStats = () =>
  useQuery({
    queryKey: ['social', 'stats'],
    queryFn: () => apiGet('/api/social/stats', zGetCommunityStatsResponse),
  });

/** Moderation audit log, newest first. */
export const useModerationLog = (page: number) =>
  useQuery({
    queryKey: ['social', 'log', page],
    queryFn: () =>
      apiGet(withParams('/api/social/log', pageParams(page)), zGetModerationLogResponse),
    placeholderData: keepPreviousData,
  });

export interface ReportsFilter {
  status?: ReportStatus | undefined;
  escalation?: EscalationLevel | undefined;
  targetPlayerId?: string | undefined;
}

/** Report queue, filtered. */
export const useReports = (filter: ReportsFilter, page: number) =>
  useQuery({
    queryKey: ['social', 'reports', filter, page],
    queryFn: () => {
      const params = pageParams(page);
      for (const [key, value] of Object.entries(filter)) if (value) params.set(key, value);
      return apiGet(withParams('/api/social/reports', params), zListReportsResponse);
    },
    placeholderData: keepPreviousData,
  });

/** One report, with the reporter's and target's names. */
export const useReport = (id: number | undefined) =>
  useQuery({
    queryKey: ['social', 'report', id],
    queryFn: () => apiGet(`/api/social/reports/${id}`, zGetReportResponse),
    enabled: id !== undefined,
  });

/** A player's moderation sheet: profile, sanctions, reports against them, reputation, activity. */
export const usePlayerRecord = (playerId: string) =>
  useQuery({
    queryKey: ['social', 'player', playerId],
    queryFn: () =>
      apiGet(`/api/social/players/${encodeURIComponent(playerId)}`, zGetPlayerRecordResponse),
  });

/** Sanctions, the active ones unless `ended`. */
export const useSanctions = (filter: { playerId?: string; ended: boolean }, page: number) =>
  useQuery({
    queryKey: ['social', 'sanctions', filter, page],
    queryFn: () => {
      const params = pageParams(page);
      params.set('active', filter.ended ? 'false' : 'true');
      if (filter.playerId) params.set('playerId', filter.playerId);
      return apiGet(withParams('/api/social/sanctions', params), zListSanctionsResponse);
    },
    placeholderData: keepPreviousData,
  });

/** Players and NPCs by display name, sorted by name (`social`'s profile search). */
export const useSocialPlayers = (
  filter: { search: string; kind?: ProfileKind | undefined },
  page: number,
) =>
  useQuery({
    queryKey: ['social', 'players', filter, page],
    queryFn: () => {
      const params = pageParams(page);
      params.set('search', filter.search);
      if (filter.kind) params.set('entityType', filter.kind);
      return apiGet(withParams('/api/social/players', params), zSearchProfilesResponse);
    },
    placeholderData: keepPreviousData,
  });

const profileQuery = (playerId: string) => ({
  queryKey: ['social', 'profile', playerId],
  queryFn: () =>
    apiGet(`/api/social/players/${encodeURIComponent(playerId)}/profile`, zGetProfileResponse),
});

/** A player's public profile: presence, corporations, political entities. */
export const usePlayerProfile = (playerId: string) => useQuery(profileQuery(playerId));

/**
 * Display names of players known by id only (the moderation log, stats): one profile each,
 * shared with the sheets' cache. Unknown or not loaded yet: absent from the map.
 */
export function usePlayerNames(playerIds: (string | null | undefined)[]) {
  const ids = [...new Set(playerIds.filter((id): id is string => !!id))];
  const results = useQueries({
    queries: ids.map((id) => ({ ...profileQuery(id), staleTime: 5 * 60_000, retry: false })),
  });
  const names = new Map<string, string>();
  results.forEach((result, i) => {
    const id = ids[i];
    if (id && result.data) names.set(id, result.data.displayName);
  });
  return names;
}
