import {
  zMissionAsServed,
  zMissionCatalogue,
  zMissionDetailAsServed,
  type MissionCatalogueQuery,
} from '@dyingstar-admin/contracts/mission';
import type { ServiceTokenSource } from '../auth/serviceToken';
import { createUpstream } from './upstream';

export interface MissionClientOptions {
  /** `mission`'s base URL, without `/api` (e.g. `http://service-mission:3000`). */
  baseUrl: string;
  timeoutMs: number;
  /** Tokens of `svc-admin`, for its internal API (ADR 0023 › Mission). Unset, missions are off. */
  serviceToken?: ServiceTokenSource | undefined;
}

/**
 * HTTP client for `mission` (contract pinned in `@dyingstar-admin/contracts/mission`). Its README
 * has no Admin section: the catalogue, a mission's detail and its cancel are its Interne API, as
 * `svc-admin` (ADR 0023 › Mission, ADR 0028).
 */
export function createMissionClient({ baseUrl, timeoutMs, serviceToken }: MissionClientOptions) {
  const { internal, hasServiceToken } = createUpstream({
    name: 'Mission',
    baseUrl,
    timeoutMs,
    serviceToken,
  });

  return {
    /** Every mission, any status, newest first, without the players' zone and group filters. */
    catalogue: (query: MissionCatalogueQuery) =>
      internal('GET', '/missions', zMissionCatalogue, { query }),
    /** One mission whatever its visibility: objectives, every assignment, names from `social`. */
    detail: (id: string) =>
      internal('GET', `/missions/${encodeURIComponent(id)}`, zMissionDetailAsServed),
    /**
     * Cancels a mission and its active assignments, its escrow refunded to its payer
     * (`mission:write`, ADR 0028); `mission` refuses a completed one (409).
     */
    cancel: (id: string) =>
      internal('POST', `/missions/${encodeURIComponent(id)}/cancel`, zMissionAsServed),
    /** Whether the catalogue is configured (`svc-admin`'s secret). */
    readsCatalogue: hasServiceToken,
  };
}

export type MissionClient = ReturnType<typeof createMissionClient>;
