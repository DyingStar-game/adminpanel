import { z } from 'zod';
import { UuidSchema } from './common';
import { ItemSchema, ObjectDataSchema, ObjectTypeSchema, Vec3Schema } from './persistence';

/** Game server as exposed to the browser: never any internal URL (ADR 0011). */
export const PublicServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  environment: z.string(),
});
export type PublicServer = z.infer<typeof PublicServerSchema>;

export const ServersResponseSchema = z.object({ servers: z.array(PublicServerSchema) });

/** Header carrying the target game server on item routes. */
export const SERVER_HEADER = 'X-Server-Id';

/** `GET /api/items/:uuid/ancestors` — root first, closest parent last. */
export const AncestorsResponseSchema = z.object({
  ancestors: z.array(ItemSchema),
  /** Set when the chain stops on a `parent_id` that does not exist (orphan). */
  missingParentId: z.string().nullable(),
  /** True when the walk stopped on a cycle or on the depth guard. */
  truncated: z.boolean(),
});
export type AncestorsResponse = z.infer<typeof AncestorsResponseSchema>;

/** `GET /api/items/:uuid/children-counts`. */
export const ChildrenCountsResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  byType: z.array(z.object({ object_type: z.string(), total: z.number().int().positive() })),
  /** Children whose type has no definition (total minus the per-type counts). */
  other: z.number().int().nonnegative(),
});
export type ChildrenCountsResponse = z.infer<typeof ChildrenCountsResponseSchema>;

/** `POST /api/items/exists` — exact existence check used by the import (ADR 0004). */
export const ExistsRequestSchema = z.object({ uuids: z.array(z.string().min(1)).max(10000) });
export const ExistsResponseSchema = z.object({ existing: z.array(z.string()) });
export type ExistsResponse = z.infer<typeof ExistsResponseSchema>;

/** `GET /api/scenes` — `scenename` values in use, with their type and count. */
export const SceneUsageSchema = z.object({
  scenename: z.string(),
  object_type: z.string(),
  count: z.number().int().positive(),
});
export type SceneUsage = z.infer<typeof SceneUsageSchema>;
export const ScenesResponseSchema = z.object({ scenes: z.array(SceneUsageSchema) });

/**
 * `PUT /api/items/:uuid` — field-level merge on top of the latest stored version (ADR 0009).
 * `base` is the `object_data` the user started editing from; `changes` holds the top-level keys
 * set by the user, `removed` the top-level keys they deleted.
 */
export const UpdateItemRequestSchema = z.object({
  object_type: ObjectTypeSchema,
  base: ObjectDataSchema,
  changes: z.record(z.string(), z.unknown()).default({}),
  removed: z.array(z.string()).default([]),
  /** Apply the user's values even on keys the game changed meanwhile. */
  force: z.boolean().default(false),
});
export type UpdateItemRequest = z.input<typeof UpdateItemRequestSchema>;

/** A key changed both by the user and, since `base`, in the stored item. */
export const EditConflictSchema = z.object({
  key: z.string(),
  base: z.unknown(),
  latest: z.unknown(),
  mine: z.unknown(),
});
export type EditConflict = z.infer<typeof EditConflictSchema>;

export const EditConflictDetailsSchema = z.object({
  conflicts: z.array(EditConflictSchema),
  latest: ItemSchema,
});

/** `POST /api/items` body (same as persistence, UUID required). */
export const CreateItemRequestSchema = z.object({
  object_type: ObjectTypeSchema,
  object_uuid: UuidSchema,
  object_data: ObjectDataSchema,
});

/** `POST /api/items/:uuid/duplicate` (ADR 0017). */
export const DuplicateRequestSchema = z.object({
  /** Parent of the copy (positions are relative to it). */
  parent_id: z.string(),
  position: Vec3Schema.optional(),
  rotation: Vec3Schema.optional(),
  /** Copy the children too, recursively (references remapped). */
  children: z.boolean().default(true),
});
export type DuplicateRequest = z.input<typeof DuplicateRequestSchema>;

/** Created copies, the root first, parents before children. */
export const DuplicateResponseSchema = z.object({ created: z.array(ItemSchema) });

/**
 * Types drawn on a body map through their parent (players in their building) rather than as
 * direct children of the body (ADR 0018).
 */
export const MAP_PLACED_THROUGH_PARENT = ['player'];

/** One item on a body map (ADR 0018). */
export const MapPointSchema = z.object({
  object_uuid: z.string(),
  object_type: z.string(),
  /** `object_data.name`, when set. */
  name: z.string().nullable(),
  /** Parent placing the item, when it is not the body itself (a player's building). */
  via: z.string().nullable(),
  /** Degrees, assuming +Y is the pole and longitude 0 the +Z direction. */
  lat: z.number(),
  lon: z.number(),
  /** Metres above the reference radius. */
  altitude: z.number(),
  /** Projected position in metres (azimuthal equidistant, centred on the map centre): east, north. */
  x: z.number(),
  y: z.number(),
});
export type MapPoint = z.infer<typeof MapPointSchema>;

/** `GET /api/bodies/:uuid/map` (ADR 0018). */
export const BodyMapResponseSchema = z.object({
  body: z.object({ object_uuid: z.string(), object_type: z.string(), name: z.string().nullable() }),
  /** Median distance of the body's surface children to its centre, in metres (0 if none). */
  referenceRadius: z.number(),
  /** Map centre (centroid of the drawn points). */
  center: z.object({ lat: z.number(), lon: z.number() }),
  points: z.array(MapPointSchema),
  /** Items too high above the surface to be drawn (stations…). */
  inOrbit: z.array(MapPointSchema),
});
export type BodyMapResponse = z.infer<typeof BodyMapResponseSchema>;
