import type { Item } from '@dyingstar-admin/schemas';

/** Human label of an item: its name, else its slot, else type + short UUID. */
export function itemLabel(item: Item): string {
  const { name, slot_id } = item.object_data;
  if (typeof name === 'string' && name) return name;
  if (typeof slot_id === 'string' && slot_id) return slot_id;
  return `${item.object_type} ${item.object_uuid.slice(0, 8)}`;
}

export const shortUuid = (uuid: string) => uuid.slice(0, 8);
