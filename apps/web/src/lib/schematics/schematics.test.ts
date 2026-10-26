import { describe, expect, it } from 'vitest';
import { createDataset, emptyCrate, haulingCrate, ids, loadedRock } from '@dyingstar-admin/testing';
import { SCHEMATICS, sceneModel, schematicFor, schematicKeys, valueAt } from '.';
import { contentsOf, ownGoodsOf } from './contents';

// The crates are kept out of the dataset (they would change the truck's children everywhere).
const dataset = [...createDataset(), haulingCrate, emptyCrate];

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
        ...schematic.shapes.flatMap((s) => [
          ...(s.value ? [s.value.path] : []),
          ...(s.goods ? [s.goods] : []),
        ]),
        ...schematic.readouts.flatMap((r) =>
          r.kind === 'gauge' || r.kind === 'value' ? [r.path] : [],
        ),
      ];
      for (const path of paths) expect(valueAt(sample.object_data, path), path).not.toBeUndefined();
    }
  });

  it('groups the rocks, keeps loose components apart, leaves out those in bays', () => {
    const truck = dataset.find((i) => i.object_uuid === ids.vehicle);
    const schematic = schematicFor(truck?.object_data.scenename);
    if (!truck || !schematic) throw new Error('no truck fixture');
    const rock = (uuid: string, mineral: string, weight: number) => ({
      ...loadedRock,
      object_uuid: uuid,
      object_data: { ...loadedRock.object_data, mineral_id: mineral, weight },
    });
    const engine = dataset.find((i) => i.object_uuid === ids.wheelFl);
    const battery = dataset.find((i) => i.object_uuid === ids.wheelFr);
    if (!engine || !battery) throw new Error('no component fixtures');
    // A loose battery: a child of the truck that no bay references.
    const loose = {
      ...battery,
      object_uuid: 'loose',
      object_data: { ...battery.object_data, slot_id: '', weight: 25 },
    };
    const groups = contentsOf(schematic, truck.object_data, [
      engine,
      loose,
      { ...loose, object_uuid: 'loose2' },
      rock('a', 'gold', 100),
      rock('b', 'iron', 300),
      rock('c', 'gold', 50),
    ]);
    // Every rock in one group, whatever its mineral; loose components one by one, after them.
    expect(groups.map((g) => [g.key, g.items.length, g.weight])).toEqual([
      ['miningrock', 3, 450],
      ['loose', 1, 25],
      ['loose2', 1, 25],
    ]);
    expect(groups[1]?.component).toEqual({ kind: 'battery', tier: 1 });
  });

  it('groups crates together, and draws a crate with its own load (ADR 0029)', () => {
    const truck = dataset.find((i) => i.object_uuid === ids.vehicle);
    const schematic = schematicFor(truck?.object_data.scenename);
    if (!truck || !schematic) throw new Error('no truck fixture');
    const empty = { ...emptyCrate, object_data: { ...emptyCrate.object_data, weight: 20 } };
    const groups = contentsOf(schematic, truck.object_data, [
      haulingCrate,
      { ...haulingCrate, object_uuid: 'second' },
      empty,
    ]);
    // Crates together whatever they hold, as rocks whatever their mineral.
    expect(groups.map((g) => [g.key, g.items.length, g.weight])).toEqual([
      ['crate_container', 3, 120],
    ]);

    const crate = schematicFor(haulingCrate.object_data.scenename);
    if (!crate) throw new Error('no crate schematic');
    expect(crate.id).toBe('hauling_box');
    expect(ownGoodsOf(crate, haulingCrate.object_data)).toEqual([
      expect.objectContaining({
        own: true,
        items: [],
        weight: 50,
        goods: { mineral: 'gold', units: 66, volume: 0.066 },
      }),
    ]);
    expect(ownGoodsOf(crate, emptyCrate.object_data)[0]?.goods).toBeNull();
    expect(schematicFor(emptyCrate.object_data.scenename)?.id).toBe('crate_container');
    // The page does not list `content` again under the drawing; the truck has no own load.
    expect(schematicKeys(crate).has('content')).toBe(true);
    expect(ownGoodsOf(schematic, truck.object_data)).toEqual([]);
  });

  it('leaves out who sits in the vehicle: its seats, or the player saying it sits', () => {
    const truck = dataset.find((i) => i.object_uuid === ids.vehicle);
    const driver = dataset.find((i) => i.object_uuid === ids.player);
    const schematic = schematicFor(truck?.object_data.scenename);
    if (!truck || !driver || !schematic) throw new Error('no truck fixture');
    const seated = { ...driver, object_data: { ...driver.object_data, parent_id: ids.vehicle } };
    // The player saved `seat: "driver"` before the truck saved its seat (a minute apart).
    const sitting = {
      ...driver,
      object_uuid: 'sitting',
      object_data: { ...driver.object_data, seat: 'driver' },
    };
    const standing = {
      ...driver,
      object_uuid: 'standing',
      object_data: { ...driver.object_data, seat: '' },
    };
    const groups = contentsOf(schematic, truck.object_data, [seated, sitting, standing]);
    expect(groups.map((g) => [g.key, g.items.map((i) => i.object_uuid)])).toEqual([
      ['player', ['standing']],
    ]);
  });

  it('reads nested paths and model names', () => {
    expect(valueAt({ seats: { seat_driver: 'p' } }, 'seats.seat_driver')).toBe('p');
    expect(valueAt({ seats: null }, 'seats.seat_driver')).toBeUndefined();
    expect(sceneModel('scenes/_universe/props/vehicles/engine_t1.tscn')).toBe('engine_t1');
  });
});
