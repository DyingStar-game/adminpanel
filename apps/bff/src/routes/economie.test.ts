import { describe, expect, it } from 'vitest';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { createSocialClient } from '../clients/social';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { buildApp } from '../test/harness';

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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

describe('economie settings and assessments (step O.2, as svc-admin)', () => {
  const { commune, mining } = organisationIds;

  it("changes a political entity's settings and runs an assessment", async () => {
    const { request, economie } = buildApp();

    const changed = await request(`/api/economie/politics/${commune}/settings`, {
      method: 'PUT',
      ...json({ incomeTaxBps: 300, allowMinting: true, mintCeiling: 100_000 }),
    });
    expect(await changed.json()).toMatchObject({
      corporateTaxBps: 500,
      incomeTaxBps: 300,
      allowMinting: true,
      mintCeiling: 100_000,
    });
    const assessed = await request(`/api/economie/politics/${commune}/taxes/assess`, {
      method: 'POST',
    });
    expect(await assessed.json()).toMatchObject({
      entityId: commune,
      currency: 'credits',
      corporateDebts: 1,
      booked: 1,
    });
    expect(economie.writes.map((w) => w.call)).toEqual([
      `PUT /internal/politics/${commune}/settings`,
      `POST /internal/politics/${commune}/taxes/assess`,
    ]);
    expect(economie.writes[1]?.body).toEqual({ currency: 'credits' });
    expect(economie.tokens.every((t) => t === 'Bearer svc-admin-token')).toBe(true);
  });

  it("reads and changes a corporation's settings and fiscal home", async () => {
    const { request } = buildApp();
    const path = `/api/economie/corporations/${mining}`;

    expect(await (await request(`${path}/settings`)).json()).toMatchObject({
      taxRateBps: 250,
      allowDonations: true,
      politicalEntityId: commune,
    });
    expect(
      await (
        await request(`${path}/settings`, { method: 'PUT', ...json({ allowDonations: false }) })
      ).json(),
    ).toMatchObject({ taxRateBps: 250, allowDonations: false });
    expect(
      await (
        await request(`${path}/affiliation`, {
          method: 'PUT',
          ...json({ politicalEntityId: null }),
        })
      ).json(),
    ).toMatchObject({ politicalEntityId: null });
  });

  it('refuses empty, unknown or out-of-range changes before calling economie', async () => {
    const { request, economie } = buildApp();
    const put = (path: string, body: unknown) =>
      request(`/api/economie${path}`, { method: 'PUT', ...json(body) });

    expect((await put(`/politics/${commune}/settings`, {})).status).toBe(400);
    expect((await put(`/politics/${commune}/settings`, { corporateTaxBps: 10_001 })).status).toBe(
      400,
    );
    expect(
      (await put(`/politics/${commune}/settings`, { mintCeiling: 10_000_000_000_001 })).status,
    ).toBe(400);
    expect((await put(`/corporations/${mining}/settings`, { currency: 'gold' })).status).toBe(400);
    expect((await put(`/corporations/${mining}/affiliation`, {})).status).toBe(400);
    expect((await put('/corporations/not-a-uuid/settings', { taxRateBps: 1 })).status).toBe(400);
    expect(economie.writes).toHaveLength(0);
  });

  it("opens each action to economie's capability role, and records who acted", async () => {
    const as = async (clientRoles: string[]) => {
      const ctx = setup(
        fakeProvider(() =>
          tokens({ realmRoles: ['moderator'], clientRoles: { 'dyingstar-admin': clientRoles } }),
        ),
      );
      const { cookie } = await signIn(ctx);
      const send = async (method: string, path: string, body?: unknown) =>
        (
          await ctx.call(`/api/economie${path}`, {
            method,
            cookie,
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        ).status;
      return {
        statuses: {
          readCorporation: await send('GET', `/corporations/${mining}/settings`),
          corporation: await send('PUT', `/corporations/${mining}/settings`, { taxRateBps: 100 }),
          politics: await send('PUT', `/politics/${commune}/settings`, { incomeTaxBps: 100 }),
          assess: await send('POST', `/politics/${commune}/taxes/assess`),
        },
        writes: ctx.economie.writes.length,
        audited: ctx.audited,
      };
    };

    // A moderation role opens none of it.
    expect((await as([])).statuses).toEqual({
      readCorporation: 403,
      corporation: 403,
      politics: 403,
      assess: 403,
    });
    expect((await as(['economie:corporation:read'])).statuses).toMatchObject({
      readCorporation: 200,
      corporation: 403,
    });
    const corporation = await as(['economie:corporation:manage']);
    expect(corporation.statuses).toEqual({
      readCorporation: 200,
      corporation: 200,
      politics: 403,
      assess: 403,
    });
    expect(corporation.writes).toBe(1);
    expect((await as(['economie:politics:manage'])).statuses).toMatchObject({
      corporation: 403,
      politics: 200,
      assess: 200,
    });
    // Every write is recorded with its author, the refused ones too; reads are not.
    expect(corporation.audited).toEqual([
      expect.objectContaining({
        service: 'economie',
        user: 'dev-editor',
        userId: 'user-1',
        method: 'PUT',
        path: `/api/economie/corporations/${mining}/settings`,
        status: 200,
      }),
      expect.objectContaining({ path: `/api/economie/politics/${commune}/settings`, status: 403 }),
      expect.objectContaining({
        path: `/api/economie/politics/${commune}/taxes/assess`,
        status: 403,
      }),
    ]);
  });
});

describe('economie money movements (step O.3, as svc-admin)', () => {
  const { commune, mining } = organisationIds;
  const movement = (externalId: string, extra: object = {}) => ({
    amount: 500,
    type: 'deposit',
    reference: 'Lost cargo after a server crash',
    externalId,
    ...extra,
  });

  it('credits and debits wallets in credits, once per externalId', async () => {
    const { request, economie } = buildApp();
    const post = (path: string, body: unknown) =>
      request(`/api/economie${path}`, { method: 'POST', ...json(body) });

    const credited = await post(`/wallets/players/${socialIds.griefer}/credit`, movement('a'));
    expect(credited.status).toBe(201);
    expect(await credited.json()).toMatchObject({ toBalance: 540, transaction: { id: 5 } });
    expect((await post(`/wallets/players/${socialIds.griefer}/credit`, movement('a'))).status).toBe(
      409,
    );
    const debited = await post(
      `/wallets/corporations/${mining}/debit`,
      movement('b', { amount: 1_000, type: 'withdrawal' }),
    );
    expect(await debited.json()).toMatchObject({ fromBalance: 8_000 });
    expect(economie.writes[0]?.body).toEqual({ ...movement('a'), currency: 'credits' });
  });

  it('issues money where the settings allow it', async () => {
    const { request } = buildApp();
    const mint = () =>
      request(`/api/economie/politics/${commune}/mint`, {
        method: 'POST',
        ...json({ amount: 1_000, reason: 'Stimulus' }),
      });

    expect((await mint()).status).toBe(403);
    await request(`/api/economie/politics/${commune}/settings`, {
      method: 'PUT',
      ...json({ allowMinting: true }),
    });
    expect(await (await mint()).json()).toMatchObject({
      toBalance: 1_300,
      transaction: { type: 'issuance' },
    });
  });

  it('refuses movements without a reason, a key, or with a type economie keeps for itself', async () => {
    const { request, economie } = buildApp();
    const post = (path: string, body: unknown) =>
      request(`/api/economie${path}`, { method: 'POST', ...json(body) });
    const path = `/wallets/players/${socialIds.griefer}/credit`;

    expect((await post(path, movement('c', { reference: ' ' }))).status).toBe(400);
    expect((await post(path, { amount: 5, type: 'deposit', reference: 'x' })).status).toBe(400);
    expect((await post(path, movement('d', { type: 'issuance' }))).status).toBe(400);
    // The panel's split: money comes in as a deposit, goes out as a withdrawal, not the reverse.
    expect((await post(path, movement('h', { type: 'withdrawal' }))).status).toBe(400);
    expect((await post(`/wallets/players/${socialIds.griefer}/debit`, movement('i'))).status).toBe(
      400,
    );
    expect((await post(path, movement('e', { amount: 0 }))).status).toBe(400);
    expect((await post(path, movement('f', { currency: 'gold' }))).status).toBe(400);
    expect((await post(`/wallets/players/${socialIds.griefer}/refund`, movement('g'))).status).toBe(
      400,
    );
    expect((await post(`/politics/${commune}/mint`, { amount: 5 })).status).toBe(400);
    expect(economie.writes).toHaveLength(0);
  });

  it("opens each movement to economie's capability role for that holder", async () => {
    const as = async (clientRoles: string[]) => {
      const ctx = setup(
        fakeProvider(() =>
          tokens({ realmRoles: ['moderator'], clientRoles: { 'dyingstar-admin': clientRoles } }),
        ),
      );
      const { cookie } = await signIn(ctx);
      let key = 0;
      const send = async (path: string, body: unknown) =>
        (
          await ctx.call(`/api/economie${path}`, {
            method: 'POST',
            cookie,
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status;
      const move = (path: string) =>
        send(
          path,
          movement(`k${(key += 1)}`, {
            amount: 1,
            type: path.endsWith('/debit') ? 'withdrawal' : 'deposit',
          }),
        );
      return {
        credit: await move(`/wallets/players/${socialIds.reporter}/credit`),
        debit: await move(`/wallets/corporations/${mining}/debit`),
        treasury: await move(`/wallets/politics/${commune}/credit`),
        mint: await send(`/politics/${commune}/mint`, { amount: 1, reason: 'Test' }),
      };
    };

    expect(await as(['economie:wallet:read'])).toEqual({
      credit: 403,
      debit: 403,
      treasury: 403,
      mint: 403,
    });
    expect(await as(['economie:wallet:credit'])).toEqual({
      credit: 201,
      debit: 403,
      treasury: 403,
      mint: 403,
    });
    expect(await as(['economie:wallet:debit'])).toMatchObject({ credit: 403, debit: 201 });
    expect(await as(['economie:politics:manage'])).toMatchObject({ credit: 403, treasury: 201 });
    // Allowed by the panel, refused by economie: the commune may not issue money.
    expect(await as(['economie:money:issue'])).toMatchObject({ treasury: 403, mint: 403 });
  });
});
