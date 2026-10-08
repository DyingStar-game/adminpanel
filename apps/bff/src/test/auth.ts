import { vi } from 'vitest';
import { SOCIAL_URL } from '@dyingstar-admin/testing';
import { createAuth, LOGIN_COOKIE, SESSION_COOKIE } from '../auth/auth';
import type { OidcProvider, OidcTokens } from '../auth/oidc';
import { createSocialClient, registerStaffInSocial } from '../clients/social';
import { buildApp } from './harness';

/** Sign-in helpers for BFF tests: a Keycloak stand-in and the whole flow (ADR 0023). */

export const ORIGIN = 'http://localhost:5173';

export const tokens = (overrides: Partial<OidcTokens> = {}): OidcTokens => ({
  accessToken: 'access',
  refreshToken: 'refresh',
  idToken: 'id-token',
  expiresAt: Date.now() + 300_000,
  user: { id: 'user-1', username: 'dev-editor', name: 'Dev Editor' },
  realmRoles: ['player'],
  clientRoles: { 'dyingstar-admin': ['persistence:write'] },
  ...overrides,
});

/** A Keycloak stand-in recording what the BFF asks. */
export const fakeProvider = (issued: () => OidcTokens = () => tokens()) => {
  const calls = { authorization: [] as Record<string, string>[], exchange: [] as unknown[] };
  const provider: OidcProvider = {
    authorizationUrl: async (input) => {
      calls.authorization.push({ ...input });
      const url = new URL('http://kc.test/auth');
      url.searchParams.set('redirect_uri', input.redirectUri);
      url.searchParams.set('state', input.state);
      return url;
    },
    exchange: vi.fn(async (callbackUrl: URL, checks) => {
      calls.exchange.push({ callbackUrl: callbackUrl.href, checks });
      return issued();
    }),
    refresh: vi.fn(async () => issued()),
    endSessionUrl: async ({ idToken, postLogoutRedirectUri }) =>
      new URL(`http://kc.test/logout?id_token_hint=${idToken}&post=${postLogoutRedirectUri}`),
  };
  return { provider, calls };
};

export const setup = (
  provider = fakeProvider(),
  options: Omit<NonNullable<Parameters<typeof buildApp>[0]>, 'definitions' | 'auth'> = {},
) => {
  // As in production: staff accounts registered in `social` at sign-in (ADR 0024).
  const auth = createAuth({
    provider: provider.provider,
    clientId: 'dyingstar-admin',
    onSignIn: registerStaffInSocial(createSocialClient({ baseUrl: SOCIAL_URL, timeoutMs: 1000 })),
  });
  const { app, social } = buildApp({ ...options, auth });
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    app.request(`${ORIGIN}${path}`, {
      ...init,
      headers: {
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...init.headers,
      },
    });
  return { ...provider, call, social };
};

export const cookieValue = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0];

/** Runs the whole sign-in and returns the session cookie. */
export const signIn = async (ctx: ReturnType<typeof setup>, returnTo = '/explorer') => {
  const login = await ctx.call(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  const state = new URL(login.headers.get('Location') ?? '').searchParams.get('state');
  const callback = await ctx.call(`/auth/callback?code=abc&state=${state}`, {
    cookie: cookieValue(login, LOGIN_COOKIE) ?? '',
  });
  return { callback, cookie: cookieValue(callback, SESSION_COOKIE) ?? '' };
};
