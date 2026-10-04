import { UuidSchema, type Item, type ObjectData, type Vec3 } from '@dyingstar-admin/schemas';

export interface DuplicateTarget {
  parentId: string;
  position?: Vec3 | undefined;
  rotation?: Vec3 | undefined;
  /** Fields left out of the copies, per `object_type` (state of the moment). */
  omit?: Record<string, string[]> | undefined;
}

/**
 * Copies of an item and its descendants (ADR 0017), the root first. Each item gets a new UUID;
 * references to items of the set are remapped, references to anything else are emptied, and
 * the fields `omit` lists for its type (state of the moment) are left out.
 * `items` must start with the root, parents before their children.
 */
export function planDuplicate(
  items: Item[],
  target: DuplicateTarget,
  newUuid: () => string = () => crypto.randomUUID(),
): Item[] {
  const ids = new Map(items.map((item) => [item.object_uuid, newUuid()]));

  const remap = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (ids.has(value)) return ids.get(value);
      // A UUID outside the copied set (pilot, passenger…): the copy does not keep the link.
      return UuidSchema.safeParse(value).success ? '' : value;
    }
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)]));
    }
    return value;
  };

  return items.map((item, index) => {
    const omitted = new Set(target.omit?.[item.object_type] ?? []);
    const data = Object.fromEntries(
      Object.entries(remap(item.object_data) as ObjectData).filter(([key]) => !omitted.has(key)),
    ) as ObjectData;
    if (index === 0) {
      data.parent_id = target.parentId;
      if (target.position) data.position = target.position;
      if (target.rotation) data.rotation = target.rotation;
    }
    return {
      object_type: item.object_type,
      object_uuid: ids.get(item.object_uuid) as string,
      object_data: data,
    };
  });
}
