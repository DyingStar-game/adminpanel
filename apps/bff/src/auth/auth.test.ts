import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MeResponseSchema } from '@dyingstar-admin/schemas';
import { cookieValue, fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { LOGIN_COOKIE, persistencePermission, safeReturnTo, SESSION_COOKIE } from './auth';
import type { OidcTokens } from './oidc';

describe('sign-in with Keycloak', () => {
  it('refuses the API without a session, and keeps the healthcheck open', async () => {
    const ctx = setup();

    const res = await ctx.call('/api/servers');

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'UNAUTHENTICATED' });
    expect((await ctx.call('/health')).status).toBe(200);
  });

  it('sends the browser to Keycloak with PKCE and a callback on the panel origin', async () => {
    const ctx = setup();

    const res = await ctx.call('/auth/login?returnTo=/explorer');

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('http://kc.test/auth');
    const [authorization] = ctx.calls.authorization;
    expect(authorization?.redirectUri).toBe(`${ORIGIN}/auth/callback`);
    const login = res.headers.getSetCookie().find((c) => c.startsWith(`${LOGIN_COOKIE}=`));
    expect(login).toMatch(/HttpOnly/);
    expect(login).toMatch(/SameSite=Lax/);
  });

  it('opens a session on the callback and returns to the page asked', async () => {
    const ctx = setup();

    const { callback, cookie } = await signIn(ctx, '/items/abc?tab=raw');

    expect(callback.status).toBe(302);
    expect(callback.headers.get('Location')).toBe('/items/abc?tab=raw');
    expect(callback.headers.getSetCookie().join()).toMatch(/HttpOnly/);
    // The code verifier matches the challenge sent to Keycloak, state and nonce are checked.
    const [exchange] = ctx.calls.exchange as {
      callbackUrl: string;
      checks: { codeVerifier: string; state: string; nonce: string };
    }[];
    const [authorization] = ctx.calls.authorization;
    expect(exchange?.callbackUrl).toBe(
      `${ORIGIN}/auth/callback?code=abc&state=${authorization?.state}`,
    );
    expect(exchange?.checks).toMatchObject({
      state: authorization?.state,
      nonce: authorization?.nonce,
    });
    expect(
      createHash('sha256')
        .update(exchange?.checks.codeVerifier ?? '')
        .digest('base64url'),
    ).toBe(authorization?.codeChallenge);

    const me = MeResponseSchema.parse(await (await ctx.call('/api/me', { cookie })).json());
    expect(me).toEqual({
      user: { id: 'user-1', username: 'dev-editor', name: 'Dev Editor' },
      roles: ['player', 'persistence:write'],
      permissions: [
        'persistence.read',
        'persistence.check',
        'persistence.write',
        'persistence.delete',
      ],
      access: true,
    });
    expect((await ctx.call('/api/servers', { cookie })).status).toBe(200);
  });

  it('lets a player without a panel role sign in, but opens only /api/me', async () => {
    const ctx = setup(
      fakeProvider(() =>
        tokens({ realmRoles: ['player'], clientRoles: { 'social-api': ['moderator'] } }),
      ),
    );
    const { cookie } = await signIn(ctx);

    const me = MeResponseSchema.parse(await (await ctx.call('/api/me', { cookie })).json());
    const servers = await ctx.call('/api/servers', { cookie });

    // Another client's roles do not count.
    expect(me).toMatchObject({ access: false, roles: ['player'] });
    expect(servers.status).toBe(403);
    expect(await servers.json()).toMatchObject({ error: 'ACCESS_DENIED' });
  });

  it('opens the panel to a moderator holding a persistence role', async () => {
    const ctx = setup(
      fakeProvider(() =>
        tokens({
          realmRoles: ['moderator'],
          clientRoles: { 'dyingstar-admin': ['persistence:read'] },
        }),
      ),
    );
    const { cookie } = await signIn(ctx);

    expect((await ctx.call('/api/servers', { cookie })).status).toBe(200);
  });

  it('comes back to the sign-in page when the login expired, failed or was refused', async () => {
    const ctx = setup();
    const noLogin = await ctx.call('/auth/callback?code=abc&state=x');
    expect(noLogin.headers.get('Location')).toBe('/?signin=expired');

    const login = await ctx.call('/auth/login');
    const refused = await ctx.call('/auth/callback?error=access_denied', {
      cookie: cookieValue(login, LOGIN_COOKIE) ?? '',
    });
    expect(refused.headers.get('Location')).toBe('/?signin=failed');

    const failing = fakeProvider();
    failing.provider.exchange = async () => {
      throw new Error('invalid_grant');
    };
    const ctx2 = setup(failing);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { callback } = await signIn(ctx2);
    expect(callback.headers.get('Location')).toBe('/?signin=failed');
    expect(cookieValue(callback, SESSION_COOKIE)).toBeUndefined();
  });

  it('uses a login only once', async () => {
    const ctx = setup();
    const login = await ctx.call('/auth/login');
    const cookie = cookieValue(login, LOGIN_COOKIE) ?? '';

    await ctx.call('/auth/callback?code=abc', { cookie });
    const replay = await ctx.call('/auth/callback?code=abc', { cookie });

    expect(replay.headers.get('Location')).toBe('/?signin=expired');
  });

  it('refreshes an access token about to expire, and signs out when it cannot', async () => {
    const issued = vi
      .fn<() => OidcTokens>()
      .mockReturnValueOnce(tokens({ expiresAt: Date.now() + 10_000 }))
      .mockReturnValueOnce(tokens({ clientRoles: { 'dyingstar-admin': ['persistence:read'] } }));
    const ctx = setup(fakeProvider(issued));
    const { cookie } = await signIn(ctx);

    const me = MeResponseSchema.parse(await (await ctx.call('/api/me', { cookie })).json());
    expect(ctx.provider.refresh).toHaveBeenCalledTimes(1);
    expect(me.roles).toEqual(['player', 'persistence:read']);

    const failing = fakeProvider(() => tokens({ expiresAt: Date.now() }));
    failing.provider.refresh = async () => {
      throw new Error('session expired');
    };
    const ctx2 = setup(failing);
    const second = await signIn(ctx2);
    expect((await ctx2.call('/api/me', { cookie: second.cookie })).status).toBe(401);
  });

  it('refuses writes sent from another origin', async () => {
    const ctx = setup();
    const { cookie } = await signIn(ctx);
    const exists = (origin: string) =>
      ctx.call('/api/items/exists', {
        method: 'POST',
        cookie,
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuids: [] }),
      });

    const foreign = await exists('https://evil.test');
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({ error: 'FORBIDDEN_ORIGIN' });
    expect((await exists(ORIGIN)).status).toBe(200);
  });

  it('signs out of the panel and of Keycloak', async () => {
    const ctx = setup();
    const { cookie } = await signIn(ctx);

    const res = await ctx.call('/auth/logout', {
      method: 'POST',
      cookie,
      headers: { Origin: ORIGIN },
    });

    expect(await res.json()).toEqual({
      redirect: `http://kc.test/logout?id_token_hint=id-token&post=${ORIGIN}/`,
    });
    expect((await ctx.call('/api/me', { cookie })).status).toBe(401);
  });
});

