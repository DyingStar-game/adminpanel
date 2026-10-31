import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  ApproveDiscoveryBodySchema,
  DiscoveriesQuerySchema,
  DiscoveryDataSchema,
  DISCOVERY_TYPE,
  ErrorCode,
  PLACE_NAME_EVENTS,
  PlaceNameSchema,
  RefuseDiscoveryBodySchema,
  UuidSchema,
  type ApproveDiscoveryResponse,
  type DiscoveriesResponse,
  type DiscoveryData,
  type DiscoveryRow,
  type Item,
  type ObjectData,
  type Permission,
  type RefuseDiscoveryResponse,
} from '@dyingstar-admin/schemas';
import { requirePermission, type Session, type SessionContext } from '../auth/auth';
import type { InventoryClient } from '../clients/inventory';
import type { SocialClient } from '../clients/social';
import { ApiError } from '../lib/errors';
import { validate } from '../lib/validate';
import type { ItemsService } from '../services/items';

const UuidParams = z.object({ uuid: UuidSchema });

/** The services a decision tells, each optional (unset or without `svc-admin`: skipped). */
export interface ExplorationServices {
  social?: SocialClient | undefined;
  inventory?: InventoryClient | undefined;
}

/** Pending ones: oldest proposal first; the others: most recent decision (or discovery) first. */
function compareRows(status: string) {
  if (status === 'pending') {
    return (a: DiscoveryRow, b: DiscoveryRow) =>
      a.object_data.proposed_at - b.object_data.proposed_at ||
      a.object_data.discovered_at - b.object_data.discovered_at;
  }
  const at = (row: DiscoveryRow) => row.object_data.decided_at || row.object_data.discovered_at;
  return (a: DiscoveryRow, b: DiscoveryRow) => at(b) - at(a);
}

/** Whether the person holds `permission`; without authentication (tests) everything is held. */
const holds = (c: Context<SessionContext>, permission: Permission) => {
  const session = c.var.session as Session | undefined;
  return !session || session.permissions.includes(permission);
};

