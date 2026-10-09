import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { z } from 'zod';
import {
  zGetApiAdminStatsResponse,
  zGetApiInternalCorporationsByCorporationIdWalletResponse,
  zGetApiInternalPlayersByPlayerIdWalletResponse,
  zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
  zGetApiInternalCorporationsByCorporationIdSettingsResponse,
  zGetApiInternalPoliticsByEntityIdSettingsResponse,
  zPostApiInternalPoliticsByEntityIdTaxesAssessResponse,
  zPutApiInternalPoliticsByEntityIdSettingsResponse,
} from '@dyingstar-admin/contracts/economie';
import { createEconomieMock, ECONOMIE_URL } from './economieMock';
import { organisationIds, socialIds } from './socialMock';

const mock = createEconomieMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const read = async (path: string) => (await fetch(`${ECONOMIE_URL}/api${path}`)).json();
const send = (method: string, path: string, body: unknown) =>
  fetch(`${ECONOMIE_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('economie mock (ADR 0013)', () => {
  it('answers as the contract says', async () => {
    const checks: [string, z.ZodType][] = [
      ['/admin/stats?top=3', zGetApiAdminStatsResponse],
      [
        `/internal/players/${socialIds.reporter}/wallet`,
        zGetApiInternalPlayersByPlayerIdWalletResponse,
      ],
      [
        `/internal/players/${socialIds.reporter}/wallet/transactions`,
        zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
      ],
      [
        `/internal/corporations/${organisationIds.mining}/wallet`,
        zGetApiInternalCorporationsByCorporationIdWalletResponse,
      ],
      [
        `/internal/politics/${organisationIds.commune}/settings`,
        zGetApiInternalPoliticsByEntityIdSettingsResponse,
      ],
      [
        `/internal/corporations/${organisationIds.mining}/settings`,
        zGetApiInternalCorporationsByCorporationIdSettingsResponse,
      ],
    ];
    for (const [path, schema] of checks) {
      expect(schema.safeParse(await read(path)).error, path).toBeUndefined();
    }
  });

  it('sums the money supply and ranks the richest', async () => {
    expect(await read('/admin/stats')).toMatchObject({
      moneySupply: [{ currency: 'credits', total: 10_590, accounts: 4 }],
      richestPlayers: [{ holderId: socialIds.reporter, balance: 1_250 }, { balance: 40 }],
      richestCorporations: [{ holderId: organisationIds.mining }],
    });
  });

  it("lists a holder's ledger newest first, and nothing for an unknown holder", async () => {
    const ledger = await read(`/internal/players/${socialIds.reporter}/wallet/transactions`);
    expect(ledger).toMatchObject({
      total: 2,
      items: [{ type: 'transfer' }, { type: 'mission_reward' }],
    });
    expect(await read(`/internal/players/${socialIds.moderator}/wallet`)).toEqual({ accounts: [] });
  });

  it("creates an entity's settings with the defaults on first read", async () => {
    expect(await read(`/internal/politics/${organisationIds.country}/settings`)).toMatchObject({
      corporateTaxBps: 0,
      incomeTaxBps: 0,
      allowMinting: false,
      lastAssessedAt: null,
    });
  });

  it('changes settings field by field, refusing an empty or out-of-range change', async () => {
    const path = `/internal/politics/${organisationIds.country}/settings`;
    const changed = await send('PUT', path, { allowMinting: true, mintCeiling: 50_000 });
    expect(
      zPutApiInternalPoliticsByEntityIdSettingsResponse.safeParse(await changed.json()).data,
    ).toMatchObject({ allowMinting: true, mintCeiling: 50_000, corporateTaxBps: 0 });
    expect((await send('PUT', path, {})).status).toBe(400);
    expect((await send('PUT', path, { incomeTaxBps: 10_001 })).status).toBe(400);
    const corporation = `/internal/corporations/${organisationIds.logistics}`;
    expect(
      await (await send('PUT', `${corporation}/settings`, { taxRateBps: 100 })).json(),
    ).toMatchObject({ taxRateBps: 100, allowDonations: true, politicalEntityId: null });
    expect(
      await (
        await send('PUT', `${corporation}/affiliation`, {
          politicalEntityId: organisationIds.country,
        })
      ).json(),
    ).toMatchObject({ taxRateBps: 100, politicalEntityId: organisationIds.country });
    expect((await send('PUT', `${corporation}/affiliation`, {})).status).toBe(400);
  });

  it('books new debts at each assessment, on balances and on income since the previous one', async () => {
    // A fresh dataset, ahead of the shared one.
    const own = createEconomieMock();
    server.use(...own.handlers);
    const commune = () =>
      own.data.politicalSettings.find((s) => s.entityId === organisationIds.commune);
    const assess = async () =>
      zPostApiInternalPoliticsByEntityIdTaxesAssessResponse.parse(
        await (
          await send('POST', `/internal/politics/${organisationIds.commune}/taxes/assess`, {})
        ).json(),
      );
    try {
      // The holding's 9,000 at 5 %; the member's income predates the last assessment.
      const previous = commune()?.lastAssessedAt;
      const first = await assess();
      expect(first).toMatchObject({ since: previous, corporateDebts: 1, incomeDebts: 0 });
      expect(own.data.taxDebts).toMatchObject([{ debtorId: organisationIds.mining, amount: 450 }]);
      // Again: the same balance is taxed again, under a new assessment, from the first one on.
      const ranAt = commune()?.lastAssessedAt;
      const second = await assess();
      expect(second).toMatchObject({ since: ranAt, booked: 1 });
      expect(second.assessmentId).not.toBe(first.assessmentId);
      expect(own.data.taxDebts).toHaveLength(2);
    } finally {
      server.resetHandlers();
    }
  });
});
