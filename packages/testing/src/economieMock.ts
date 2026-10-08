import { http, HttpResponse } from 'msw';
import type { Account, PoliticalSettings, Transaction } from '@dyingstar-admin/contracts/economie';
import { organisationIds, socialIds } from './socialMock';

/** Base URL used by tests for the mocked `economie` service (ADR 0024). */
export const ECONOMIE_URL = 'http://economie.test';

export interface EconomieDataset {
  accounts: Account[];
  transactions: Transaction[];
  politicalSettings: PoliticalSettings[];
}

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 9, 8, 10, 0) + minutes * 60_000).toISOString();

const account = (
  id: string,
  holderType: Account['holderType'],
  holderId: string,
  balance: number,
): Account => ({
  id,
  holderType,
  holderId,
  currency: 'credits',
  balance,
  status: 'active',
  createdAt: at(0),
  updatedAt: at(0),
});

/** Account ids of the fixtures. */
export const accountIds = {
  reporter: 'ec0a7e1e-0000-4000-8000-0000000000a1',
  griefer: 'ec0a7e1e-0000-4000-8000-0000000000a2',
  mining: 'ec0a7e1e-0000-4000-8000-0000000000c1',
  commune: 'ec0a7e1e-0000-4000-8000-0000000000e1',
} as const;

/**
 * Wallets of the social fixtures' players and organisations (same ids): a salary, a transfer
 * taxed by `ECONOMY_TRANSFER_TAX_BPS`, a corporate tax paid to the commune.
 */
export function createEconomieDataset(): EconomieDataset {
  const transaction = (
    id: number,
    type: Transaction['type'],
    from: string | null,
    to: string | null,
    amount: number,
    createdAt: string,
    taxAmount = 0,
  ): Transaction => ({
    id,
    fromAccountId: from,
    toAccountId: to,
    type,
    currency: 'credits',
    amount,
    taxAmount,
    feeAmount: 0,
    externalId: null,
    reference: null,
    caller: type === 'salary' ? null : 'svc-game',
    details: taxAmount ? { taxTo: 'system' } : null,
    createdAt,
  });
  return {
    accounts: [
      account(accountIds.reporter, 'player', socialIds.reporter, 1_250),
      account(accountIds.griefer, 'player', socialIds.griefer, 40),
      account(accountIds.mining, 'corporation', organisationIds.mining, 9_000),
      account(accountIds.commune, 'political', organisationIds.commune, 300),
    ],
    transactions: [
      transaction(1, 'mission_reward', null, accountIds.reporter, 1_000, at(20)),
      transaction(2, 'salary', accountIds.mining, accountIds.griefer, 200, at(30)),
      transaction(3, 'transfer', accountIds.griefer, accountIds.reporter, 150, at(40), 10),
      transaction(4, 'tax', accountIds.mining, accountIds.commune, 300, at(50)),
    ],
    politicalSettings: [
      {
        entityId: organisationIds.commune,
        corporateTaxBps: 500,
        incomeTaxBps: 200,
        allowMinting: false,
        mintCeiling: 0,
        lastAssessedAt: at(45),
        updatedAt: at(45),
      },
    ],
  };
}

const HOLDER_TYPE = {
  players: 'player',
  npcs: 'npc',
  corporations: 'corporation',
  politics: 'political',
} as const;

export interface EconomieMock {
  handlers: ReturnType<typeof http.get>[];
  data: EconomieDataset;
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
}

/**
 * MSW handlers reproducing `economie`'s Admin dashboard and the Interne reads the panel uses
 * (`stats.service.ts`, `internal.routes.ts`): an unknown holder has no account (empty list), a
 * political entity's settings are created with the defaults on first read.
 */
export function createEconomieMock(
  data: EconomieDataset = createEconomieDataset(),
  baseUrl: string = ECONOMIE_URL,
): EconomieMock {
  const tokens: (string | null)[] = [];
  const seen = (request: Request) => tokens.push(request.headers.get('Authorization'));
  const page = <T>(items: T[], url: URL) => {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
  };
  const accountsOf = (holder: string, id: string) =>
    data.accounts.filter(
      (a) => a.holderType === HOLDER_TYPE[holder as keyof typeof HOLDER_TYPE] && a.holderId === id,
    );
  const totals = (rows: Transaction[]) => ({
    count: rows.length,
    volume: rows.reduce((sum, t) => sum + t.amount, 0),
    tax: rows.reduce((sum, t) => sum + t.taxAmount, 0),
    fee: rows.reduce((sum, t) => sum + t.feeAmount, 0),
  });
  const richest = (type: Account['holderType'], top: number) =>
    data.accounts
      .filter((a) => a.holderType === type)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, top)
      .map((a) => ({
        holderId: a.holderId,
        currency: a.currency,
        balance: a.balance,
        displayName: null,
      }));

  const handlers = [
    http.get(`${baseUrl}/api/admin/stats`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const top = Number(url.searchParams.get('top') ?? 10);
      const currencies = [...new Set(data.accounts.map((a) => a.currency))];
      const days = [...new Set(data.transactions.map((t) => t.createdAt.slice(0, 10)))].sort();
      return HttpResponse.json({
        moneySupply: currencies.map((currency) => {
          const held = data.accounts.filter((a) => a.currency === currency);
          return {
            currency,
            total: held.reduce((sum, a) => sum + a.balance, 0),
            accounts: held.length,
          };
        }),
        transactions: { total: totals(data.transactions), period: totals(data.transactions) },
        richestPlayers: richest('player', top),
        richestNpcs: richest('npc', top),
        richestCorporations: richest('corporation', top),
        series: days.map((date) => {
          const rows = data.transactions.filter((t) => t.createdAt.startsWith(date));
          const { count, volume, tax } = totals(rows);
          return { date, transactions: count, volume, tax };
        }),
      });
    }),
    http.get(`${baseUrl}/api/internal/:holder/:id/wallet`, ({ request, params }) => {
      seen(request);
      return HttpResponse.json({ accounts: accountsOf(String(params.holder), String(params.id)) });
    }),
    http.get(`${baseUrl}/api/internal/:holder/:id/wallet/transactions`, ({ request, params }) => {
      seen(request);
      const own = new Set(accountsOf(String(params.holder), String(params.id)).map((a) => a.id));
      const rows = data.transactions
        .filter((t) => own.has(t.fromAccountId ?? '') || own.has(t.toAccountId ?? ''))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return HttpResponse.json(page(rows, new URL(request.url)));
    }),
    http.get(`${baseUrl}/api/internal/politics/:id/settings`, ({ request, params }) => {
      seen(request);
      const id = String(params.id);
      let settings = data.politicalSettings.find((s) => s.entityId === id);
      if (!settings) {
        settings = {
          entityId: id,
          corporateTaxBps: 0,
          incomeTaxBps: 0,
          allowMinting: false,
          mintCeiling: 0,
          lastAssessedAt: null,
          updatedAt: new Date().toISOString(),
        };
        data.politicalSettings.push(settings);
      }
      return HttpResponse.json(settings);
    }),
  ];

  return { handlers, data, tokens };
}
