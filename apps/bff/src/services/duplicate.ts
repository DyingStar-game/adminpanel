import type { Item, ObjectData, Vec3 } from '@dyingstar-admin/schemas';

export interface DuplicateTarget {
  parentId: string;
  position?: Vec3 | undefined;
  rotation?: Vec3 | undefined;
}

/** What a new item carries, as the create form writes it (the game sets the rest). */
const NEW_ITEM_FIELDS = ['type', 'uuid', 'parent_id', 'scenename', 'position', 'rotation'];

/**
 * Copies of an item and its descendants (ADR 0017), the root first, each written like a new
 * item: its identity, parent, scene, position and rotation, nothing of its state of the moment
 * (a copied suspension sank duplicated trucks into the ground). What binds the copies together
 * is kept: references to items of the set, remapped to their copies (a truck's
 * `components.slot_fl`), and a child's place in its parent, the field whose value is the key
 * under which the parent refers to it (the component's `slot_id: "slot_fl"`).
 * `items` must start with the root, parents before their children.
 */
export function planDuplicate(
  items: Item[],
  target: DuplicateTarget,
  newUuid: () => string = () => crypto.randomUUID(),
): Item[] {
  const ids = new Map(items.map((item) => [item.object_uuid, newUuid()]));

  // Keys under which an item of the set is referred to by another (`slot_fl` for a component).
  const places = new Map<string, Set<string>>();
  const collect = (value: unknown, key?: string) => {
    if (typeof value === 'string' && ids.has(value) && key) {
      places.set(value, (places.get(value) ?? new Set()).add(key));
    } else if (Array.isArray(value)) value.forEach((v) => collect(v, key));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) collect(v, k);
    }
  };
  for (const item of items) collect(item.object_data);

  // Only the parts of a value that refer to copied items, remapped; undefined when none.
  const links = (value: unknown): unknown => {
    if (typeof value === 'string') return ids.get(value);
    if (Array.isArray(value)) {
      const kept = value.map(links).filter((v) => v !== undefined);
      return kept.length > 0 ? kept : undefined;
    }
    if (value && typeof value === 'object') {
      const kept = Object.entries(value)
        .map(([k, v]) => [k, links(v)] as const)
        .filter(([, v]) => v !== undefined);
      return kept.length > 0 ? Object.fromEntries(kept) : undefined;
    }
    return undefined;
  };

  return items.map((item, index) => {
    const source = item.object_data;
    const copy = ids.get(item.object_uuid) as string;
    const place = places.get(item.object_uuid);
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (key === 'uuid') data.uuid = copy;
      else if (key === 'parent_id') data.parent_id = ids.get(value as string) ?? value;
      else if (NEW_ITEM_FIELDS.includes(key)) data[key] = value;
      else if (typeof value === 'string' && place?.has(value)) data[key] = value;
      else {
        const linked = links(value);
        if (linked !== undefined) data[key] = linked;
      }
    }
    if (index === 0) {
      data.parent_id = target.parentId;
      if (target.position) data.position = target.position;
      if (target.rotation) data.rotation = target.rotation;
    }
    return { object_type: item.object_type, object_uuid: copy, object_data: data as ObjectData };
  });
}
