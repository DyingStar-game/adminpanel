/**
 * Keycloak Admin API integration with mock users when credentials are absent.
 */
import fetch from 'node-fetch';
import type { AdminUser } from '@dyingstar/shared';
import { env } from '../config/env.js';

let cachedToken: { token: string; expires: number } | null = null;

/**
 * Whether Keycloak admin client credentials are configured.
 * @returns True if `KEYCLOAK_ADMIN_SECRET` is set.
 */
export function isKeycloakConfigured(): boolean {
  return Boolean(env.keycloak.secret);
}

/**
 * Obtains a client-credentials access token for the given realm (cached until expiry).
 * @param realm - Keycloak realm name.
 * @returns Bearer token, or null if not configured or request fails.
 */
async function getAdminToken(realm: string): Promise<string | null> {
  if (!isKeycloakConfigured()) return null;

  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

  const url = `${env.keycloak.baseUrl}/realms/${realm}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.keycloak.clientId,
    client_secret: env.keycloak.secret,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: data.access_token,
      expires: Date.now() + data.expires_in * 1000 - 60000,
    };
    return data.access_token;
  } catch {
    return null;
  }
}

const MOCK_USERS: AdminUser[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@dyingstar-game.com',
    enabled: true,
    roles: ['admin', 'moderator'],
    firstName: 'Admin',
    lastName: 'DyingStar',
  },
  {
    id: '2',
    username: 'player_demo',
    email: 'demo@dyingstar-game.com',
    enabled: true,
    roles: ['player'],
    firstName: 'Demo',
    lastName: 'Player',
  },
];

/**
 * Lists users in a Keycloak realm (falls back to mock users without admin token).
 * @param realm - Keycloak realm name.
 * @returns Admin user records.
 */
export async function listUsers(realm: string): Promise<AdminUser[]> {
  const token = await getAdminToken(realm);
  if (!token) return MOCK_USERS;

  try {
    const res = await fetch(
      `${env.keycloak.baseUrl}/admin/realms/${realm}/users?max=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return MOCK_USERS;
    const users = (await res.json()) as Array<{
      id: string;
      username: string;
      email: string;
      enabled: boolean;
      firstName?: string;
      lastName?: string;
    }>;
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email ?? '',
      enabled: u.enabled,
      roles: ['player'],
      firstName: u.firstName,
      lastName: u.lastName,
    }));
  } catch {
    return MOCK_USERS;
  }
}

/**
 * Fetches a single user by id from the realm user list.
 * @param realm - Keycloak realm name.
 * @param id - User id.
 * @returns User record, or null if not found.
 */
export async function getUser(realm: string, id: string): Promise<AdminUser | null> {
  const users = await listUsers(realm);
  return users.find((u) => u.id === id) ?? null;
}

/**
 * Updates role names on a user (in-memory when using mock data).
 * @param realm - Keycloak realm name.
 * @param id - User id.
 * @param roles - New role name list.
 * @returns Updated user, or null if not found.
 */
export async function updateUserRoles(
  realm: string,
  id: string,
  roles: string[],
): Promise<AdminUser | null> {
  const user = await getUser(realm, id);
  if (!user) return null;
  user.roles = roles;
  return user;
}

/**
 * Enables or disables a user via Keycloak Admin API when configured.
 * @param realm - Keycloak realm name.
 * @param id - User id.
 * @param enabled - Desired enabled flag.
 * @returns Updated user, or null if not found.
 */
export async function setUserEnabled(
  realm: string,
  id: string,
  enabled: boolean,
): Promise<AdminUser | null> {
  const token = await getAdminToken(realm);
  const user = await getUser(realm, id);
  if (!user) return null;

  if (token) {
    await fetch(`${env.keycloak.baseUrl}/admin/realms/${realm}/users/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    });
  }
  user.enabled = enabled;
  return user;
}
