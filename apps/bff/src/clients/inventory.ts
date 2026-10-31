import { LRUCache } from 'lru-cache';
import { type Poi, type UpdatePoi, zPoi } from '@dyingstar-admin/contracts/inventory';
import type { ServiceTokenSource } from '../auth/serviceToken';
import { ApiError } from '../lib/errors';
import { createUpstream } from './upstream';

export interface InventoryClientOptions {
  /** `inventory`'s base URL, without `/api` (e.g. `http://service-inventory:3000`). */
  baseUrl: string;
  timeoutMs: number;
  /** Tokens of `svc-admin`, for its internal API (ADR 0023 › Inventory). Unset, POIs are off. */
  serviceToken?: ServiceTokenSource | undefined;
}

/** A POI read a minute ago is shown as is: a mission's places rarely move (ADR 0026). */
const POI_TTL_MS = 60_000;

/**
 * HTTP client for `inventory` (contract in `@dyingstar-admin/contracts/inventory`): the POIs a
 * mission's objectives point at, through its Interne API as `svc-admin` (`inventory:read`,
 * ADR 0026), and a discoverer's POI renamed with an approved place name (`inventory:poi:manage`,
 * ADR 0032).
 */
export function createInventoryClient({
  baseUrl,
  timeoutMs,
  serviceToken,
}: InventoryClientOptions) {
  const { internal, hasServiceToken } = createUpstream({
    name: 'Inventory',
    baseUrl,
    timeoutMs,
    serviceToken,
  });
  // `null` when `inventory` has no such POI, kept as long as a found one.
  const pois = new LRUCache<string, { poi: Poi | null }>({ max: 2000, ttl: POI_TTL_MS });

  async function poi(id: string): Promise<Poi | null> {
    const cached = pois.get(id);
    if (cached) return cached.poi;
    // The POI without its grants (`zPoi` leaves `shares` out).
    const found = await internal('GET', `/pois/${encodeURIComponent(id)}`, zPoi).catch(
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      },
    );
    pois.set(id, { poi: found });
    return found;
  }

  return {
    /** Each POI by id, `null` for an unknown one; throws when `inventory` does not answer. */
    places: async (ids: string[]) =>
      Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await poi(id)] as const))),
    /** Edits a POI (its name, metadata…); `inventory` answers 404 for an unknown one. */
    updatePoi: async (id: string, body: UpdatePoi): Promise<Poi> => {
      const updated = await internal('PATCH', `/pois/${encodeURIComponent(id)}`, zPoi, { body });
      pois.delete(id);
      return updated;
    },
    /** Whether POIs can be read, and edited (`svc-admin`'s secret). */
    readsPois: hasServiceToken,
  };
}
export type InventoryClient = ReturnType<typeof createInventoryClient>;
