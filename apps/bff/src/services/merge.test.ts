import { describe, expect, it } from 'vitest';
import { mergeEdit } from './merge';

const base = { speed: 10, engine: true, position: { x: 1, y: 2, z: 3 }, horn: false };

describe('mergeEdit', () => {
  it('writes only touched keys and keeps what the game saved meanwhile', () => {
    const latest = { ...base, position: { x: 9, y: 9, z: 9 } };

    const { data, conflicts } = mergeEdit(latest, {
      base,
      changes: { engine: false },
      removed: [],
      force: false,
    });

    expect(conflicts).toEqual([]);
    expect(data).toEqual({ ...latest, engine: false });
  });

  it('reports a conflict when the game changed a key the user edited', () => {
    const latest = { ...base, speed: 42 };

    const { conflicts } = mergeEdit(latest, {
      base,
      changes: { speed: 0 },
      removed: [],
      force: false,
    });

    expect(conflicts).toEqual([{ key: 'speed', base: 10, latest: 42, mine: 0 }]);
  });

  it('is not a conflict when both sides reached the same value', () => {
    const latest = { ...base, speed: 0 };

    expect(
      mergeEdit(latest, { base, changes: { speed: 0 }, removed: [], force: false }).conflicts,
    ).toEqual([]);
  });

  it('applies the user value when forced', () => {
    const { data, conflicts } = mergeEdit(
      { ...base, speed: 42 },
      { base, changes: { speed: 0 }, removed: [], force: true },
    );

    expect(conflicts).toEqual([]);
    expect(data.speed).toBe(0);
  });

  it('removes keys and compares nested values structurally', () => {
    const latest = { ...base, position: { z: 3, y: 2, x: 1 } };

    const { data, conflicts } = mergeEdit(latest, {
      base,
      changes: { position: { x: 0, y: 0, z: 0 } },
      removed: ['horn'],
      force: false,
    });

    expect(conflicts).toEqual([]);
    expect(data).toEqual({ speed: 10, engine: true, position: { x: 0, y: 0, z: 0 } });
  });
});
