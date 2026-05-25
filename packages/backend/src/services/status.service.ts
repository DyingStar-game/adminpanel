/**
 * Aggregated dashboard status and per-server connectivity probes.
 */
import type { ConnectivityResponse, StatusResponse } from '@dyingstar/shared';
import { getAllServers, getServerById } from '../config/servers.js';
import { env } from '../config/env.js';
import { persistenceClient } from '../clients/persistence.client.js';
import { wsClient } from '../clients/ws.client.js';
import { pingHttp } from '../clients/http.client.js';
import { resourcesDynamicClient } from '../clients/resourcesDynamic.client.js';
import type { ServerConfig } from '../domain/server.types.js';

/**
 * Resolves the mesh base URL for a server (per-server override or global default).
 */
function meshBaseUrl(server: ServerConfig): string | undefined {
  return server.services.resourcesDynamic ?? env.resourcesDynamic.baseUrl;
}

/**
 * Builds global status: Horizon counts via resourcesdynamic, players via WS, items via persistence.
 * @param activeServerId - Optional server id from `X-Server-Id` for scoped metrics.
 */
export async function getGlobalStatus(activeServerId?: string): Promise<StatusResponse> {
  const servers = getAllServers();
  const playersByServer: Record<string, number> = {};
  const activeHorizonByServer: Record<string, number> = {};
  let connectedPlayers = 0;
  let resourcesDynamicReachable = false;

  await Promise.all(
    servers.map(async (server) => {
      const [players, horizons] = await Promise.all([
        wsClient.countPlayers(server.services.websocket),
        resourcesDynamicClient.getActiveHorizons(server.id, meshBaseUrl(server)),
      ]);
      playersByServer[server.name] = players;
      activeHorizonByServer[server.name] = horizons.count;
      connectedPlayers += players;
      if (horizons.reachable) resourcesDynamicReachable = true;
    }),
  );

  const active = activeServerId ? getServerById(activeServerId) : servers[0];
  const itemsCount = active ? await persistenceClient.count(active.services.persistence) : 0;

  let activeHorizonCount = 0;
  let horizonInstances: StatusResponse['horizonInstances'] = [];

  if (active) {
    const horizons = await resourcesDynamicClient.getActiveHorizons(active.id, meshBaseUrl(active));
    activeHorizonCount = horizons.count;
    horizonInstances = horizons.instances;
    if (horizons.reachable) resourcesDynamicReachable = true;
  }

  return {
    activeHorizonCount,
    activeHorizonByServer,
    horizonInstances,
    resourcesDynamicReachable,
    connectedPlayers,
    playersByServer,
    itemsCount,
    /** @deprecated Use activeHorizonCount — kept for older clients */
    godotProcesses: activeHorizonCount,
  };
}

/**
 * Probes persistence, Keycloak, websocket, mesh, and optional horizon HTTP for one server.
 */
export async function testServerConnectivity(server: ServerConfig): Promise<ConnectivityResponse> {
  const meshUrl = meshBaseUrl(server);
  const [persistence, auth, realtime, mesh, horizon] = await Promise.all([
    pingHttp(server.services.persistence),
    pingHttp(`${env.keycloak.baseUrl}/realms/${server.services.keycloakRealm}`),
    wsClient.ping(server.services.websocket),
    meshUrl ? resourcesDynamicClient.ping(meshUrl) : Promise.resolve({ ok: false, latencyMs: 0 }),
    server.services.horizon ? pingHttp(server.services.horizon) : Promise.resolve({ ok: true, latencyMs: 0 }),
  ]);
  return { persistence, auth, realtime, mesh, horizon };
}
