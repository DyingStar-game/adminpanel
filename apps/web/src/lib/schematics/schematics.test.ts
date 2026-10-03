import { describe, expect, it } from 'vitest';
import { createDataset } from '@dyingstar-admin/testing';
import { SCHEMATICS, sceneModel, schematicFor, valueAt } from '.';

const dataset = createDataset();

describe('schematics', () => {
  it('matches the truck by scenename, exactly or by pattern', () => {
    expect(schematicFor('scenes/_universe/vehicles/ground/trucks/truck.tscn')?.id).toBe('truck');
    expect(schematicFor('scenes/_universe/vehicles/ground/trucks/van.tscn')).toBeNull();
    expect(schematicFor(undefined)).toBeNull();
  });

  it('matches batteries of every tier, not engines', () => {
    expect(schematicFor('scenes/_universe/props/vehicles/battery_t1.tscn')?.id).toBe('battery');
    expect(schematicFor('scenes/_universe/props/vehicles/battery_t3.tscn')?.id).toBe('battery');
    expect(schematicFor('scenes/_universe/props/vehicles/engine_t1.tscn')).toBeNull();
  });

  it('only uses paths that exist on a sample item', () => {
    for (const schematic of SCHEMATICS) {
      const sample = dataset.find((i) => schematicFor(i.object_data.scenename) === schematic);
      if (!sample) throw new Error(`no fixture for the ${schematic.id} schematic`);
      const paths = [
        ...schematic.seats.map((s) => s.path),
        ...schematic.bays.map((b) => b.path),
        ...schematic.shapes.flatMap((s) => (s.value ? [s.value.path] : [])),
        ...schematic.readouts.flatMap((r) =>
          r.kind === 'gauge' || r.kind === 'value' ? [r.path] : [],
        ),
      ];
      for (const path of paths) expect(valueAt(sample.object_data, path), path).not.toBeUndefined();
    }
  });

  it('reads nested paths and model names', () => {
    expect(valueAt({ seats: { seat_driver: 'p' } }, 'seats.seat_driver')).toBe('p');
    expect(valueAt({ seats: null }, 'seats.seat_driver')).toBeUndefined();
    expect(sceneModel('scenes/_universe/props/vehicles/engine_t1.tscn')).toBe('engine_t1');
  });
});
