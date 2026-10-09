import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import {
  zCorporationSettingsAsServed,
  zGetApiAdminStatsResponse,
  zGetApiInternalPlayersByPlayerIdWalletResponse,
  zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
  zGetApiInternalPoliticsByEntityIdSettingsResponse,
} from '@dyingstar-admin/contracts/economie';
import { zGetCorporationResponse } from '@dyingstar-admin/contracts/social';
import { apiGet } from '@/lib/api';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';

/** Whose wallet: `economie` keeps players, NPCs, corporations and political entities apart. */
export type WalletHolder = 'players' | 'npcs' | 'corporations' | 'politics';

const walletPath = (holder: WalletHolder, id: string) =>
  `/api/economie/wallets/${holder}/${encodeURIComponent(id)}`;

/** `economie`'s dashboard over the last `days` (ADR 0024 step O). */
export const useEconomyStats = (days: number, top = 10) =>
  useQuery({
    queryKey: ['economie', 'stats', days, top],
    queryFn: () => apiGet(`/api/economie/stats?days=${days}&top=${top}`, zGetApiAdminStatsResponse),
    placeholderData: keepPreviousData,
  });

/** A holder's accounts, one per currency. */
export const useWallet = (holder: WalletHolder, id: string, enabled = true) =>
  useQuery({
    queryKey: ['economie', 'wallet', holder, id],
    queryFn: () => apiGet(walletPath(holder, id), zGetApiInternalPlayersByPlayerIdWalletResponse),
    enabled,
  });

/** A holder's ledger, newest first, by pages. */
export const useLedger = (holder: WalletHolder, id: string, page: number, enabled = true) =>
  useQuery({
    queryKey: ['economie', 'ledger', holder, id, page],
    queryFn: () =>
      apiGet(
        `${walletPath(holder, id)}/transactions?limit=${MODERATION_PAGE_SIZE}&offset=${(page - 1) * MODERATION_PAGE_SIZE}`,
        zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });

/** A political entity's tax rates and minting policy. */
export const usePoliticalSettings = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['economie', 'political-settings', id],
    queryFn: () =>
      apiGet(
        `/api/economie/politics/${encodeURIComponent(id)}/settings`,
        zGetApiInternalPoliticsByEntityIdSettingsResponse,
      ),
    enabled,
  });

/** A corporation's internal tax on donations, donation policy and fiscal home. */
export const useCorporationSettings = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['economie', 'corporation-settings', id],
    queryFn: () =>
      apiGet(
        `/api/economie/corporations/${encodeURIComponent(id)}/settings`,
        zCorporationSettingsAsServed,
      ),
    enabled,
  });

/**
 * Names of corporations known by id only (`economie`'s rankings): one page each, shared with the
 * organisation pages' cache. Unknown or not loaded yet: absent from the map.
 */
export function useCorporationNames(ids: string[]) {
  const unique = [...new Set(ids)];
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['social', 'corporation', id],
      queryFn: () =>
        apiGet(`/api/social/corporations/${encodeURIComponent(id)}`, zGetCorporationResponse),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  const names = new Map<string, string>();
  results.forEach((result, i) => {
    const id = unique[i];
    if (id && result.data) names.set(id, result.data.name);
  });
  return names;
}
