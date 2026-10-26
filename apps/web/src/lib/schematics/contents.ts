import type { Item, ObjectData } from '@dyingstar-admin/schemas';
import { goodsOf, type Goods } from '@/lib/goods';
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
  /** The item's own load (`own`): what a crate holds, null when empty (ADR 0029). */
  goods: Goods | null;
  /** The item's own load (a crate's `content`), not items it carries: `items` is empty. */
  own: boolean;
}

/**
 * Contents of an item: its children that fill none of the schematic's bays (the installed
 * components are drawn in their bays; loose ones, `slot_id: ""`, are carried) and sit in none
 * of its seats (a driver is the vehicle's child): rocks, crates and other items grouped by type,
 * heaviest first, then each loose component by kind and tier.
 */
export function contentsOf(
  schematic: Schematic,
  data: ObjectData,
  children: Item[],
): ContentGroup[] {
  const inBays = new Set(schematic.bays.map((bay) => valueAt(data, bay.path)));
  const inSeats = new Set(schematic.seats.map((seat) => valueAt(data, seat.path)));
  const groups = new Map<string, ContentGroup>();
  for (const child of children) {
    if (inBays.has(child.object_uuid) || inSeats.has(child.object_uuid)) continue;
    // The player says it sits (`seat: "driver"`) before the vehicle's own save does.
    const seat = child.object_data.seat;
    if (child.object_type === 'player' && typeof seat === 'string' && seat !== '') continue;
    const component = componentModel(child.object_data.scenename);
    const key = component ? child.object_uuid : child.object_type;
    const group = groups.get(key) ?? {
      key,
      objectType: child.object_type,
      component,
      items: [],
      weight: null,
      goods: null,
      own: false,
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

/**
 * The load an item holds itself (ADR 0029): a `cargo` shape's `goods` path read on the item, as
 * one group beside the shape (`goods` null: empty). Nothing when no shape declares `goods`.
 */
export function ownGoodsOf(schematic: Schematic, data: ObjectData): ContentGroup[] {
  const shape = schematic.shapes.find((s) => s.goods);
  if (!shape?.goods) return [];
  const weight = data.weight;
  return [
    {
      key: 'goods',
      objectType: typeof data.type === 'string' ? data.type : 'crate_container',
      component: null,
      items: [],
      weight: typeof weight === 'number' ? weight : null,
      goods: goodsOf(valueAt(data, shape.goods)),
      own: true,
    },
  ];
}
