import { z } from 'zod';

/**
 * What the panel reads of `inventory`, written from its code (`db/schema/pois.ts`,
 * `services/pois.service.ts`, `routes/internal.routes.ts`, read 2026-10-23 at `develop`
 * `bdee3c0`): its OpenAPI cannot be parsed (question 21 of the lot 2 plan). Hand-written, as
 * `mission/code.ts`.
 */

const zTimestamp = z.iso.datetime({ offset: true });

/** Who owns a POI (`POI_OWNER_TYPES`): wider than the goods holders. */
export const zPoiOwnerType = z.enum([
  'player',
  'npc',
  'corporation',
  'political',
  'system',
  'mission',
]);

/**
 * A point of interest (`inventory_pois`): x / y / z in metres in the frame of the body named by
 * `scene` (from its centre; `space` = the system's frame), widened into a zone by `radiusM`.
 */
export const zPoi = z.object({
  id: z.guid(),
  ownerType: zPoiOwnerType,
  ownerId: z.guid(),
  name: z.string(),
  description: z.string().nullable(),
  /** Star system; `null` = unscoped (`""` is legacy). */
  system: z.string().nullable(),
  /** Body or sub-scene (`tarsis_3`, `tarsis_3/new-haven`): the frame of x / y / z. */
  scene: z.string().nullable(),
  /**
   * Its parent POI: its code checks that POI exists and walks the chain (`POI_PARENT_NOT_FOUND`,
   * `POI_PARENT_CYCLE`), although its README and table call it a persistence object (lot 2 plan,
   * question 22).
   */
  parentId: z.guid().nullable(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  /** `null` = a point. */
  radiusM: z.number().nullable(),
  visibility: z.enum(['private', 'public']),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdBy: z.guid().nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type Poi = z.infer<typeof zPoi>;

/** `GET /api/internal/pois/:poiId` (`inventory:read`): the POI and its read-only grants. */
export const zPoiView = zPoi.extend({
  shares: z.array(
    z.object({
      poiId: z.guid(),
      granteeType: z.enum(['player', 'npc', 'corporation', 'political']),
      granteeId: z.guid(),
      /** The player who made the grant. */
      sharedBy: z.guid().nullable(),
      createdAt: zTimestamp,
    }),
  ),
});
export type PoiView = z.infer<typeof zPoiView>;

/** `POST /api/internal/pois` (`inventory:poi:manage`, the seed): the owner is explicit. */
export const zCreatePoi = z.object({
  owner: z.object({ type: zPoiOwnerType, id: z.guid() }),
  name: z.string().min(1).max(128),
  description: z.string().max(2000).optional(),
  system: z.string().max(64).optional(),
  scene: z.string().max(128).optional(),
  parentId: z.guid().optional(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  radiusM: z.number().min(0).max(1_000_000).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  /** Free data (the seed notes the persistence object a POI stands on). */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreatePoi = z.infer<typeof zCreatePoi>;
