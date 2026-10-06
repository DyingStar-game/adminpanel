import type { Item, ObjectData } from '@dyingstar-admin/schemas';
import { componentModel, type ComponentModel } from './components';
import { valueAt, type Schematic } from './index';

/**
 * Items carried of one type (all the mined rocks together), or one component laid loose
 * (engines and batteries are never grouped: each is drawn like an installed one).
 */
export interface ContentGroup {
  key: string;
  objectType: string;
  /** Kind and tier of a loose component (its group holds only it). */
  component: ComponentModel | null;
  items: Item[];
  /** Sum of the known `weight`s, in kg; null when none is known. */
  weight: number | null;
}

/**
 * Contents of an item: its children that fill none of the schematic's bays (the installed
 * components are drawn in their bays; loose ones, `slot_id: ""`, are carried): rocks and other
 * items grouped by type, heaviest first, then each loose component by kind and tier.
 */
export function contentsOf(
  schematic: Schematic,
  data: ObjectData,
  children: Item[],
): ContentGroup[] {
  const inBays = new Set(schematic.bays.map((bay) => valueAt(data, bay.path)));
  const groups = new Map<string, ContentGroup>();
  for (const child of children) {
    if (inBays.has(child.object_uuid)) continue;
    const component = componentModel(child.object_data.scenename);
    const key = component ? child.object_uuid : child.object_type;
    const group = groups.get(key) ?? {
      key,
      objectType: child.object_type,
      component,
      items: [],
      weight: null,
    };
    group.items.push(child);
    const weight = child.object_data.weight;
    if (typeof weight === 'number') group.weight = (group.weight ?? 0) + weight;
    groups.set(key, group);
  }
  const rank = (group: ContentGroup) =>
    group.component ? `1:${group.component.kind}:${group.component.tier}` : '0';
  return [...groups.values()].sort(
    (a, b) =>
      rank(a).localeCompare(rank(b)) ||
      (b.weight ?? 0) - (a.weight ?? 0) ||
      a.key.localeCompare(b.key),
  );
}
