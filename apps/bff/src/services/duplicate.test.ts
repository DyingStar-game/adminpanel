import { describe, expect, it } from 'vitest';
import { createDataset, ids } from '@dyingstar-admin/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { planDuplicate } from './duplicate';

const byId = new Map(createDataset().map((i) => [i.object_uuid, i]));
const pick = (...uuids: string[]) => uuids.map((u) => byId.get(u) as Item);
const sequence = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
};

describe('planDuplicate', () => {
  it('writes each copy like a new item, keeping what binds the copies together', () => {
    const [vehicle, fl, fr] = planDuplicate(
      pick(ids.vehicle, ids.wheelFl, ids.wheelFr),
      {
        parentId: ids.spawnbuilding,
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
      },
      sequence(),
    );

    // Identity, parent, scene, placement, and the components that were copied (remapped):
    // nothing of the state of the moment (speed, suspension, pilot, seats, doors…).
    expect(vehicle).toEqual({
      object_type: 'vehicle',
      object_uuid: '00000000-0000-4000-8000-000000000001',
      object_data: {
        type: 'vehicle',
        uuid: '00000000-0000-4000-8000-000000000001',
        parent_id: ids.spawnbuilding,
        scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
        components: {
          slot_fl: '00000000-0000-4000-8000-000000000002',
          slot_fr: '00000000-0000-4000-8000-000000000003',
        },
      },
    });
    // Children follow the copied parent, keep their relative placement and their place in it
    // (`slot_id`, the key the parent refers to them by), and nothing else (charge, weight).
    const source = byId.get(ids.wheelFr)?.object_data;
    expect(fr?.object_data).toEqual({
      type: 'vehicle_component',
      uuid: '00000000-0000-4000-8000-000000000003',
      parent_id: '00000000-0000-4000-8000-000000000001',
      slot_id: 'slot_fr',
      scenename: source?.scenename,
      position: source?.position,
      rotation: source?.rotation,
    });
    expect(fl?.object_data).toMatchObject({ slot_id: 'slot_fl' });
  });

  it('keeps no reference to items outside the copy', () => {
    const [vehicle] = planDuplicate(pick(ids.vehicle), { parentId: ids.planet }, sequence());

    expect(vehicle?.object_data).not.toHaveProperty('components');
    expect(vehicle?.object_data).not.toHaveProperty('pilot_uuid');
    // Without a target position the original one is kept.
    expect(vehicle?.object_data.position).toEqual(byId.get(ids.vehicle)?.object_data.position);
  });

  it('never touches the original items', () => {
    const items = pick(ids.vehicle);
    const before = structuredClone(items);
    planDuplicate(items, { parentId: '' }, sequence());
    expect(items).toEqual(before);
  });
});
