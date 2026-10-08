import {
  zGetApiAdminStatsResponse,
  zGetApiInternalCorporationsByCorporationIdWalletResponse,
  zGetApiInternalCorporationsByCorporationIdWalletTransactionsResponse,
  zGetApiInternalNpcsByNpcIdWalletResponse,
  zGetApiInternalNpcsByNpcIdWalletTransactionsResponse,
  zGetApiInternalPlayersByPlayerIdWalletResponse,
  zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
  zGetApiInternalPoliticsByEntityIdSettingsResponse,
  zGetApiInternalPoliticsByEntityIdWalletResponse,
  zGetApiInternalPoliticsByEntityIdWalletTransactionsResponse,
} from '@dyingstar-admin/contracts/economie';
import type { ServiceTokenSource } from '../auth/serviceToken';
import { createUpstream, type Query } from './upstream';

export interface EconomieClientOptions {
  /** `economie`'s base URL, without `/api` (e.g. `http://service-economie:3000`). */
  baseUrl: string;
  timeoutMs: number;
  /** Tokens of `svc-admin`, for its internal API (ADR 0023 › Economie). Unset, wallets are off. */
  serviceToken?: ServiceTokenSource | undefined;
}

/** Whose wallet: `economie` keeps players, NPCs, corporations and political entities apart. */
export type WalletHolder = 'players' | 'npcs' | 'corporations' | 'politics';

const WALLET = {
  players: {
    accounts: zGetApiInternalPlayersByPlayerIdWalletResponse,
    ledger: zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
  },
  npcs: {
    accounts: zGetApiInternalNpcsByNpcIdWalletResponse,
    ledger: zGetApiInternalNpcsByNpcIdWalletTransactionsResponse,
  },
  corporations: {
    accounts: zGetApiInternalCorporationsByCorporationIdWalletResponse,
    ledger: zGetApiInternalCorporationsByCorporationIdWalletTransactionsResponse,
  },
  politics: {
    accounts: zGetApiInternalPoliticsByEntityIdWalletResponse,
    ledger: zGetApiInternalPoliticsByEntityIdWalletTransactionsResponse,
  },
} as const;

/**
 * HTTP client for `economie` (contract pinned in `@dyingstar-admin/contracts/economie`), as its
 * README splits it (ADR 0023 › Economie): the Admin dashboard with the user's token, the wallets
 * of the Interne API as `svc-admin`.
 */
export function createEconomieClient({ baseUrl, timeoutMs, serviceToken }: EconomieClientOptions) {
  const { get, internal, hasServiceToken } = createUpstream({
    name: 'Economie',
    baseUrl,
    timeoutMs,
    serviceToken,
  });
  const walletPath = (holder: WalletHolder, id: string) =>
    `/${holder}/${encodeURIComponent(id)}/wallet`;

  return {
    /** Money supply, volume, taxes, richest holders and a daily series (`moderator`+). */
    stats: (token: string | undefined, query: Query) =>
      get(token, '/admin/stats', zGetApiAdminStatsResponse, query),
    /** A holder's accounts, one per currency. */
    wallet: (holder: WalletHolder, id: string) =>
      internal('GET', walletPath(holder, id), WALLET[holder].accounts),
    /** A holder's ledger, newest first. */
    ledger: (holder: WalletHolder, id: string, query: Query) =>
      internal('GET', `${walletPath(holder, id)}/transactions`, WALLET[holder].ledger, { query }),
    /** A political entity's tax rates and minting policy. */
    politicalSettings: (id: string) =>
      internal(
        'GET',
        `/politics/${encodeURIComponent(id)}/settings`,
        zGetApiInternalPoliticsByEntityIdSettingsResponse,
      ),
    /** Whether the wallets are configured (`svc-admin`'s secret). */
    readsWallets: hasServiceToken,
  };
}

export type EconomieClient = ReturnType<typeof createEconomieClient>;
