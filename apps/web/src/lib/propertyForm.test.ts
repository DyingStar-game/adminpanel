import { describe, expect, it } from 'vitest';
import { dataFromRows, editDiff, inferKind, parseRaw, rowsFromData, toRaw } from './propertyForm';

describe('property form', () => {
  it('picks an editor per value shape', () => {
    expect(inferKind('s')).toBe('text');
    expect(inferKind(1)).toBe('number');
    expect(inferKind(false)).toBe('boolean');
    expect(inferKind({ x: 1, y: 2, z: 3 })).toBe('vec3');
    expect(inferKind({ w: 1, x: 0, y: 0, z: 0 })).toBe('json');
    expect(inferKind({ SeatDriver: '' })).toBe('json');
    expect(inferKind(null)).toBe('json');
  });

  it('round-trips values through their raw text', () => {
    const data = {
      name: 'SandBox',
      speed: 28.7,
      engine: true,
      position: { x: 1, y: -2, z: 3.5 },
      seats: { a: '' },
    };
    expect(dataFromRows(rowsFromData(data))).toEqual(data);
    expect(toRaw({ x: 1, y: -2, z: 3.5 }, 'vec3')).toBe('1,-2,3.5');
  });

  it('rejects invalid raw values', () => {
    expect(parseRaw('abc', 'number')).toEqual({ ok: false, error: 'number' });
    expect(parseRaw('', 'number')).toEqual({ ok: false, error: 'number' });
    expect(parseRaw('1,2', 'vec3')).toEqual({ ok: false, error: 'vec3' });
    expect(parseRaw('{nope', 'json')).toEqual({ ok: false, error: 'json' });
    expect(dataFromRows([{ key: 'a', kind: 'number', raw: 'x' }])).toBeNull();
  });

  it('computes changed, added and removed keys only', () => {
    const base = { speed: 1, position: { x: 1, y: 2, z: 3 }, horn: false };
    const edited = { speed: 2, position: { z: 3, y: 2, x: 1 }, engine: true };

    expect(editDiff(base, edited)).toEqual({
      changes: { speed: 2, engine: true },
      removed: ['horn'],
    });
  });
});
