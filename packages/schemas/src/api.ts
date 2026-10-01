import { z } from 'zod';
import { UuidSchema } from './common';
import { ItemSchema, ObjectDataSchema, ObjectTypeSchema } from './persistence';

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
