import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SOCIAL_URL, socialIds } from '@dyingstar-admin/testing';
import { fakeProvider, setup, signIn, tokens } from '../test/auth';
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
      sanctions: { active: 2 },
    });
    expect(await (await request('/api/social/log?limit=1')).json()).toMatchObject({
      total: 2,
      limit: 1,
      items: [{ action: 'report.dismissed' }],
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
    ).toMatchObject({ total: 2 });
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
});
