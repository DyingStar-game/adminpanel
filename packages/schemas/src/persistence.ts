import { z } from 'zod';
import { UuidSchema } from './common';

/**
 * Persistence REST contract (DyingStar-game/services, persistence/openapi.yaml, develop@9caf502),
 * adjusted to the behaviour observed on the live service (ADR 0003).
 */

/** 3-D vector used by `position` / `rotation`. */
export const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Vec3 = z.infer<typeof Vec3Schema>;

/** Quaternion, used by `rotations[]` on planets and stars. */
export const QuaternionSchema = z.object({
  w: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Quaternion = z.infer<typeof QuaternionSchema>;

/**
 * Free-form item data. Well-known keys are typed loosely on purpose: roots carry
 * `parent_id: ""`, and any other key may hold any JSON value.
 */
export const ObjectDataSchema = z.looseObject({
  parent_id: z.string().nullable().optional(),
  scenename: z.string().nullable().optional(),
  name: z.string().optional(),
});
export type ObjectData = z.infer<typeof ObjectDataSchema>;

export const ObjectTypeSchema = z.string().min(1, 'object_type is required');

/** An item as returned by persistence. */
export const ItemSchema = z.object({
  object_type: ObjectTypeSchema,
  object_uuid: z.string().min(1),
  object_data: ObjectDataSchema,
});
export type Item = z.infer<typeof ItemSchema>;

export const PaginatedItemsSchema = z.object({
  items: z.array(ItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  page_size: z.number().int(),
});
export type PaginatedItems = z.infer<typeof PaginatedItemsSchema>;

/** Body of `POST /items` (the UUID is client-assigned). */
export const CreateItemSchema = z.object({
  object_type: ObjectTypeSchema,
  object_uuid: UuidSchema,
  object_data: ObjectDataSchema,
});
export type CreateItem = z.infer<typeof CreateItemSchema>;

/** Body of `PUT /items/{uuid}` (full replace). */
export const ReplaceItemSchema = z.object({
  object_type: ObjectTypeSchema,
  object_data: ObjectDataSchema,
});
export type ReplaceItem = z.infer<typeof ReplaceItemSchema>;

/** Query of `GET /items`: exact-match filters, 1-based pagination (max 10000 per page). */
export const ListItemsQuerySchema = z.object({
  object_type: z.string().min(1).optional(),
  parent_id: z.string().optional(),
  scenename: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(10000).default(100),
});
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;

/**
 * Object type restricted to an allowed list. The list is dynamic — it comes from the
 * `*_def.json` definitions (ADR 0006) — so the schema is built at runtime, not hard-coded.
 * An empty list means "no restriction".
 */
export function createObjectTypeSchema(allowed: readonly string[]) {
  if (allowed.length === 0) return ObjectTypeSchema;
  return z.enum(allowed as [string, ...string[]], {
    error: (issue) => `Unknown object_type ${JSON.stringify(issue.input)}`,
  });
}

/** `ListItemsQuerySchema` whose `object_type` filter only accepts the allowed types. */
export function createListItemsQuerySchema(allowedTypes: readonly string[]) {
  return ListItemsQuerySchema.extend({
    object_type: createObjectTypeSchema(allowedTypes).optional(),
  });
}

/** Error body of the persistence service. */
export const PersistenceErrorSchema = z.object({ error: z.string() });