describe('persistence permissions (interim matrix, ADR 0023)', () => {
  const as = async (clientRoles: string[], realmRoles: string[] = ['player']) => {
    const ctx = setup(
      fakeProvider(() => tokens({ realmRoles, clientRoles: { 'dyingstar-admin': clientRoles } })),
    );
    const { cookie } = await signIn(ctx);
    const send = (method: string, path: string, body?: unknown) =>
      ctx.call(path, {
        method,
        cookie,
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    return send;
  };

  it('lets persistence:read browse and check, and refuses its writes', async () => {
    const send = await as(['persistence:read']);

    expect((await send('GET', '/api/items?page=1&page_size=5')).status).toBe(200);
    expect((await send('POST', '/api/items/exists', { uuids: [] })).status).toBe(200);
    const create = await send('POST', '/api/items', {});
    expect(create.status).toBe(403);
    expect(await create.json()).toMatchObject({ error: 'FORBIDDEN' });
    expect((await send('DELETE', '/api/items/0b4a5c0e-0000-4000-8000-000000000000')).status).toBe(
      403,
    );
  });

  it('keeps the panel closed to a moderator without a persistence role', async () => {
    const send = await as([], ['player', 'moderator']);

    expect((await send('GET', '/api/items?page=1&page_size=5')).status).toBe(403);
  });

  it('maps every persistence route to its permission', () => {
    expect(persistencePermission('GET', '/api/items/abc/ancestors')).toBe('persistence.read');
    expect(persistencePermission('GET', '/api/bodies/abc/map')).toBe('persistence.read');
    expect(persistencePermission('POST', '/api/items/check')).toBe('persistence.check');
    expect(persistencePermission('POST', '/api/items/import/check')).toBe('persistence.check');
    expect(persistencePermission('POST', '/api/items/exists')).toBe('persistence.check');
    expect(persistencePermission('POST', '/api/items')).toBe('persistence.write');
    expect(persistencePermission('POST', '/api/items/abc/duplicate')).toBe('persistence.write');
    expect(persistencePermission('PUT', '/api/items/abc')).toBe('persistence.write');
    expect(persistencePermission('DELETE', '/api/items/abc')).toBe('persistence.delete');
  });
});

describe('safeReturnTo', () => {
  it('keeps same-origin paths only', () => {
    expect(safeReturnTo('/explorer?x=1')).toBe('/explorer?x=1');
    expect(safeReturnTo('//evil.test')).toBe('/');
    expect(safeReturnTo('/\\evil.test')).toBe('/');
    expect(safeReturnTo('https://evil.test')).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
  });
});
