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
  checkImportCoherence(items, checkImportFormat(items, ['vehicle', 'player', 'planet']), context);
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
        seats: { SeatDriver: ids.spawnbuilding, SeatPassenger: '' },
        components: { Slot_FL: '99999999-9999-4999-8999-999999999999' },
      }),
    ]);
    expect(row?.findings).toEqual([
      {
        code: 'refWrongType',
        severity: 'warning',
        path: 'object_data.seats.SeatDriver',
        params: { expected: 'player', actual: 'spawnbuilding' },
      },
      {
        code: 'refNotFound',
        severity: 'warning',
        path: 'object_data.components.Slot_FL',
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

  it('leaves invalid rows untouched', () => {
    const [row] = check([{ object_type: 'vehicle', object_data: {} }]);
    expect(row).toMatchObject({ status: 'invalid' });
    expect(codes(row)).toEqual(['uuidMissing']);
  });
});
