import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  createSocialDataset,
  organisationIds,
  SOCIAL_URL,
  socialIds,
} from '@dyingstar-admin/testing';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { createSocialClient } from '../clients/social';
import { buildApp, mswServer } from '../test/harness';

describe('social moderation routes (ADR 0024)', () => {
  it('lists the services this panel manages', async () => {
    const res = await buildApp().request('/api/panel');
    expect(await res.json()).toMatchObject({
      services: ['persistence', 'social', 'social-management', 'economie', 'economie-wallets'],
    });
    // Without svc-admin's secret, organisations stay readable but not managed.
    const reading = await buildApp({
      social: createSocialClient({ baseUrl: SOCIAL_URL, timeoutMs: 1000 }),
      economie: undefined,
    }).request('/api/panel');
    expect(await reading.json()).toMatchObject({ services: ['persistence', 'social'] });

    const without = await buildApp({ social: undefined, economie: undefined }).request(
      '/api/panel',
    );
    expect(await without.json()).toMatchObject({ services: ['persistence'] });
    const alone = await buildApp({ persistenceUrl: undefined }).request('/api/panel');
    expect(await alone.json()).toMatchObject({
      services: ['social', 'social-management', 'economie', 'economie-wallets'],
    });
  });

  it('reads stats, the log, reports, a player sheet and sanctions', async () => {
    const { request } = buildApp();

    expect(await (await request('/api/social/stats')).json()).toMatchObject({
      players: { total: 3 },
      // The warning ended at once (a record): only the mute is in force.
      sanctions: { active: 1 },
    });
    expect(await (await request('/api/social/log?limit=1')).json()).toMatchObject({
      total: 2,
      limit: 1,
      items: [{ action: 'report_dismissed' }],
    });
    expect(await (await request('/api/social/reports?status=open')).json()).toMatchObject({
      total: 1,
      items: [{ id: 1, targetName: 'griefer42' }],
    });
    expect(await (await request('/api/social/reports/2')).json()).toMatchObject({
      reason: 'reputation_threshold',
    });
    expect(await (await request(`/api/social/players/${socialIds.griefer}`)).json()).toMatchObject({
      displayName: 'griefer42',
      sanctions: [{ type: 'warning' }, { type: 'mute' }],
    });
    expect(
      await (await request(`/api/social/sanctions?playerId=${socialIds.griefer}`)).json(),
    ).toMatchObject({ total: 1, items: [{ type: 'mute' }] });
  });

  it("reads a player's public profile: presence and memberships", async () => {
    const res = await buildApp().request(`/api/social/players/${socialIds.griefer}/profile`);
    expect(await res.json()).toMatchObject({
      status: 'online',
      corporations: [{ ticker: 'DCM' }],
      politics: [{ name: 'Port Gaea' }],
    });
  });

  it('searches players by name', async () => {
    const res = await buildApp().request('/api/social/players?search=dev&limit=5');
    expect(await res.json()).toMatchObject({
      total: 1,
      limit: 5,
      items: [{ displayName: 'dev-moderator' }],
    });
  });

  it('refuses invalid inputs before calling social', async () => {
    const { request, social } = buildApp();

    expect((await request('/api/social/reports?status=closed')).status).toBe(400);
    expect((await request('/api/social/reports?limit=500')).status).toBe(400);
    expect((await request('/api/social/reports/abc')).status).toBe(400);
    expect((await request('/api/social/players/not-a-uuid')).status).toBe(400);
    expect((await request('/api/social/players?entityType=robot')).status).toBe(400);
    expect(social.tokens).toHaveLength(0);
  });

  it("passes social's refusals on: 404, its own role check (403), being down (502)", async () => {
    const { request } = buildApp();
    expect((await request('/api/social/reports/99')).status).toBe(404);

    mswServer.use(
      http.get(`${SOCIAL_URL}/api/admin/stats`, () =>
        HttpResponse.json(
          { error: 'FORBIDDEN', message: 'Requires the admin role', status: 403 },
          { status: 403 },
        ),
      ),
    );
    const forbidden = await request('/api/social/stats');
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ message: 'Requires the admin role' });

    mswServer.use(http.get(`${SOCIAL_URL}/api/admin/stats`, () => HttpResponse.error()));
    expect(await (await request('/api/social/stats')).json()).toMatchObject({
      error: 'UPSTREAM_UNREACHABLE',
    });
  });

  it("forwards the signed-in moderator's token, and refuses accounts without the role", async () => {
    const moderator = setup(
      fakeProvider(() => tokens({ accessToken: 'moderator-token', realmRoles: ['moderator'] })),
    );
    const { cookie } = await signIn(moderator);

    expect((await moderator.call('/api/social/stats', { cookie })).status).toBe(200);
    // Registered in `social` at sign-in, then the stats: both with the moderator's own token.
    expect(moderator.social.tokens).toEqual(['Bearer moderator-token', 'Bearer moderator-token']);

    const editor = setup(); // persistence:write only
    const editorSession = await signIn(editor);
    const refused = await editor.call('/api/social/stats', { cookie: editorSession.cookie });
    expect(refused.status).toBe(403);
    expect(editor.social.tokens).toHaveLength(0);
  });

  it('answers 404 when social is not configured', async () => {
    expect((await buildApp({ social: undefined }).request('/api/social/stats')).status).toBe(404);
  });

  describe('acting on players (step 3)', () => {
    const json = (body: unknown) => ({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    it('sanctions a player, lifts the sanction, adjusts reputation', async () => {
      const { request, social } = buildApp();

      const issued = await request(`/api/social/players/${socialIds.reporter}/sanctions`, {
        method: 'POST',
        ...json({ type: 'warning', reason: 'Spam in chat' }),
      });
      expect(issued.status).toBe(201);
      const sanction = (await issued.json()) as { id: number; type: string };
      expect(sanction.type).toBe('warning');

      const lifted = await request(`/api/social/sanctions/${sanction.id}`, { method: 'DELETE' });
      expect(await lifted.json()).toMatchObject({
        id: sanction.id,
        revokedBy: socialIds.moderator,
      });
      const again = await request(`/api/social/sanctions/${sanction.id}`, { method: 'DELETE' });
      expect(again.status).toBe(404);

      const reputation = await request(`/api/social/players/${socialIds.reporter}/reputation`, {
        method: 'POST',
        ...json({ delta: 10, reason: 'Helped new players' }),
      });
      expect(await reputation.json()).toMatchObject({ reputation: 13 });
      expect(social.writes.map((w) => w.call)).toEqual([
        `POST /players/${socialIds.reporter}/sanctions`,
        `DELETE /sanctions/${sanction.id}`,
        `DELETE /sanctions/${sanction.id}`,
        `POST /players/${socialIds.reporter}/reputation`,
      ]);
    });

    it('refuses invalid actions before calling social', async () => {
      const { request, social } = buildApp();
      const sanction = (body: unknown) =>
        request(`/api/social/players/${socialIds.reporter}/sanctions`, {
          method: 'POST',
          ...json(body),
        });

      expect((await sanction({ type: 'kick', reason: 'x' })).status).toBe(400);
      expect((await sanction({ type: 'mute', reason: '' })).status).toBe(400);
      expect((await sanction({ type: 'mute', reason: 'x', durationHours: 9000 })).status).toBe(400);
      const delta = await request(`/api/social/players/${socialIds.reporter}/reputation`, {
        method: 'POST',
        ...json({ delta: 500, reason: 'x' }),
      });
      expect(delta.status).toBe(400);
      expect(social.writes).toHaveLength(0);
    });

    it('keeps bans and reputation to admins, mutes open to moderators', async () => {
      const moderator = setup(
        fakeProvider(() => tokens({ realmRoles: ['moderator'], clientRoles: {} })),
      );
      const { cookie } = await signIn(moderator);
      const send = (path: string, body: unknown) =>
        moderator.call(path, {
          method: 'POST',
          cookie,
          headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const sanctions = `/api/social/players/${socialIds.reporter}/sanctions`;

      expect((await send(sanctions, { type: 'ban', reason: 'Cheating' })).status).toBe(403);
      const reputation = `/api/social/players/${socialIds.reporter}/reputation`;
      expect((await send(reputation, { delta: 1, reason: 'x' })).status).toBe(403);
      expect(moderator.social.writes).toHaveLength(0);
      expect(
        (await send(sanctions, { type: 'mute', reason: 'Spam', durationHours: 1 })).status,
      ).toBe(201);
    });
  });

  describe('organisations, reading (step 2)', () => {
    it('reads corporations: directory, page, members, subsidiaries', async () => {
      const { request } = buildApp();
      const { mining, logistics } = organisationIds;

      expect(await (await request('/api/social/corporations?search=core')).json()).toMatchObject({
        total: 1,
        items: [{ id: mining, ticker: 'DCM', memberCount: 1 }],
      });
      expect(await (await request(`/api/social/corporations/${mining}`)).json()).toMatchObject({
        name: 'Deep Core Mining',
        parent: null,
        subsidiaries: [{ id: logistics }],
      });
      expect(
        await (await request(`/api/social/corporations/${mining}/members?limit=5`)).json(),
      ).toMatchObject({ limit: 5, items: [{ displayName: 'griefer42', rank: { isCeo: true } }] });
      expect(
        await (await request(`/api/social/corporations/${mining}/subsidiaries`)).json(),
      ).toMatchObject({ total: 1, items: [{ id: logistics, parentId: mining }] });
    });

    it('reads political entities: directory by type, page, members, children', async () => {
      const { request } = buildApp();
      const { commune, country } = organisationIds;

      expect(await (await request('/api/social/politics?type=country')).json()).toMatchObject({
        total: 1,
        items: [{ id: country, name: 'Tarsis Union' }],
      });
      expect(await (await request(`/api/social/politics/${commune}`)).json()).toMatchObject({
        parent: { id: country },
        offices: [{ name: 'Mayor', isHead: true }, { name: 'Councilor' }, { name: 'Citizen' }],
      });
      expect(await (await request(`/api/social/politics/${commune}/members`)).json()).toMatchObject(
        { total: 2 },
      );
      expect(
        await (await request(`/api/social/politics/${country}/children`)).json(),
      ).toMatchObject({ items: [{ id: commune }] });
    });

    it('refuses invalid ids and filters before calling social', async () => {
      const { request, social } = buildApp();

      expect((await request('/api/social/corporations/not-a-uuid')).status).toBe(400);
      expect((await request('/api/social/politics?type=empire')).status).toBe(400);
      expect((await request('/api/social/corporations?limit=500')).status).toBe(400);
      expect(social.tokens).toHaveLength(0);
    });

    it("passes social's 404 on", async () => {
      const { request } = buildApp();
      const missing = '7c0a7e1e-0000-4000-8000-000000000000';
      expect((await request(`/api/social/politics/${missing}`)).status).toBe(404);
    });
  });

  describe('organisation management (step N, as svc-admin)', () => {
    const json = (body: unknown) => ({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    it('creates a corporation, edits it, changes a rank, transfers it, then disbands it', async () => {
      const { request, social } = buildApp();
      const send = (path: string, method: string, body?: unknown) =>
        request(`/api/social${path}`, { method, ...(body === undefined ? {} : json(body)) });

      const created = await send('/corporations', 'POST', {
        ceoId: socialIds.reporter,
        name: 'Ddurieux Hauling',
        ticker: 'dhl',
      });
      expect(created.status).toBe(201);
      const { id } = (await created.json()) as { id: string };
      expect(
        await (await send(`/corporations/${id}`, 'PATCH', { recruitment: 'open' })).json(),
      ).toMatchObject({ ticker: 'DHL', recruitment: 'open' });

      // The CEO's rank changes by transfer only, and the CEO leaves only after one.
      expect(
        (await send(`/corporations/${id}/members/${socialIds.reporter}`, 'DELETE')).status,
      ).toBe(403);
      expect(
        (await send(`/corporations/${id}/transfer`, 'POST', { playerId: socialIds.griefer }))
          .status,
      ).toBe(404);
      expect((await send(`/corporations/${id}`, 'DELETE')).status).toBe(204);
      expect(social.data.corporations.some((c) => c.id === id)).toBe(false);
      // Every call went out with svc-admin's token, never the user's.
      expect(social.tokens.slice(-5).every((t) => t === 'Bearer svc-admin-token')).toBe(true);
    });

    it('transfers a political entity to a member, the former head taking the office below', async () => {
      const { request, social } = buildApp();
      const { commune } = organisationIds;

      const res = await request(`/api/social/politics/${commune}/transfer`, {
        method: 'POST',
        ...json({ playerId: socialIds.reporter }),
      });
      expect(await res.json()).toMatchObject({ headId: socialIds.reporter });
      const offices = social.data.politicalMembers.filter((m) => m.entityId === commune);
      expect(offices.find((m) => m.playerId === socialIds.griefer)?.officeId).toBe(4);
    });

    it('refuses invalid bodies before calling social', async () => {
      const { request, social } = buildApp();

      const noCeo = await request('/api/social/corporations', {
        method: 'POST',
        ...json({ name: 'No CEO', ticker: 'NOC' }),
      });
      expect(noCeo.status).toBe(400);
      const badType = await request('/api/social/politics', {
        method: 'POST',
        ...json({ headId: socialIds.reporter, type: 'empire', name: 'Empire' }),
      });
      expect(badType.status).toBe(400);
      expect(social.writes).toHaveLength(0);
    });

    it("opens it to social's capability roles only, not to moderators", async () => {
      const as = async (clientRoles: string[], realmRoles: string[] = []) => {
        const ctx = setup(
          fakeProvider(() =>
            tokens({ realmRoles, clientRoles: { 'dyingstar-admin': clientRoles } }),
          ),
        );
        const { cookie } = await signIn(ctx);
        const edit = await ctx.call(`/api/social/corporations/${organisationIds.mining}`, {
          method: 'PATCH',
          cookie,
          headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: 'Edited' }),
        });
        return { status: edit.status, writes: ctx.social.writes.length };
      };

      // The moderation section opens with a moderation role; managing needs the capability too.
      expect(await as([], ['admin'])).toEqual({ status: 403, writes: 0 });
      expect(await as(['social:politics:write'], ['moderator'])).toEqual({
        status: 403,
        writes: 0,
      });
      expect(await as(['social:corporation:write'])).toEqual({ status: 403, writes: 0 });
      expect(await as(['social:corporation:write'], ['moderator'])).toMatchObject({
        status: 200,
        writes: 1,
      });
    });
  });

  describe('report actions (step 3)', () => {
    const json = (body: unknown) => ({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    it('claims a report, escalates it to the top level by level, then confirms it', async () => {
      const { request, social } = buildApp();
      const status = (id: number, body: unknown) =>
        request(`/api/social/reports/${id}`, { method: 'PATCH', ...json(body) });
      const escalate = (id: number) =>
        request(`/api/social/reports/${id}/escalate`, { method: 'POST' });
      const reputation = async () =>
        (
          (await (await request(`/api/social/players/${socialIds.griefer}`)).json()) as {
            reputation: number;
          }
        ).reputation;
      const before = await reputation();

      expect(await (await status(1, { status: 'reviewing' })).json()).toMatchObject({
        status: 'reviewing',
        resolvedAt: null,
      });
      // Escalating puts the report back in the queue, one level up, to be claimed there.
      expect(await (await escalate(1)).json()).toMatchObject({
        status: 'open',
        escalation: 'admin',
      });
      await status(1, { status: 'reviewing' });
      expect(await (await escalate(1)).json()).toMatchObject({ escalation: 'supervisor' });
      await status(1, { status: 'reviewing' });
      // `social` refuses above the top level with a 403 (its OpenAPI says 409).
      expect((await escalate(1)).status).toBe(403);

      const confirmed = await status(1, { status: 'resolved', note: 'Seen on the replay.' });
      expect(await confirmed.json()).toMatchObject({
        status: 'resolved',
        resolvedBy: socialIds.moderator,
        resolutionNote: 'Seen on the replay.',
      });
      expect(await reputation()).toBe(before - 10);
      expect(social.writes.map((w) => w.call)).toEqual([
        'PATCH /reports/1',
        'POST /reports/1/escalate',
        'PATCH /reports/1',
        'POST /reports/1/escalate',
        'PATCH /reports/1',
        'POST /reports/1/escalate',
        'PATCH /reports/1',
      ]);
    });

    it('claims first, then decides (the panel’s rule), and stops once closed', async () => {
      const { request, social } = buildApp();
      const status = (id: number, body: unknown) =>
        request(`/api/social/reports/${id}`, { method: 'PATCH', ...json(body) });
      const escalate = (id: number) =>
        request(`/api/social/reports/${id}/escalate`, { method: 'POST' });

      // Report 1 is open: neither decided nor escalated before being claimed.
      expect((await status(1, { status: 'dismissed' })).status).toBe(409);
      expect((await escalate(1)).status).toBe(409);
      // Report 2 is claimed already: not twice.
      expect((await status(2, { status: 'reviewing' })).status).toBe(409);
      // Report 3 is closed.
      expect((await status(3, { status: 'resolved' })).status).toBe(409);
      expect(social.writes).toHaveLength(0);
    });

    it('refuses invalid report actions before calling social', async () => {
      const { request, social } = buildApp();
      const status = (id: string, body: unknown) =>
        request(`/api/social/reports/${id}`, { method: 'PATCH', ...json(body) });

      expect((await status('1', { status: 'open' })).status).toBe(400);
      expect((await status('1', { status: 'resolved', note: 'x'.repeat(1001) })).status).toBe(400);
      expect((await status('abc', { status: 'resolved' })).status).toBe(400);
      expect((await request('/api/social/reports/0/escalate', { method: 'POST' })).status).toBe(
        400,
      );
      expect(social.writes).toHaveLength(0);
    });

    it('opens report actions to moderators, from the panel only', async () => {
      const moderator = setup(
        fakeProvider(() => tokens({ realmRoles: ['moderator'], clientRoles: {} })),
      );
      const { cookie } = await signIn(moderator);
      const claim = (origin: string) =>
        moderator.call('/api/social/reports/1', {
          method: 'PATCH',
          cookie,
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'reviewing' }),
        });

      expect((await claim('https://elsewhere.example')).status).toBe(403);
      expect(moderator.social.writes).toHaveLength(0);
      expect((await claim(ORIGIN)).status).toBe(200);
    });

    it('handles a report at its escalation level or above (the panel’s rule)', async () => {
      const as = async (role: string) => {
        const ctx = setup(fakeProvider(() => tokens({ realmRoles: [role], clientRoles: {} })));
        const { cookie } = await signIn(ctx);
        const send = (path: string, method: string, body?: unknown) =>
          ctx.call(path, {
            method,
            cookie,
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        return { ctx, send };
      };

      // Report 2 is claimed, at the admin level: closed to a moderator, though `social` would
      // accept.
      const moderator = await as('moderator');
      const refused = await moderator.send('/api/social/reports/2', 'PATCH', {
        status: 'dismissed',
      });
      expect(refused.status).toBe(403);
      expect((await moderator.send('/api/social/reports/2/escalate', 'POST')).status).toBe(403);
      expect(moderator.ctx.social.writes).toHaveLength(0);

      const admin = await as('admin');
      expect(
        (await admin.send('/api/social/reports/2', 'PATCH', { status: 'dismissed' })).status,
      ).toBe(200);
    });
  });

  describe('staff known to social (ADR 0024 › Update 2026-10-08)', () => {
    const withoutModerator = () => {
      const data = createSocialDataset();
      data.players = data.players.filter((p) => p.playerId !== socialIds.moderator);
      return data;
    };
    const registered = (ctx: ReturnType<typeof setup>) =>
      ctx.social.data.players.some((p) => p.playerId === socialIds.moderator);

    it('registers a moderation account in social at sign-in', async () => {
      const ctx = setup(
        fakeProvider(() => tokens({ realmRoles: ['moderator'], clientRoles: {} })),
        { socialData: withoutModerator() },
      );
      expect(registered(ctx)).toBe(false);
      await signIn(ctx);
      expect(registered(ctx)).toBe(true);
    });

    it('leaves the other accounts alone', async () => {
      const ctx = setup(fakeProvider(), { socialData: withoutModerator() });
      await signIn(ctx);
      expect(registered(ctx)).toBe(false);
    });

    it('signs in even when social is down', async () => {
      const ctx = setup(fakeProvider(() => tokens({ realmRoles: ['moderator'], clientRoles: {} })));
      mswServer.use(http.get(`${SOCIAL_URL}/api/me`, () => HttpResponse.error()));
      const { callback, cookie } = await signIn(ctx);
      expect(callback.status).toBe(302);
      expect(cookie).not.toBe('');
    });
  });
});
