import type { ServerPublic } from '@dyingstar/shared';
import {
  normalizeServerConfig,
  type ServerConfig,
  type ServerConfigRaw,
} from '../domain/server.types.js';
import { env } from './env.js';

/** Default scoped server when `X-Server-Id` is omitted (live test stack). */
export const DEFAULT_SERVER_ID = 'universe-testing';

/**
 * Parses the `SERVERS` environment variable JSON array.
 * @returns Raw server entries or empty array on parse failure.
 */
function parseRawServers(): ServerConfigRaw[] {
  const raw = process.env.SERVERS ?? '[]';
  try {
    return JSON.parse(raw) as ServerConfigRaw[];
  } catch {
    console.warn('Invalid SERVERS env, using empty list');
    return [];
  }
}

const serverConfigs: ServerConfig[] = parseRawServers().map((raw) =>
  normalizeServerConfig(raw, env.resourcesDynamic.baseUrl),
);

/**
 * @returns All configured game servers (backend-only config).
 */
export function getAllServers(): ServerConfig[] {
  return serverConfigs;
}

/**
 * @param id - Admin server identifier from `X-Server-Id`.
 * @returns Matching config or undefined.
 */
export function getServerById(id: string): ServerConfig | undefined {
  return serverConfigs.find((s) => s.id === id);
}

/**
 * @returns Default server for scoped routes when no `X-Server-Id` is sent.
 */
export function getDefaultServer(): ServerConfig | undefined {
  return getServerById(DEFAULT_SERVER_ID) ?? serverConfigs[0];
}

/**
 * @param server - Internal server config.
 * @returns Public DTO safe for the frontend.
 */
export function toPublicServer(server: ServerConfig): ServerPublic {
  return {
    id: server.id,
    name: server.name,
    url: server.url,
    environment: server.environment,
  };
}

/**
 * @returns Public server list for `GET /api/servers`.
 */
export function listPublicServers(): ServerPublic[] {
  return serverConfigs.map(toPublicServer);
}
