import type { Item } from '@dyingstar-admin/schemas';
import { profileFor } from './profiles';

/** Human label of an item: its name, else its slot, else type + short UUID. */
export function itemLabel(item: Item): string {
  const { name, slot_id } = item.object_data;
  if (typeof name === 'string' && name) return name;
  if (typeof slot_id === 'string' && slot_id) return slot_id;
  return `${item.object_type} ${item.object_uuid.slice(0, 8)}`;
}

export const shortUuid = (uuid: string) => uuid.slice(0, 8);

/**
 * The item whose name completes this one's label (its profile's `labelSuffix`: a depot's
 * village), or undefined when its type has none or the reference is empty.
 */
export function labelSuffixRef(item: Item): string | undefined {
  const path = profileFor(item.object_type)?.labelSuffix;
  const value = path ? item.object_data[path] : undefined;
  return typeof value === 'string' && value ? value : undefined;
}

/** `cargo_depot (M0001)`: a label completed with what the item belongs to, once that is known. */
export const labelWithSuffix = (label: string, suffix: string | undefined): string =>
  suffix ? `${label} (${suffix})` : label;
