/**
 * Backend-only server configuration (cluster service URLs).
 * Never serialized to the frontend as-is; use {@link ServerPublic} via config/servers.
 */

/** Full server configuration including internal service endpoints. */
export interface ServerConfig {
  id: string;
  name: string;
  /** Public or logical game server URL shown in the UI. */
  url: string;
  services: {
    /** HTTP API for persistence items (service-persistence httpPort, typically 3001). */
    persistence: string;
    /** WebSocket for player presence (service-persistence ws or godotserver). */
    websocket: string;
    keycloakRealm: string;
    /**
     * service-resourcesdynamic HTTP base URL (mesh orchestrator).
     * Falls back to global `RESOURCES_DYNAMIC_URL` when omitted.
     */
    resourcesDynamic?: string;
    /** Optional godotserver HTTP/WS base for dedicated Godot process metrics. */
    godotserver?: string;
    /** Optional horizon service base (e.g. http://horizon:7040) for connectivity probes. */
    horizon?: string;
  };
}

/** Raw server entry shape as stored in the `SERVERS` env JSON. */
export interface ServerConfigRaw {
  id: string;
  name: string;
  url?: string;
  persistenceUrl: string;
  wsUrl: string;
  keycloakRealm: string;
  resourcesDynamicUrl?: string;
  godotserverUrl?: string;
  horizonUrl?: string;
}

/**
 * Normalizes env JSON into the canonical {@link ServerConfig} structure.
 * @param raw - Parsed entry from `SERVERS`.
 * @param defaultResourcesDynamic - Cluster-wide mesh URL when per-server value is absent.
 * @returns Normalized server configuration.
 */
export function normalizeServerConfig(
  raw: ServerConfigRaw,
  defaultResourcesDynamic?: string,
): ServerConfig {
  return {
    id: raw.id,
    name: raw.name,
    url: raw.url ?? raw.persistenceUrl,
    services: {
      persistence: raw.persistenceUrl,
      websocket: raw.wsUrl,
      keycloakRealm: raw.keycloakRealm,
      resourcesDynamic: raw.resourcesDynamicUrl ?? defaultResourcesDynamic,
      godotserver: raw.godotserverUrl,
      horizon: raw.horizonUrl,
    },
  };
}
