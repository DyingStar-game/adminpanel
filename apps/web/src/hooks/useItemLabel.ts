import type { Item } from '@dyingstar-admin/schemas';
import { itemLabel, labelSuffixRef, labelWithSuffix } from '@/lib/itemLabel';
import { useItem } from './queries';

/**
 * An item's label where many of its type share one name: completed with the name of what it
 * belongs to (its profile's `labelSuffix`), read once it is on screen. `cargo_depot (M0001)`;
 * the name alone for the other types, and until the reference is read.
 */
export function useItemLabel(item: Item): string {
  const target = useItem(labelSuffixRef(item));
  return labelWithSuffix(itemLabel(item), target.data ? itemLabel(target.data) : undefined);
}
