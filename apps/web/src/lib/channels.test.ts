import { describe, expect, it } from 'vitest';
import { groupByChannel } from './channels';

const definition = {
  type: 'vehicle',
  channels: [
    { zone: 0, distance: 200, frequency: 30, properties: ['position', 'speed', 'parent_id'] },
    { zone: 6, distance: 200, frequency: 1, properties: ['scenename', 'parent_id'] },
  ],
};

describe('groupByChannel', () => {
  it('groups present keys by zone, the last channel winning, undeclared keys last', () => {
    const data = { speed: 1, scenename: 's', parent_id: '', uuid: 'x', type: 'vehicle' };

    expect(groupByChannel(data, definition)).toEqual([
      { zone: 0, distance: 200, frequency: 30, keys: ['speed'] },
      { zone: 6, distance: 200, frequency: 1, keys: ['scenename', 'parent_id'] },
      { zone: null, keys: ['uuid', 'type'] },
    ]);
  });

  it('puts every key in the undeclared section without definition', () => {
    expect(groupByChannel({ a: 1 }, null)).toEqual([{ zone: null, keys: ['a'] }]);
  });
});
