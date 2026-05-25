import fetch from 'node-fetch';
import type { HorizonInstanceInfo } from '@dyingstar/shared';
import { env } from '../config/env.js';
import { isMockUrl } from '../services/mockPersistence.js';

export interface ActiveHorizonsResult {
  count: number;
  instances: HorizonInstanceInfo[];
  reachable: boolean;
}

/**
 * Resolves the mesh API path for a given admin server id.
 * @param serverId - Value from `X-Server-Id`.
 * @param baseUrl - service-resourcesdynamic HTTP base.
 * @returns Fully qualified URL.
 */
function buildActiveHorizonsUrl(serverId: string, baseUrl: string): string {
  const path = env.resourcesDynamic.activeHorizonsPath.replace('{serverId}', encodeURIComponent(serverId));
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Normalizes heterogeneous API payloads into a count + instance list.
 * Supports `{ count }`, `{ active }`, `{ instances: [] }`, or a raw array.
 */
function parseActiveHorizonsPayload(data: unknown): { count: number; instances: HorizonInstanceInfo[] } {
  if (Array.isArray(data)) {
    const instances = data.map(normalizeInstance).filter(Boolean) as HorizonInstanceInfo[];
    return { count: instances.length, instances };
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.instances)) {
      const instances = obj.instances.map(normalizeInstance).filter(Boolean) as HorizonInstanceInfo[];
      return { count: instances.length, instances };
    }
    if (Array.isArray(obj.horizons)) {
      const instances = obj.horizons.map(normalizeInstance).filter(Boolean) as HorizonInstanceInfo[];
      return { count: instances.length, instances };
    }
    if (typeof obj.count === 'number') {
      return { count: obj.count, instances: [] };
    }
    if (typeof obj.active === 'number') {
      return { count: obj.active, instances: [] };
    }
  }
  return { count: 0, instances: [] };
}

/**
 * Maps a single instance object from the mesh API to {@link HorizonInstanceInfo}.
 */
function normalizeInstance(entry: unknown): HorizonInstanceInfo | null {
  if (!entry || typeof entry !== 'object') return null;
  const o = entry as Record<string, unknown>;
  const id = String(o.id ?? o.instanceId ?? o.horizonId ?? o.name ?? '');
  if (!id) return null;
  return {
    id,
    status: String(o.status ?? o.state ?? 'unknown'),
    host: o.host != null ? String(o.host) : undefined,
    port: typeof o.port === 'number' ? o.port : undefined,
  };
}

export const resourcesDynamicClient = {
  /**
   * Queries service-resourcesdynamic for active Horizon instances of a game server.
   * Returns mock data when the URL is a dev mock or the service is unreachable.
   */
  async getActiveHorizons(serverId: string, baseUrl?: string): Promise<ActiveHorizonsResult> {
    const url = baseUrl ?? env.resourcesDynamic.baseUrl;
    if (isMockUrl(url) || !url) {
      return { count: 1, instances: [{ id: 'mock-horizon-1', status: 'running' }], reachable: false };
    }

    const requestUrl = buildActiveHorizonsUrl(serverId, url);
    try {
      const res = await fetch(requestUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.warn(`resourcesDynamic ${res.status} for ${requestUrl}`);
        return { count: 0, instances: [], reachable: false };
      }
      const data = await res.json();
      const parsed = parseActiveHorizonsPayload(data);
      return { ...parsed, reachable: true };
    } catch (err) {
      console.warn(`resourcesDynamic unreachable (${requestUrl}):`, (err as Error).message);
      return { count: 0, instances: [], reachable: false };
    }
  },

  /**
   * HTTP health ping against the mesh service root or /health.
   */
  async ping(baseUrl?: string): Promise<{ ok: boolean; latencyMs: number }> {
    const root = (baseUrl ?? env.resourcesDynamic.baseUrl).replace(/\/$/, '');
    const start = Date.now();
    for (const path of ['/health', '/']) {
      try {
        const res = await fetch(`${root}${path}`, { signal: AbortSignal.timeout(3000) });
        if (res.ok || res.status < 500) {
          return { ok: true, latencyMs: Date.now() - start };
        }
      } catch {
        /* try next path */
      }
    }
    return { ok: false, latencyMs: Date.now() - start };
  },
};
