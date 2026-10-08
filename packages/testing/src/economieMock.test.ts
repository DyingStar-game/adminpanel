import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { z } from 'zod';
import {
  zGetApiAdminStatsResponse,
  zGetApiInternalCorporationsByCorporationIdWalletResponse,
  zGetApiInternalPlayersByPlayerIdWalletResponse,
  zGetApiInternalPlayersByPlayerIdWalletTransactionsResponse,
  zGetApiInternalPoliticsByEntityIdSettingsResponse,
} from '@dyingstar-admin/contracts/economie';
import { createEconomieMock, ECONOMIE_URL } from './economieMock';
import { organisationIds, socialIds } from './socialMock';

const mock = createEconomieMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const read = async (path: string) => (await fetch(`${ECONOMIE_URL}/api${path}`)).json();

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
});
