import { randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { LRUCache } from 'lru-cache';
import * as oidc from 'openid-client';
import {
  ErrorCode,
  permissionsOf,
  type MeResponse,
  type Permission,
} from '@dyingstar-admin/schemas';
import { ApiError } from '../lib/errors';
import type { OidcProvider, OidcTokens } from './oidc';

export const SESSION_COOKIE = 'ds_admin_session';
export const LOGIN_COOKIE = 'ds_admin_login';

/** Refresh the access token when it expires within this delay. */
const REFRESH_MARGIN_MS = 30_000;
/** Time allowed between leaving for Keycloak and coming back. */
const LOGIN_TTL_MS = 10 * 60 * 1000;

export interface AuthOptions {
  provider: OidcProvider;
  /** Client id of the panel in Keycloak: its client roles are read under this name. */
  clientId: string;
  /** Origin the browser uses (`https://admin…`); defaults to the origin of each request. */
  publicUrl?: string | undefined;
  /** Idle lifetime of a BFF session. */
  sessionTtlMs?: number;
}

export interface Session {
  user: NonNullable<OidcTokens['user']>;
  roles: string[];
  /** What the roles allow (`permissions.ts`); none keeps the panel closed. */
  permissions: Permission[];
  access: boolean;
  tokens: OidcTokens;
  /** Refresh in flight, shared by concurrent requests. */
  refreshing?: Promise<Session | null> | undefined;
}

export interface SessionContext {
  Variables: { session: Session };
}

interface PendingLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

const randomId = () => randomBytes(32).toString('base64url');

/** Keeps only same-origin paths, so the sign-in never redirects elsewhere. */
export const safeReturnTo = (value: string | undefined) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Sign-in with Keycloak (ADR 0023): the BFF is a confidential OIDC client, keeps the tokens in
 * memory and gives the browser an opaque, `HttpOnly` session cookie.
 */
export function createAuth({
  provider,
  clientId,
  publicUrl,
  sessionTtlMs = 12 * 60 * 60 * 1000,
}: AuthOptions) {
  const sessions = new LRUCache<string, Session>({
    max: 5000,
    ttl: sessionTtlMs,
    updateAgeOnGet: true,
  });
  const logins = new LRUCache<string, PendingLogin>({ max: 5000, ttl: LOGIN_TTL_MS });

  const originOf = (c: Context) => publicUrl ?? new URL(c.req.url).origin;
  const redirectUri = (c: Context) => `${originOf(c)}/auth/callback`;
  const cookieOptions = (c: Context) => ({
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: originOf(c).startsWith('https:'),
  });

  const toSession = (tokens: OidcTokens): Session | null => {
    if (!tokens.user) return null;
    const roles = [...new Set([...tokens.realmRoles, ...(tokens.clientRoles[clientId] ?? [])])];
    const permissions = permissionsOf(roles);
    return { user: tokens.user, roles, permissions, access: permissions.length > 0, tokens };
  };

  /** Session of the request, refreshed when its access token is about to expire. */
  const current = async (c: Context): Promise<{ id: string; session: Session } | null> => {
    const id = getCookie(c, SESSION_COOKIE);
    const session = id ? sessions.get(id) : undefined;
    if (!id || !session) return null;
    if (session.tokens.expiresAt - REFRESH_MARGIN_MS > Date.now()) return { id, session };

    const { refreshToken } = session.tokens;
    if (!refreshToken) {
      sessions.delete(id);
      return null;
    }
    session.refreshing ??= provider
      .refresh({ ...session.tokens, refreshToken })
      .then((tokens) => toSession(tokens))
      .catch(() => null);
    const refreshed = await session.refreshing;
    session.refreshing = undefined;
    if (!refreshed) {
      sessions.delete(id);
      return null;
    }
    sessions.set(id, refreshed);
    return { id, session: refreshed };
  };

  const checkOrigin = (c: Context) => {
    const origin = c.req.header('Origin');
    if (!SAFE_METHODS.has(c.req.method) && origin && origin !== originOf(c)) {
      throw new ApiError(403, ErrorCode.forbiddenOrigin, `Requests from ${origin} are refused`);
    }
  };

  const routes = new Hono()
    .get('/login', async (c) => {
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const pending: PendingLogin = {
        state: oidc.randomState(),
        nonce: oidc.randomNonce(),
        codeVerifier,
        returnTo: safeReturnTo(c.req.query('returnTo')),
      };
      const url = await provider.authorizationUrl({
        redirectUri: redirectUri(c),
        state: pending.state,
        nonce: pending.nonce,
        codeChallenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      });
      const loginId = randomId();
      logins.set(loginId, pending);
      setCookie(c, LOGIN_COOKIE, loginId, {
        ...cookieOptions(c),
        maxAge: LOGIN_TTL_MS / 1000,
      });
      return c.redirect(url.href);
    })
    .get('/callback', async (c) => {
      const loginId = getCookie(c, LOGIN_COOKIE);
      const pending = loginId ? logins.get(loginId) : undefined;
      if (loginId) logins.delete(loginId);
      deleteCookie(c, LOGIN_COOKIE, { path: '/' });
      if (!pending) return c.redirect('/?signin=expired');
      if (c.req.query('error')) return c.redirect('/?signin=failed');

      const callbackUrl = new URL(redirectUri(c));
      callbackUrl.search = new URL(c.req.url).search;
      let session: Session | null;
      try {
        session = toSession(await provider.exchange(callbackUrl, pending));
      } catch (error) {
        console.error('Sign-in failed:', error);
        return c.redirect('/?signin=failed');
      }
      if (!session) return c.redirect('/?signin=failed');

      const previous = getCookie(c, SESSION_COOKIE);
      if (previous) sessions.delete(previous);
      const id = randomId();
      sessions.set(id, session);
      setCookie(c, SESSION_COOKIE, id, cookieOptions(c));
      return c.redirect(pending.returnTo);
    })
    .post('/logout', async (c) => {
      checkOrigin(c);
      const id = getCookie(c, SESSION_COOKIE);
      const session = id ? sessions.get(id) : undefined;
      if (id) sessions.delete(id);
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      const redirect = session
        ? await provider.endSessionUrl({
            idToken: session.tokens.idToken,
            postLogoutRedirectUri: `${originOf(c)}/`,
          })
        : '/';
      return c.json({ redirect: String(redirect) });
    });

  /**
   * Guard of `/api/*`: a session is required (401), and a permission for anything but `/api/me`
   * (403). Writes from another origin are refused. Each route then checks its own permission
   * (`requirePermission`).
   */
  const guard = createMiddleware<SessionContext>(async (c, next) => {
    const found = await current(c);
    if (!found) {
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      throw new ApiError(401, ErrorCode.unauthenticated, 'Sign in first');
    }
    checkOrigin(c);
    if (!found.session.access && c.req.path !== '/api/me') {
      throw new ApiError(403, ErrorCode.accessDenied, 'No role of this account opens the panel');
    }
    c.set('session', found.session);
    await next();
  });

  const me = (session: Session): MeResponse => ({
    user: session.user,
    roles: session.roles,
    permissions: session.permissions,
    access: session.access,
  });

  return { routes, guard, me };
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Permission a persistence route needs (interim matrix, ADR 0023): reads, the import and form
 * checks (POSTs that write nothing), deletions, and every other write.
 */
export function persistencePermission(method: string, path: string): Permission {
  if (method === 'GET' || method === 'HEAD') return 'persistence.read';
  if (method === 'DELETE') return 'persistence.delete';
  if (method === 'POST' && /\/items\/(check|import\/check|exists)$/.test(path)) {
    return 'persistence.check';
  }
  return 'persistence.write';
}

/**
 * Refuses (403) a route when the session lacks `permission`. Without authentication (tests)
 * there is no session and every route is open.
 */
export const requirePermission = (permission: Permission) =>
  createMiddleware<SessionContext>(async (c, next) => {
    const session = c.var.session as Session | undefined;
    if (session && !session.permissions.includes(permission)) {
      throw new ApiError(403, ErrorCode.forbidden, `This account lacks ${permission}`);
    }
    await next();
  });

/**
 * Refuses (403) a persistence route whose permission the session lacks. Without authentication
 * (tests) there is no session and every route is open.
 */
export const requirePersistencePermission = createMiddleware<SessionContext>(async (c, next) => {
  // Unset when the app runs without authentication.
  const session = c.var.session as Session | undefined;
  const needed = persistencePermission(c.req.method, c.req.path);
  if (session && !session.permissions.includes(needed)) {
    throw new ApiError(403, ErrorCode.forbidden, `This account lacks ${needed}`);
  }
  await next();
});
