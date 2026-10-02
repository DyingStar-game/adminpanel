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
  it('copies the vehicle and its components with remapped references', () => {
    const [vehicle, fl, fr] = planDuplicate(
      pick(ids.vehicle, ids.wheelFl, ids.wheelFr),
      {
        parentId: ids.spawnbuilding,
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
      },
      sequence(),
    );

    expect(vehicle).toMatchObject({
      object_type: 'vehicle',
      object_uuid: '00000000-0000-4000-8000-000000000001',
      object_data: {
        uuid: '00000000-0000-4000-8000-000000000001',
        parent_id: ids.spawnbuilding,
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
        // Own components point to their copies; the dangling one is emptied.
        components: {
          Slot_FL: '00000000-0000-4000-8000-000000000002',
          Slot_FR: '00000000-0000-4000-8000-000000000003',
          Slot_RL: '',
          Slot_RR: '',
        },
        // The copy has no pilot and no passenger.
        pilot_uuid: '',
        seats: { SeatDriver: '', SeatPassenger: '' },
        speed: 28.7,
      },
    });
    // Children follow the copied parent and keep their relative position.
    expect(fl?.object_data).toMatchObject({
      parent_id: '00000000-0000-4000-8000-000000000001',
      slot_id: 'Slot_FL',
      position: byId.get(ids.wheelFl)?.object_data.position,
    });
    expect(fr?.object_uuid).toBe('00000000-0000-4000-8000-000000000003');
  });

  it('empties references to children that are not copied', () => {
    const [vehicle] = planDuplicate(pick(ids.vehicle), { parentId: ids.planet }, sequence());

    expect(vehicle?.object_data.components).toEqual({
      Slot_FL: '',
      Slot_FR: '',
      Slot_RL: '',
      Slot_RR: '',
    });
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
