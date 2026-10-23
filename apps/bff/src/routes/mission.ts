import { Hono } from 'hono';
import { z } from 'zod';
import {
  type MissionDetailAsServed,
  type MissionPage,
  zMissionCatalogueQuery,
} from '@dyingstar-admin/contracts/mission';
import { requirePermission, type Session, type SessionContext } from '../auth/auth';
import type { InventoryClient } from '../clients/inventory';
import type { MissionClient } from '../clients/mission';
import { fromQuery, validate } from '../lib/validate';

const IdParams = z.object({ id: z.uuid() });

/** A POI as `mission`'s objective kinds take it in their `params` (`{ kind: 'poi', poiId }`). */
const PoiRef = z.object({ kind: z.literal('poi'), poiId: z.uuid() });

/** The POIs a mission's objectives point at (`zone`, `source`…), each once. */
export function objectivePoiIds(detail: MissionDetailAsServed): string[] {
  const ids = detail.objectives.flatMap((objective) =>
    Object.values(objective.params ?? {}).flatMap((value) => {
      const ref = PoiRef.safeParse(value);
      return ref.success ? [ref.data.poiId] : [];
    }),
  );
  return [...new Set(ids)];
}

/**
 * `mission` (ADR 0024 step O), read only: its catalogue and a mission's detail through its
 * internal API as `svc-admin`, for the capability role of its README, `mission:read` (ADR 0023 ›
 * Mission). A mission's page also names its objectives' POIs, read from `inventory` for who holds
 * `inventory:read` (ADR 0026); when `inventory` does not answer, the page comes without them.
 */
export function missionRoutes(mission: MissionClient, inventory?: InventoryClient) {
  return new Hono<SessionContext>()
    .use(requirePermission('mission.read'))
    .get('/missions', validate('query', fromQuery(zMissionCatalogueQuery)), async (c) =>
      c.json(await mission.catalogue(c.req.valid('query'))),
    )
    .get('/missions/:id', validate('param', IdParams), async (c) => {
      const detail = await mission.detail(c.req.valid('param').id);
      // Without authentication (tests) there is no session and every permission is held.
      const session = c.var.session as Session | undefined;
      const readsPlaces =
        inventory?.readsPois && (!session || session.permissions.includes('inventory.read'));
      const ids = objectivePoiIds(detail);
      if (!readsPlaces || ids.length === 0) return c.json<MissionPage>(detail);
      const places = await inventory.places(ids).catch((error: unknown) => {
        console.error(
          'Inventory, POIs of a mission:',
          error instanceof Error ? error.message : error,
        );
        return undefined;
      });
      return c.json<MissionPage>(places ? { ...detail, places } : detail);
    });
}
