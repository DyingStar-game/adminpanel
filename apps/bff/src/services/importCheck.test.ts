import { describe, expect, it } from 'vitest';
import { checkImportFormat, type ImportRow } from '@dyingstar-admin/schemas';
import { createDataset, ids } from '@dyingstar-admin/testing';
import { buildImportContext, checkImportCoherence, valueKind } from './importCheck';

const definitions = [
  {
    type: 'vehicle',
    channels: [
      {
        zone: 0,
        distance: 100,
        frequency: 1,
        properties: [
          'position',
          'rotation',
          'parent_id',
          'scenename',
          'speed',
          'pilot_uuid',
          'seats',
          'components',
        ],
      },
    ],
  },
  { type: 'player', channels: [] },
];
const context = buildImportContext(createDataset(), definitions);
const NEW = '11111111-1111-4111-8111-111111111111';
const truck = (data: Record<string, unknown>, uuid = NEW) => ({
  object_type: 'vehicle',
  object_uuid: uuid,
  object_data: {
    parent_id: ids.planet,
    position: { x: 1, y: 2, z: 3 },
    scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
    ...data,
  },
});
const check = (items: unknown[]) =>
  checkImportCoherence(
    items,
    checkImportFormat(items, ['vehicle', 'player', 'planet', 'spawnbuilding']),
    context,
  );
const codes = (row: ImportRow | undefined) => row?.findings.map((f) => f.code) ?? [];

describe('valueKind', () => {
  it('tells vectors and quaternions from plain objects', () => {
    expect(
      [null, true, 1, 'a', [], { x: 1, y: 2, z: 3 }, { w: 1, x: 0, y: 0, z: 0 }, {}].map(valueKind),
    ).toEqual(['null', 'boolean', 'number', 'string', 'array', 'vec3', 'quaternion', 'object']);
  });
});

