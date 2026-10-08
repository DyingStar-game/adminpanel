import { describe, expect, it } from 'vitest';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { createSocialClient } from '../clients/social';
import { fakeProvider, setup, signIn, tokens } from '../test/auth';
import { buildApp } from '../test/harness';

describe('economie routes (ADR 0024 step O, reading)', () => {
  it('lists economie and its wallets among the services', async () => {
    const res = await buildApp().request('/api/panel');
    expect(await res.json()).toMatchObject({
      services: ['persistence', 'social', 'social-management', 'economie', 'economie-wallets'],
    });
    const without = await buildApp({
      economie: undefined,
      social: createSocialClient({ baseUrl: 'http://social.test', timeoutMs: 1000 }),
    }).request('/api/panel');
    expect(await without.json()).toMatchObject({ services: ['persistence', 'social'] });
  });

  it('reads the dashboard with the user token, and wallets as svc-admin', async () => {
    const { request, economie } = buildApp();

    expect(await (await request('/api/economie/stats?top=5')).json()).toMatchObject({
      moneySupply: [{ currency: 'credits' }],
    });
    expect(
      await (await request(`/api/economie/wallets/players/${socialIds.reporter}`)).json(),
    ).toMatchObject({ accounts: [{ balance: 1_250 }] });
    expect(
      await (
        await request(
          `/api/economie/wallets/corporations/${organisationIds.mining}/transactions?limit=1`,
        )
      ).json(),
    ).toMatchObject({ limit: 1, total: 2 });
    expect(
      await (await request(`/api/economie/politics/${organisationIds.commune}/settings`)).json(),
    ).toMatchObject({ corporateTaxBps: 500 });
    // Without a session (tests), the dashboard went without a token; the wallets as svc-admin.
    expect(economie.tokens).toEqual([
      null,
      'Bearer svc-admin-token',
      'Bearer svc-admin-token',
      'Bearer svc-admin-token',
    ]);
  });

  it('refuses invalid holders and ids before calling economie', async () => {
    const { request, economie } = buildApp();

    expect((await request(`/api/economie/wallets/banks/${socialIds.reporter}`)).status).toBe(400);
    expect((await request('/api/economie/wallets/players/not-a-uuid')).status).toBe(400);
    expect((await request('/api/economie/stats?top=0')).status).toBe(400);
    expect(economie.tokens).toHaveLength(0);
  });

  it("opens wallets with economie's capability roles, the dashboard with a moderation role", async () => {
    const as = async (realmRoles: string[], clientRoles: string[]) => {
      const ctx = setup(
        fakeProvider(() => tokens({ realmRoles, clientRoles: { 'dyingstar-admin': clientRoles } })),
      );
      const { cookie } = await signIn(ctx);
      const status = async (path: string) => (await ctx.call(path, { cookie })).status;
      return {
        stats: await status('/api/economie/stats'),
        wallet: await status(`/api/economie/wallets/players/${socialIds.reporter}`),
        treasury: await status(`/api/economie/wallets/politics/${organisationIds.commune}`),
      };
    };

    expect(await as(['admin'], [])).toEqual({ stats: 200, wallet: 403, treasury: 403 });
    expect(await as([], ['economie:wallet:read'])).toEqual({
      stats: 403,
      wallet: 200,
      treasury: 403,
    });
    expect(await as([], ['economie:politics:read'])).toMatchObject({ treasury: 200 });
  });
});
