import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SOCIAL_URL, socialIds } from '@dyingstar-admin/testing';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { buildApp, mswServer } from '../test/harness';

describe('social moderation routes (ADR 0024)', () => {
  it('lists the services this panel manages', async () => {
    const res = await buildApp().request('/api/servers');
    expect(await res.json()).toMatchObject({ services: ['persistence', 'social'] });

    const without = await buildApp({ social: undefined }).request('/api/servers');
    expect(await without.json()).toMatchObject({ services: ['persistence'] });
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
    expect(moderator.social.tokens).toEqual(['Bearer moderator-token']);

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
});
