import {
  zCorporationSettingsAsServed,
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
  zMovementResult,
  zPostApiInternalPoliticsByEntityIdTaxesAssessResponse,
  zPutApiInternalPoliticsByEntityIdSettingsResponse,
  type CorporationSettingsChange,
  type PanelMint,
  type PanelMovement,
  type PoliticalSettingsChange,
} from '@dyingstar-admin/contracts/economie';
import type { WalletHolder } from '@dyingstar-admin/schemas';
import type { ServiceTokenSource } from '../auth/serviceToken';
import { createUpstream, type Query } from './upstream';

export interface EconomieClientOptions {
  /** `economie`'s base URL, without `/api` (e.g. `http://service-economie:3000`). */
  baseUrl: string;
  timeoutMs: number;
  /** Tokens of `svc-admin`, for its internal API (ADR 0023 › Economie). Unset, wallets are off. */
  serviceToken?: ServiceTokenSource | undefined;
}

export type { WalletHolder };

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
    /** Changes a political entity's tax rates or minting policy (fields given only). */
    updatePoliticalSettings: (id: string, body: PoliticalSettingsChange) =>
      internal(
        'PUT',
        `/politics/${encodeURIComponent(id)}/settings`,
        zPutApiInternalPoliticsByEntityIdSettingsResponse,
        { body },
      ),
    /** Books the tax debts of an entity's taxpayers, in credits; each call books new ones. */
    assessTaxes: (id: string) =>
      internal(
        'POST',
        `/politics/${encodeURIComponent(id)}/taxes/assess`,
        zPostApiInternalPoliticsByEntityIdTaxesAssessResponse,
        { body: { currency: 'credits' } },
      ),
    /** A corporation's internal tax on donations, donation policy and fiscal home. */
    corporationSettings: (id: string) =>
      internal(
        'GET',
        `/corporations/${encodeURIComponent(id)}/settings`,
        zCorporationSettingsAsServed,
      ),
    /** Changes its internal tax or donation policy (fields given only). */
    updateCorporationSettings: (id: string, body: CorporationSettingsChange) =>
      internal(
        'PUT',
        `/corporations/${encodeURIComponent(id)}/settings`,
        zCorporationSettingsAsServed,
        {
          body,
        },
      ),
    /** Attaches it to a political entity for the corporate tax, or detaches it (`null`). */
    setCorporationAffiliation: (id: string, politicalEntityId: string | null) =>
      internal(
        'PUT',
        `/corporations/${encodeURIComponent(id)}/affiliation`,
        zCorporationSettingsAsServed,
        { body: { politicalEntityId } },
      ),
    /**
     * Credits or debits a holder's wallet in credits (step O.3); its `externalId` makes a second
     * send a 409, a debit beyond the balance too.
     */
    move: (holder: WalletHolder, id: string, direction: 'credit' | 'debit', body: PanelMovement) =>
      internal('POST', `${walletPath(holder, id)}/${direction}`, zMovementResult, {
        body: { ...body, currency: 'credits' },
      }),
    /** Issues money into a political treasury, within its settings (no idempotency key). */
    mint: (id: string, body: PanelMint) =>
      internal('POST', `/politics/${encodeURIComponent(id)}/mint`, zMovementResult, {
        body: { ...body, currency: 'credits' },
      }),
    /** Whether the wallets are configured (`svc-admin`'s secret). */
    readsWallets: hasServiceToken,
  };
}

export type EconomieClient = ReturnType<typeof createEconomieClient>;
