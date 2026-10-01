import { describe, expect, it } from 'vitest';
import { matchesPath, orderChildTypes, profileFor, relationFor, tableColumnsFor } from '.';

describe('type profiles', () => {
  it('loads the first profiles and falls back to none', () => {
    expect(['vehicle', 'player', 'planet', 'star'].map((t) => profileFor(t)?.type)).toEqual([
      'vehicle',
      'player',
      'planet',
      'star',
    ]);
    expect(profileFor('miningrock')).toBeNull();
    expect(tableColumnsFor('miningrock')).toEqual([]);
  });

  it('matches reference paths segment by segment', () => {
    expect(matchesPath('seats.*', 'seats.SeatDriver')).toBe(true);
    expect(matchesPath('seats.*', 'seats')).toBe(false);
    expect(relationFor(profileFor('vehicle'), 'components.Slot_FL')?.target).toBe(
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
