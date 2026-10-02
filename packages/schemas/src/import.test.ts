import { describe, expect, it } from 'vitest';
import {
  checkImportFormat,
  parseParentAlias,
  resolveParentAliases,
  type ImportRow,
} from './import';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const item = (uuid: string, data: Record<string, unknown> = {}, type = 'vehicle') => ({
  object_type: type,
  object_uuid: uuid,
  object_data: { parent_id: '', ...data },
});
const codes = (row: ImportRow | undefined) => row?.findings.map((f) => f.code) ?? [];
const TYPES = ['vehicle', 'player'];

describe('checkImportFormat', () => {
  it('accepts well-formed items as new', () => {
    const [row] = checkImportFormat(
      [item(A, { position: { x: 1, y: 2, z: 3 }, name: 'truck', uuid: A, type: 'vehicle' })],
      TYPES,
    );
    expect(row).toEqual({
      index: 0,
      object_uuid: A,
      object_type: 'vehicle',
      status: 'new',
      findings: [],
    });
  });

  it('reports structural errors with their path', () => {
    const rows = checkImportFormat(
      [
        42,
        { object_uuid: A, object_data: {} },
        { object_type: 'vehicle', object_uuid: 'nope', object_data: [] },
        { object_type: 'vehicle', object_data: {} },
      ],
      TYPES,
    );
    expect(codes(rows[0])).toEqual(['notObject']);
    expect(rows[1]?.findings).toContainEqual({
      code: 'typeMissing',
      severity: 'error',
      path: 'object_type',
    });
    expect(codes(rows[2])).toEqual(['uuidMalformed', 'dataNotObject']);
    expect(codes(rows[3])).toEqual(['uuidMissing']);
    expect(rows.every((r) => r.status === 'invalid')).toBe(true);
  });

  it('refuses unknown types, unless no definition is known', () => {
    expect(codes(checkImportFormat([item(A, {}, 'spaceship')], TYPES)[0])).toEqual(['unknownType']);
    expect(checkImportFormat([item(A, {}, 'spaceship')], [])[0]?.status).toBe('new');
  });

  it('checks that object_data repeats the item UUID (its `type` is checked by the BFF)', () => {
    const [row] = checkImportFormat([item(A, { uuid: B, type: 'player' })], TYPES);
    expect(codes(row)).toEqual(['uuidMismatch']);
  });

  it('checks parent_id: format, self parent and cycles inside the input', () => {
    const rows = checkImportFormat(
      [
        item(A, { parent_id: 'not-a-uuid' }),
        item(B, { parent_id: B }),
        item(C, { parent_id: A }),
        { ...item('44444444-4444-4444-8444-444444444444'), object_data: { parent_id: 7 } },
      ],
      TYPES,
    );
    expect(codes(rows[0])).toEqual(['parentInvalid']);
    expect(codes(rows[1])).toEqual(['parentSelf']);
    expect(rows[2]?.status).toBe('new');
    expect(codes(rows[3])).toEqual(['parentInvalid']);

    const cycle = checkImportFormat(
      [item(A, { parent_id: B }), item(B, { parent_id: A }), item(C, { parent_id: A })],
      TYPES,
    );
    expect(codes(cycle[0])).toEqual(['parentCycle']);
    expect(codes(cycle[1])).toEqual(['parentCycle']);
    // C hangs under the cycle without being part of it.
    expect(codes(cycle[2])).toEqual([]);
  });

  it('checks the shape of well-known keys', () => {
    const [row] = checkImportFormat(
      [
        item(A, {
          position: { x: 1, y: '2', z: 3 },
          rotation: [0, 1, 0],
          positions: [{ x: 1, y: 2, z: 3 }],
          rotations: [{ w: 1, x: 0, y: 0, z: 0 }],
          scenename: 5,
        }),
      ],
      TYPES,
    );
    expect(row?.findings).toEqual([
      {
        code: 'badShape',
        severity: 'error',
        path: 'object_data.position',
        params: { expected: 'vec3' },
      },
      {
        code: 'badShape',
        severity: 'error',
        path: 'object_data.rotation',
        params: { expected: 'vec3' },
      },
      {
        code: 'badShape',
        severity: 'error',
        path: 'object_data.scenename',
        params: { expected: 'string' },
      },
    ]);
  });

  it('flags every repetition of a UUID after its first occurrence', () => {
    const rows = checkImportFormat([item(A), item(B), item(A)], TYPES);
    expect(rows.map((r) => r.status)).toEqual(['new', 'new', 'invalid']);
    expect(rows[2]?.findings[0]).toMatchObject({ code: 'duplicateUuid', params: { row: 1 } });
  });

  it('leaves parent aliases to their resolution', () => {
    expect(codes(checkImportFormat([item(A, { parent_id: '_planet_SandBox' })], TYPES)[0])).toEqual(
      [],
    );
  });
});

describe('parent aliases', () => {
  const types = ['planet', 'poi_village', 'poi', 'spawnbuilding'];

  it('reads _<type>_<name>, the longest known type first', () => {
    expect(parseParentAlias('_planet_SandBox', types)).toEqual({ type: 'planet', name: 'SandBox' });
    expect(parseParentAlias('_poi_village_mining_village_54', types)).toEqual({
      type: 'poi_village',
      name: 'mining_village_54',
    });
    expect(parseParentAlias('_spaceship_X', types)).toBeNull();
    expect(parseParentAlias('_planet_', types)).toBeNull();
  });

  it('replaces an alias by the UUID of the only item with that type and name', () => {
    const candidates = [
      { object_uuid: A, object_type: 'planet', name: 'SandBox' },
      { object_uuid: B, object_type: 'spawnbuilding', name: 'tarsis_4-1008' },
      { object_uuid: C, object_type: 'spawnbuilding', name: 'tarsis_4-1008' },
    ];
    const { items, findings } = resolveParentAliases(
      [
        item(C, { parent_id: '_planet_SandBox' }),
        item(C, { parent_id: '_spawnbuilding_tarsis_4-1008' }),
        item(C, { parent_id: '_planet_Nowhere' }),
        item(C, { parent_id: B }),
      ],
      candidates,
      types,
    );
    expect((items[0] as { object_data: { parent_id: string } }).object_data.parent_id).toBe(A);
    expect(findings.get(0)?.[0]).toMatchObject({
      code: 'aliasResolved',
      severity: 'info',
      params: { uuid: A },
    });
    expect(findings.get(1)?.[0]).toMatchObject({
      code: 'aliasAmbiguous',
      severity: 'error',
      params: { count: 2 },
    });
    expect(findings.get(2)?.[0]).toMatchObject({ code: 'aliasNotFound', severity: 'error' });
    expect(findings.has(3)).toBe(false);
  });
});
