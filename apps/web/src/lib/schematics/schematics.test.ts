import { describe, expect, it } from 'vitest';
import { createDataset, ids } from '@dyingstar-admin/testing';
import { SCHEMATICS, sceneModel, schematicFor, valueAt } from '.';

const vehicle = createDataset().find((i) => i.object_uuid === ids.vehicle);

describe('schematics', () => {
  it('matches the truck by scenename, exactly or by pattern', () => {
    expect(schematicFor('scenes/_universe/vehicles/ground/trucks/truck.tscn')?.id).toBe('truck');
    expect(schematicFor('scenes/_universe/vehicles/ground/trucks/van.tscn')).toBeNull();
    expect(schematicFor(undefined)).toBeNull();
  });

  it('only uses paths that exist on a sample item', () => {
    if (!vehicle) throw new Error('fixture vehicle missing');
    for (const schematic of SCHEMATICS) {
      const paths = [
        ...schematic.seats.map((s) => s.path),
        ...schematic.bays.map((b) => b.path),
        ...schematic.shapes.flatMap((s) => (s.value ? [s.value.path] : [])),
        ...schematic.readouts.filter((r) => r.kind !== 'toggle').map((r) => r.path),
      ];
      for (const path of paths)
        expect(valueAt(vehicle.object_data, path), path).not.toBeUndefined();
    }
  });

  it('reads nested paths and model names', () => {
    expect(valueAt({ seats: { SeatDriver: 'p' } }, 'seats.SeatDriver')).toBe('p');
    expect(valueAt({ seats: null }, 'seats.SeatDriver')).toBeUndefined();
    expect(sceneModel('scenes/_universe/props/vehicles/engine_t1.tscn')).toBe('engine_t1');
  });
});
