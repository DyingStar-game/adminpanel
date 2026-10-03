import { describe, expect, it } from 'vitest';
import { matchesPath, orderChildTypes, profileFor, relationFor, tableColumnsFor } from '.';

describe('type profiles', () => {
  it('loads the first profiles and falls back to none', () => {
    const types = ['vehicle', 'player', 'planet', 'star', 'miningrock'];
    expect(types.map((t) => profileFor(t)?.type)).toEqual(types);
    expect(profileFor('poi_village')).toBeNull();
    expect(tableColumnsFor('poi_village')).toEqual([]);
    expect(tableColumnsFor('miningrock')).toEqual([]);
  });

  it('matches reference paths segment by segment', () => {
    expect(matchesPath('seats.*', 'seats.seat_driver')).toBe(true);
    expect(matchesPath('seats.*', 'seats')).toBe(false);
    expect(relationFor(profileFor('vehicle'), 'components.slot_fl')?.target).toBe(
      'vehicle_component',
    );
  });

  it('orders preferred child types first', () => {
    expect(
      orderChildTypes(profileFor('planet'), ['miningrock', 'box', 'vehicle', 'poi_village']),
    ).toEqual(['vehicle', 'miningrock', 'box', 'poi_village']);
  });

  it('declares the planet/moon and implicit star rules', () => {
    expect(profileFor('planet')?.moonWhenParentIs).toBe('planet');
    expect(profileFor('star')?.implicitChildren).toEqual({ objectType: 'planet', parentId: '' });
  });
});
