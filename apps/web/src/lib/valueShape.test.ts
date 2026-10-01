import { describe, expect, it } from 'vitest';
import { collectUuids, valueShape } from './valueShape';

describe('valueShape', () => {
  it.each([
    [null, 'null'],
    ['', 'empty'],
    [true, 'boolean'],
    [42, 'number'],
    ['land:15', 'string'],
    ['35ac67f7-c1cf-20c0-1424-af07889a5c77', 'uuid'],
    [{ x: 1, y: 2, z: 3 }, 'vec3'],
    [{ w: 1, x: 0, y: 0, z: 0 }, 'quaternion'],
    [{ x: 1, y: 2 }, 'object'],
    [{ x: 1, y: 2, z: 'a' }, 'object'],
    [[1, 2], 'array'],
  ])('%j is %s', (value, kind) => {
    expect(valueShape(value).kind).toBe(kind);
  });

  it('reads *_timestamp keys as timestamps', () => {
    expect(valueShape(1790858538, 'from_timestamp').kind).toBe('timestamp');
    expect(valueShape(1790858538, 'mass').kind).toBe('number');
  });
});

describe('collectUuids', () => {
  it('finds references at any depth, ignoring empty strings', () => {
    const data = {
      pilot_uuid: '',
      seats: { SeatDriver: '1b029618-ee3b-4045-abaa-ed1fafd9f8f8', SeatPassenger: '' },
      apartments: [{ player_uuid: '0fbdbed2-a747-ac5f-6f0d-5825b4e8ead4' }],
    };

    expect(collectUuids(data)).toEqual([
      { path: 'seats.SeatDriver', uuid: '1b029618-ee3b-4045-abaa-ed1fafd9f8f8' },
      { path: 'apartments[0].player_uuid', uuid: '0fbdbed2-a747-ac5f-6f0d-5825b4e8ead4' },
    ]);
  });
});
