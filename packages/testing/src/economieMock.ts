import { http, HttpResponse } from 'msw';
import type {
  Account,
  CorporationSettingsAsServed,
  PoliticalMember,
  PoliticalSettings,
  PoliticalTaxDebt,
  Transaction,
} from '@dyingstar-admin/contracts/economie';
import { organisationIds, socialIds } from './socialMock';

/** Base URL used by tests for the mocked `economie` service (ADR 0024). */
export const ECONOMIE_URL = 'http://economie.test';

export interface EconomieDataset {
  accounts: Account[];
  transactions: Transaction[];
  corporationSettings: CorporationSettingsAsServed[];
  politicalSettings: PoliticalSettings[];
  /** `economie`'s own mirror of political members, the income tax's base. */
  politicalMembers: PoliticalMember[];
  taxDebts: PoliticalTaxDebt[];
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
    // The holding is attached to the commune: the commune's corporate tax applies to it.
    corporationSettings: [
      {
        corporationId: organisationIds.mining,
        taxRateBps: 250,
        allowDonations: true,
        politicalEntityId: organisationIds.commune,
        updatedAt: at(10),
      },
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
    politicalMembers: [
      {
        entityId: organisationIds.commune,
        playerId: socialIds.griefer,
        holderType: 'player',
        role: 'member',
        joinedAt: at(0),
      },
    ],
    taxDebts: [],
  };
}

/** Transaction types counted as taxable income (`taxation.service.ts`). */
const INCOME_TYPES: readonly Transaction['type'][] = ['salary', 'prime', 'mission_reward'];

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
  /** Writes received (method, path, body), oldest first. */
  writes: { call: string; body: unknown }[];
}

/**
 * MSW handlers reproducing `economie`'s Admin dashboard and the parts of its Interne API the
 * panel uses (`stats.service.ts`, `internal.routes.ts`, `politics.service.ts`,
 * `corporations.service.ts`, `taxation.service.ts`): an unknown holder has no account (empty
 * list); settings rows are created with the defaults on first read or write, so an unknown id is
 * never a 404; a settings change needs at least one field; each tax assessment books new debts.
 * Service roles are not checked here.
 */