/** Runs a best-effort step after a decision: its failure is logged and reported as `false`. */
async function bestEffort(what: string, step: () => Promise<boolean>): Promise<boolean> {
  try {
    return await step();
  } catch (error) {
    console.error(`Exploration, ${what}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * The Exploration section (ADR 0032): the `discovery` items the game writes, one per place a
 * player discovered, and the review of the names they propose. Persistence cannot filter on a
 * field: every discovery is read (`allOfType`, the type need not be defined yet) and filtered
 * here. A decision is the item's update; renaming the discoverer's POI in `inventory` and telling
 * them through `social` come after it, as `svc-admin`, each reported rather than undoing it.
 * Reads need `persistence.read` (where mounted), decisions `persistence.write` and `social.notify`.
 */
export function explorationRoutes(items: ItemsService, { social, inventory }: ExplorationServices) {
  /** Every discovery, its data with the game's defaults. */
  const discoveries = async (): Promise<DiscoveryRow[]> =>
    (await items.allOfType(DISCOVERY_TYPE)).map((item) => ({
      uuid: item.object_uuid,
      object_data: DiscoveryDataSchema.parse(item.object_data),
    }));

  /** The discovery `uuid`, refused (409) unless its name awaits review. */
  async function pendingDiscovery(uuid: string): Promise<{ item: Item; data: DiscoveryData }> {
    const item = await items.get(uuid);
    if (item.object_type !== DISCOVERY_TYPE) {
      throw new ApiError(404, ErrorCode.notFound, `Item ${uuid} is not a discovery`);
    }
    const data = DiscoveryDataSchema.parse(item.object_data);
    if (data.status !== 'pending') {
      throw new ApiError(
        409,
        ErrorCode.discoveryNotPending,
        data.status === 'unnamed'
          ? 'No name was proposed for this place'
          : `The name of this place was already ${data.status}`,
      );
    }
    return { item, data };
  }

  /**
   * Saves a decision: only the decision's fields, merged on the latest version (ADR 0009).
   * `status` and `proposed_name` are sent as read too, so a change of either since the reading
   * answers `409 EDIT_CONFLICT` instead of deciding on another proposal.
   */
  const decide = (item: Item, base: ObjectData, changes: Record<string, unknown>) =>
    items.update(item.object_uuid, item.object_type, {
      base,
      changes: {
        ...('proposed_name' in base ? { proposed_name: base.proposed_name } : {}),
        ...changes,
      },
      removed: [],
      force: false,
    });

  /** Tells the discoverer, live and in their history, with the same type and data. */
  async function tellDiscoverer(
    c: Context<SessionContext>,
    playerId: string,
    type: string,
    data: Record<string, unknown>,
  ): Promise<{ notified: boolean; recorded: boolean }> {
    const reaches = Boolean(social?.manages && playerId);
    const [notified, recorded] = await Promise.all([
      reaches && holds(c, 'social.notify')
        ? bestEffort('notifying the discoverer', async () =>
            social ? (await social.notifyPlayer(playerId, { type, data })).delivered : false,
          )
        : false,
      reaches && holds(c, 'social.playerWrite')
        ? bestEffort("recording the discoverer's activity", async () => {
            await social?.recordActivity(playerId, { type, details: data });
            return true;
          })
        : false,
    ]);
    return { notified, recorded };
  }

  return new Hono<SessionContext>()
    .get('/discoveries', validate('query', DiscoveriesQuerySchema), async (c) => {
      const { status, kind, page, page_size } = c.req.valid('query');
      const all = await discoveries();
      const kinds = [
        ...new Set(all.map((row) => row.object_data.place_kind).filter(Boolean)),
      ].sort();
      const rows = all
        .filter(
          (row) =>
            row.object_data.status === status && (!kind || row.object_data.place_kind === kind),
        )
        .sort(compareRows(status));
      return c.json<DiscoveriesResponse>({
        discoveries: rows.slice((page - 1) * page_size, page * page_size),
        total: rows.length,
        page,
        page_size,
        kinds,
      });
    })
    .post(
      '/discoveries/:uuid/approve',
      // A decision writes persistence and tells the discoverer.
      requirePermission('persistence.write'),
      requirePermission('social.notify'),
      validate('param', UuidParams),
      validate('json', ApproveDiscoveryBodySchema),
      async (c) => {
        const { uuid } = c.req.valid('param');
        const body = c.req.valid('json');
        const { item } = await pendingDiscovery(uuid);
        // The proposal as the admin read it, unless they corrected it; the game's rule either way.
        const proposed = PlaceNameSchema.safeParse(
          DiscoveryDataSchema.parse(body.base).proposed_name,
        );
        const name = body.name ?? (proposed.success ? proposed.data : undefined);
        if (!name) {
          throw new ApiError(
            400,
            ErrorCode.validation,
            'The proposed name breaks the rule: give a corrected one',
          );
        }
        const updated = await decide(item, body.base, {
          status: 'approved',
          approved_name: name,
          decided_at: Math.floor(Date.now() / 1000),
        });
        const data = DiscoveryDataSchema.parse(updated.object_data);
        const event = { kind: data.place_kind, name, discoveryId: uuid };
        const [poiRenamed, told] = await Promise.all([
          data.poi_id && inventory?.readsPois && holds(c, 'inventory.poiManage')
            ? bestEffort("renaming the discoverer's POI", async () => {
                await inventory.updatePoi(data.poi_id, {
                  name,
                  metadata: {
                    kind: data.place_kind,
                    discovery_uuid: uuid,
                    place_uuid: data.place_uuid,
                    place_id: data.place_id,
                    uncharted: false,
                  },
                });
                return true;
              })
            : false,
          tellDiscoverer(c, data.discoverer_id, PLACE_NAME_EVENTS.approved, event),
        ]);
        return c.json<ApproveDiscoveryResponse>({ item: updated, poiRenamed, ...told });
      },
    )
    .post(
      '/discoveries/:uuid/refuse',
      // A decision writes persistence and tells the discoverer.
      requirePermission('persistence.write'),
      requirePermission('social.notify'),
      validate('param', UuidParams),
      validate('json', RefuseDiscoveryBodySchema),
      async (c) => {
        const { uuid } = c.req.valid('param');
        const { base, reason } = c.req.valid('json');
        const { item } = await pendingDiscovery(uuid);
        const updated = await decide(item, base, {
          status: 'refused',
          refusal_reason: reason,
          decided_at: Math.floor(Date.now() / 1000),
        });
        const data = DiscoveryDataSchema.parse(updated.object_data);
        const told = await tellDiscoverer(c, data.discoverer_id, PLACE_NAME_EVENTS.refused, {
          kind: data.place_kind,
          name: data.proposed_name,
          reason,
          discoveryId: uuid,
        });
        return c.json<RefuseDiscoveryResponse>({ item: updated, ...told });
      },
    );
}