describe('checkImportCoherence', () => {
  it('accepts a coherent new truck without warning', () => {
    const [row] = check([truck({ speed: 0 })]);
    expect(row).toMatchObject({ status: 'new', findings: [] });
  });

  it('marks UUIDs already on the server as conflicts', () => {
    expect(check([truck({}, ids.vehicle)])[0]?.status).toBe('conflict');
  });

  it('warns about undeclared keys and values of an unusual kind', () => {
    const [row] = check([truck({ speed: 'fast', colour: 'red' })]);
    expect(row?.status).toBe('new');
    expect(row?.findings).toContainEqual({
      code: 'kindMismatch',
      severity: 'warning',
      path: 'object_data.speed',
      params: { expected: 'number', actual: 'string' },
    });
    expect(row?.findings).toContainEqual({
      code: 'undeclaredKey',
      severity: 'warning',
      path: 'object_data.colour',
    });
  });

  it('checks the parent: found on the server or in the input, and of a usual type', () => {
    const missing = '99999999-9999-4999-8999-999999999999';
    expect(codes(check([truck({ parent_id: missing })])[0])).toEqual(['parentNotFound']);
    // A truck under another truck: never seen on the server.
    expect(check([truck({ parent_id: ids.vehicle })])[0]?.findings[0]).toMatchObject({
      code: 'parentTypeUnusual',
      params: { parentType: 'vehicle' },
    });
    // A truck at the root while every truck has a parent.
    expect(codes(check([truck({ parent_id: '' })])[0])).toContain('parentTypeUnusual');
    // A parent created by the same import is fine.
    const planet = {
      object_type: 'planet',
      object_uuid: '22222222-2222-4222-8222-222222222222',
      object_data: { parent_id: '' },
    };
    expect(codes(check([planet, truck({ parent_id: planet.object_uuid })])[1])).toEqual([]);
  });

  it('checks references to players and components', () => {
    const [row] = check([
      truck({
        pilot_uuid: ids.player,
        seats: { seat_driver: ids.spawnbuilding, seat_passenger: '' },
        components: { slot_fl: '99999999-9999-4999-8999-999999999999' },
      }),
    ]);
    expect(row?.findings).toEqual([
      {
        code: 'refWrongType',
        severity: 'warning',
        path: 'object_data.seats.seat_driver',
        params: { expected: 'player', actual: 'spawnbuilding' },
      },
      {
        code: 'refNotFound',
        severity: 'warning',
        path: 'object_data.components.slot_fl',
        params: { uuid: '99999999-9999-4999-8999-999999999999' },
      },
    ]);
  });

  it('checks the scene and a missing position', () => {
    expect(codes(check([truck({ scenename: 'scenes/unknown.tscn' })])[0])).toEqual([
      'sceneUnknown',
    ]);
    const [rock] = check([
      truck({ scenename: 'scenes/_universe/environment/terrain/rocks/rock_mining_sm.tscn' }),
    ]);
    expect(rock?.findings[0]).toMatchObject({
      code: 'sceneOtherType',
      params: { types: 'miningrock' },
    });
    const noPosition = truck({});
    delete (noPosition.object_data as Record<string, unknown>).position;
    expect(codes(check([noPosition])[0])).toEqual(['positionMissing']);
  });

  it('warns when object_data.type differs, only where it always repeats the object type', () => {
    expect(check([truck({ type: 'player' })])[0]?.findings).toEqual([
      {
        code: 'typeMismatch',
        severity: 'warning',
        path: 'object_data.type',
        params: { expected: 'vehicle' },
      },
    ]);
  });

  it('warns about a probable duplicate, and refuses the same object at the same place', () => {
    // The fixture's spawn building: named, under the planet, at a given position.
    const building = createDataset().find((i) => i.object_uuid === ids.spawnbuilding);
    if (!building) throw new Error('fixture building missing');
    const copy = (data: Record<string, unknown>, uuid = NEW) => ({
      object_type: 'spawnbuilding',
      object_uuid: uuid,
      // Empty apartments: a player lives in one only (`refTaken`, tested below).
      object_data: { ...building.object_data, uuid, apartments: [], ...data },
    });
    const [elsewhere] = check([copy({ position: { x: 1, y: 2, z: 3 } })]);
    expect(elsewhere?.status).toBe('new');
    expect(elsewhere?.findings).toContainEqual(
      expect.objectContaining({
        code: 'possibleDuplicate',
        params: { uuid: ids.spawnbuilding, count: 1 },
      }),
    );

    const [same] = check([copy({})]);
    expect(same?.status).toBe('invalid');
    expect(same?.findings).toContainEqual(
      expect.objectContaining({
        code: 'duplicateSpawn',
        severity: 'error',
        params: { uuid: ids.spawnbuilding },
      }),
    );

    // Re-importing the item itself (same UUID) is a conflict, not a duplicate.
    const [itself] = check([copy({}, ids.spawnbuilding)]);
    expect(itself?.status).toBe('conflict');

    // Twice the same new object in one import.
    const twin = { name: 'new_building', position: { x: 9, y: 9, z: 9 } };
    const rows = check([copy(twin), copy(twin, '22222222-2222-4222-8222-222222222222')]);
    expect(rows[0]?.status).toBe('new');
    expect(rows[1]?.findings).toContainEqual(
      expect.objectContaining({ code: 'duplicateSpawnInImport', params: { row: 1 } }),
    );
  });

  it('checks what a component says back to the slot holding it (ADR 0022)', () => {
    // The fixture's components say back their vehicle and slot.
    const stored = createDataset().find((i) => i.object_uuid === ids.vehicle);
    if (!stored) throw new Error('fixture vehicle missing');
    const vehicle = (components: Record<string, string>) => ({
      ...stored,
      object_data: { ...stored.object_data, components },
    });
    const at = (row: ImportRow | undefined, path: string) =>
      row?.findings.filter((f) => f.path === `object_data.${path}`).map((f) => f.code);
    // The test definitions do not declare every key of the fixture: reference findings only.
    const refs = (row: ImportRow | undefined) =>
      row?.findings.filter((f) => f.code !== 'undeclaredKey');

    const [coherent] = check([
      vehicle({ slot_fl: ids.wheelFl, slot_fr: ids.wheelFr, slot_rl: '', slot_rr: '' }),
    ]);
    expect(refs(coherent)).toEqual([]);

    const [swapped] = check([
      vehicle({ slot_fl: ids.wheelFr, slot_fr: ids.wheelFl, slot_rl: '', slot_rr: '' }),
    ]);
    expect(at(swapped, 'components.slot_fl')).toEqual(['refOtherKey']);
    expect(refs(swapped)?.[0]?.params).toEqual({
      key: 'slot_id',
      expected: 'slot_fl',
      actual: 'slot_fr',
    });
    expect(swapped?.status).toBe('conflict');

    // The orphan component is mounted on another (missing) vehicle.
    const [other] = check([vehicle({ slot_fl: ids.orphanComponent, slot_rr: '' })]);
    expect(at(other, 'components.slot_fl')).toEqual(['refOtherParent', 'refOtherKey']);

    const [twice] = check([vehicle({ slot_fl: ids.wheelFl, slot_rl: ids.wheelFl })]);
    expect(twice?.status).toBe('invalid');
    expect(at(twice, 'components.slot_rl')).toContain('refRepeated');
  });

  it('refuses a target already held by another item of the type', () => {
    const [taken] = check([truck({ components: { slot_fl: ids.wheelFl } })]);
    expect(taken?.status).toBe('invalid');
    expect(taken?.findings).toContainEqual({
      code: 'refTaken',
      severity: 'error',
      path: 'object_data.components.slot_fl',
      params: { uuid: ids.vehicle },
    });
    // The holder in the import releases it: its own version counts, not the stored one.
    const stored = createDataset().find((i) => i.object_uuid === ids.vehicle);
    if (!stored) throw new Error('fixture vehicle missing');
    const released = { ...stored, object_data: { ...stored.object_data, components: {} } };
    const [, moved] = check([released, truck({ components: { slot_fl: ids.wheelFl } })]);
    expect(codes(moved)).not.toContain('refTaken');
    // Two items of the import holding the same target.
    const rows = check([
      truck({ components: { slot_rr: ids.orphanComponent } }),
      truck(
        { components: { slot_rr: ids.orphanComponent } },
        '22222222-2222-4222-8222-222222222222',
      ),
    ]);
    expect(rows.map(codes).map((c) => c.includes('refTaken'))).toEqual([true, true]);
  });

  it('checks references inside arrays and what the target refers back to', () => {
    const building = createDataset().find((i) => i.object_uuid === ids.spawnbuilding);
    if (!building) throw new Error('fixture building missing');
    const [same] = check([building]);
    expect(same?.findings).toEqual([]);
    // A tenant whose spawn apartment is another building.
    const elsewhere = {
      ...building,
      object_uuid: NEW,
      object_data: {
        ...building.object_data,
        uuid: NEW,
        name: 'other',
        apartments: [{ number: 1, player_uuid: ids.player }],
      },
    };
    const [row] = check([elsewhere]);
    expect(row?.findings).toContainEqual({
      code: 'refNotBack',
      severity: 'warning',
      path: 'object_data.apartments[0].player_uuid',
      params: { uuid: ids.player, key: 'spawn_appartment_id' },
    });
    expect(codes(row)).toContain('refTaken');
  });

  it('notes UUIDs outside known references that designate nothing', () => {
    const zone = '33333333-3333-4333-8333-333333333333';
    const [row] = check([
      truck({ speed: 0, out_of_zone: zone, seats: { seat_driver: '' }, owner: ids.player }),
    ]);
    expect(row?.status).toBe('new');
    // `owner` designates a player: an item, even if no reference is declared there.
    expect(row?.findings.filter((f) => f.code !== 'undeclaredKey')).toEqual([
      {
        code: 'uuidNotReference',
        severity: 'info',
        path: 'object_data.out_of_zone',
        params: { uuid: zone },
      },
    ]);
  });

  it('checks only the changed keys for key-level findings', () => {
    const items = [
      truck({ speed: 'fast', other_key: 1, out_of_zone: '33333333-3333-4333-8333-333333333333' }),
    ];
    const all = checkImportCoherence(items, checkImportFormat(items, ['vehicle']), context);
    expect(codes(all[0])).toEqual(
      expect.arrayContaining(['kindMismatch', 'undeclaredKey', 'uuidNotReference']),
    );
    const some = checkImportCoherence(items, checkImportFormat(items, ['vehicle']), context, {
      changed: ['position'],
    });
    expect(codes(some[0])).toEqual([]);
  });

  it('leaves invalid rows untouched', () => {
    const [row] = check([{ object_type: 'vehicle', object_data: {} }]);
    expect(row).toMatchObject({ status: 'invalid' });
    expect(codes(row)).toEqual(['uuidMissing']);
  });
});
