import type { ServerPublic } from '@dyingstar/shared';
import {
  normalizeServerConfig,
  type ServerConfig,
  type ServerConfigRaw,
} from '../domain/server.types.js';
import { env } from './env.js';

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
 * @param server - Internal server config.
 * @returns Public DTO safe for the frontend.
 */
export function toPublicServer(server: ServerConfig): ServerPublic {
  return { id: server.id, name: server.name, url: server.url };
}

/**
 * @returns Public server list for `GET /api/servers`.
 */
export function listPublicServers(): ServerPublic[] {
  return serverConfigs.map(toPublicServer);
}