export function createEconomieMock(
  data: EconomieDataset = createEconomieDataset(),
  baseUrl: string = ECONOMIE_URL,
): EconomieMock {
  const tokens: (string | null)[] = [];
  const writes: { call: string; body: unknown }[] = [];
  const seen = (request: Request) => tokens.push(request.headers.get('Authorization'));
  const internal = `${baseUrl}/api/internal`;
  const now = () => new Date().toISOString();
  const badRequest = (message: string) =>
    HttpResponse.json({ error: 'VALIDATION_ERROR', message, status: 400 }, { status: 400 });
  /** Body of a write, recorded; `null` when it is not a JSON object. */
  const bodyOf = async (request: Request): Promise<Record<string, unknown> | null> => {
    const body: unknown = await request.json().catch(() => null);
    const { pathname } = new URL(request.url);
    writes.push({ call: `${request.method} ${pathname.replace(/^\/api/, '')}`, body });
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  };
  /** `routes/schemas.ts`: optional fields, at least one, each within its bounds. */
  const settingsPatch = (
    body: Record<string, unknown> | null,
    fields: Record<string, (value: unknown) => boolean>,
  ): Record<string, unknown> | string => {
    if (!body) return 'body: Expected object';
    const patch: Record<string, unknown> = {};
    for (const [key, valid] of Object.entries(fields)) {
      if (body[key] === undefined) continue;
      if (!valid(body[key])) return `${key}: Invalid value`;
      patch[key] = body[key];
    }
    return Object.keys(patch).length ? patch : 'body: At least one field is required';
  };
  const bps = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10_000;
  const bool = (v: unknown) => typeof v === 'boolean';
  const ceiling = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10_000_000_000_000;
  const uuid = (v: unknown) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const corporationSettingsOf = (id: string) => {
    let settings = data.corporationSettings.find((s) => s.corporationId === id);
    if (!settings) {
      settings = {
        corporationId: id,
        taxRateBps: 0,
        allowDonations: true,
        politicalEntityId: null,
        updatedAt: now(),
      };
      data.corporationSettings.push(settings);
    }
    return settings;
  };
  const politicalSettingsOf = (id: string) => {
    let settings = data.politicalSettings.find((s) => s.entityId === id);
    if (!settings) {
      settings = {
        entityId: id,
        corporateTaxBps: 0,
        incomeTaxBps: 0,
        allowMinting: false,
        mintCeiling: 0,
        lastAssessedAt: null,
        updatedAt: now(),
      };
      data.politicalSettings.push(settings);
    }
    return settings;
  };
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
    http.get(`${internal}/politics/:id/settings`, ({ request, params }) => {
      seen(request);
      return HttpResponse.json(politicalSettingsOf(String(params.id)));
    }),
    http.put(`${internal}/politics/:id/settings`, async ({ request, params }) => {
      seen(request);
      const patch = settingsPatch(await bodyOf(request), {
        corporateTaxBps: bps,
        incomeTaxBps: bps,
        allowMinting: bool,
        mintCeiling: ceiling,
      });
      if (typeof patch === 'string') return badRequest(patch);
      const settings = politicalSettingsOf(String(params.id));
      Object.assign(settings, patch, { updatedAt: now() });
      return HttpResponse.json(settings);
    }),
    // Corporate tax on the attached corporations' treasury balance, income tax on the mirrored
    // members' income since the previous assessment (none on the first one).
    http.post(`${internal}/politics/:id/taxes/assess`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const currency = typeof body?.currency === 'string' ? body.currency : 'credits';
      const entityId = String(params.id);
      const settings = politicalSettingsOf(entityId);
      const at = now();
      const since = settings.lastAssessedAt ?? at;
      const assessmentId = crypto.randomUUID();
      const balanceOf = (type: Account['holderType'], id: string) =>
        data.accounts.find(
          (a) => a.holderType === type && a.holderId === id && a.currency === currency,
        )?.balance ?? 0;
      const booked: PoliticalTaxDebt[] = [];
      const book = (
        debtorType: PoliticalTaxDebt['debtorType'],
        debtorId: string,
        base: number,
        rateBps: number,
        taxType: PoliticalTaxDebt['taxType'],
      ) => {
        const amount = Math.floor((base * rateBps) / 10_000);
        if (amount <= 0) return;
        booked.push({
          id: data.taxDebts.length + booked.length + 1,
          assessmentId,
          entityId,
          debtorType,
          debtorId,
          currency,
          amount,
          taxType,
          status: 'due',
          details: { base, rateBps },
          createdAt: at,
          paidAt: null,
        });
      };
      for (const c of data.corporationSettings.filter((c) => c.politicalEntityId === entityId)) {
        book(
          'corporation',
          c.corporationId,
          balanceOf('corporation', c.corporationId),
          settings.corporateTaxBps,
          'corporate_tax',
        );
      }
      for (const m of data.politicalMembers.filter((m) => m.entityId === entityId)) {
        const own = new Set(
          data.accounts
            .filter((a) => a.holderType === m.holderType && a.holderId === m.playerId)
            .map((a) => a.id),
        );
        const income = data.transactions
          .filter(
            (t) =>
              own.has(t.toAccountId ?? '') &&
              t.currency === currency &&
              t.createdAt > since &&
              INCOME_TYPES.includes(t.type),
          )
          .reduce((sum, t) => sum + t.amount, 0);
        book(m.holderType, m.playerId, income, settings.incomeTaxBps, 'income_tax');
      }
      data.taxDebts.push(...booked);
      Object.assign(settings, { lastAssessedAt: at, updatedAt: at });
      return HttpResponse.json({
        entityId,
        assessmentId,
        currency,
        since,
        corporateDebts: booked.filter((d) => d.taxType === 'corporate_tax').length,
        incomeDebts: booked.filter((d) => d.taxType === 'income_tax').length,
        booked: booked.length,
      });
    }),
    http.get(`${internal}/corporations/:id/settings`, ({ request, params }) => {
      seen(request);
      return HttpResponse.json(corporationSettingsOf(String(params.id)));
    }),
    http.put(`${internal}/corporations/:id/settings`, async ({ request, params }) => {
      seen(request);
      const patch = settingsPatch(await bodyOf(request), {
        taxRateBps: bps,
        allowDonations: bool,
      });
      if (typeof patch === 'string') return badRequest(patch);
      const settings = corporationSettingsOf(String(params.id));
      Object.assign(settings, patch, { updatedAt: now() });
      return HttpResponse.json(settings);
    }),
    // The fiscal home: any political entity id (`economie` does not ask `social`), or none.
    http.put(`${internal}/corporations/:id/affiliation`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const politicalEntityId = body?.politicalEntityId;
      if (
        politicalEntityId === undefined ||
        (politicalEntityId !== null && !uuid(politicalEntityId))
      ) {
        return badRequest('politicalEntityId: Invalid value');
      }
      const settings = corporationSettingsOf(String(params.id));
      Object.assign(settings, { politicalEntityId, updatedAt: now() });
      return HttpResponse.json(settings);
    }),
  ];

  return { handlers, data, tokens, writes };
}
