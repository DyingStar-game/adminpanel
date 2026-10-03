import { describe, expect, it } from 'vitest';
import type { MapPoint } from '@dyingstar-admin/schemas';
import {
  formatAltitude,
  formatLatLon,
  formatDistance,
  gridLines,
  gridStep,
  hasMap,
  hiddenTypes,
  isShown,
  mapLegend,
  markerShape,
  MAX_TRAIL,
  movementHeading,
  pointLabel,
  searchPoints,
  trackMovement,
  typeMixGradient,
} from './bodyMap';

const point = (uuid: string, type: string, name: string | null = null): MapPoint => ({
  object_uuid: uuid,
  object_type: type,
  name,
  via: null,
  lat: 22,
  lon: 130,
  altitude: 0,
  x: 0,
  y: 0,
});

describe('body map helpers', () => {
  it('gives a map to celestial bodies only', () => {
    expect(hasMap('planet')).toBe(true);
    expect(hasMap('vehicle')).toBe(false);
    expect(hasMap(undefined)).toBe(false);
  });

  it('hides mining rocks by default, until the viewer shows them', () => {
    expect(isShown('miningrock', {})).toBe(false);
    expect(isShown('miningrock', { miningrock: false })).toBe(true);
    expect(isShown('vehicle', {})).toBe(true);
    expect(isShown('vehicle', { vehicle: true })).toBe(false);
  });

  it('draws structures as squares, people and vehicles as dots', () => {
    expect(
      ['spawnbuilding', 'poi_village', 'simple_building', 'player', 'vehicle'].map(markerShape),
    ).toEqual(['square', 'square', 'square', 'round', 'round']);
  });

  it('lists the counted types, most numerous first, without empty ones', () => {
    const counts = [
      { object_type: 'vehicle', total: 1 },
      { object_type: 'player', total: 2 },
      { object_type: 'poi_village', total: 0 },
      { object_type: 'planet', total: 1 },
    ];
    expect(mapLegend(counts)).toEqual([
      { objectType: 'player', count: 2 },
      { objectType: 'vehicle', count: 1 },
    ]);
  });

  it('hides the profile defaults unless shown, and the types the viewer hid', () => {
    expect(hiddenTypes({})).toEqual(['miningrock']);
    expect(hiddenTypes({ miningrock: false, vehicle: true })).toEqual(['vehicle']);
  });

  it('labels unnamed points by type and short UUID', () => {
    expect(pointLabel(point('4e9a9ff9-2c69', 'vehicle'))).toBe('vehicle 4e9a9ff9');
    expect(pointLabel(point('x', 'player', 'ddurieux'))).toBe('ddurieux');
  });

  it('searches names first, then UUIDs and types', () => {
    const points = [
      point('aaaa', 'vehicle'),
      point('bbbb', 'player', 'npc391'),
      point('cccc', 'player', 'npc39'),
      point('npc39ddd', 'player', 'zed'),
    ];
    expect(searchPoints(points, 'npc39').map((p) => p.object_uuid)).toEqual([
      'cccc',
      'bbbb',
      'npc39ddd',
    ]);
    expect(searchPoints(points, 'VEHI').map((p) => p.object_uuid)).toEqual(['aaaa']);
    expect(searchPoints(points, '  ')).toEqual([]);
  });

  it('colours a cluster ring by the share of each type, most numerous first', () => {
    expect(typeMixGradient(['vehicle', 'player', 'player', 'player'])).toBe(
      'conic-gradient(#10b981 0% 75%, #e11d48 75% 100%)',
    );
    expect(typeMixGradient(['vehicle'])).toBe('conic-gradient(#e11d48 0% 100%)');
  });

  it('formats altitudes and coordinates', () => {
    expect(formatAltitude(301.4)).toBe('301 m');
    expect(formatAltitude(394651)).toBe('394.7 km');
    expect(formatLatLon(22.605108, -130.748103)).toBe('22.605° N · 130.748° W');
  });

  it('picks a 1-2-5 grid step giving cells of about 80 px', () => {
    // 1 m per pixel: 80 m wanted, 100 m is the closest series value above 60 m.
    expect(gridStep(1)).toBe(100);
    expect(gridStep(0.5)).toBe(50);
    expect(gridStep(0.02)).toBe(2);
    // A whole region: 1.5 km per pixel → 120 km wanted → 100 km.
    expect(gridStep(1500)).toBe(100_000);
  });

  it('draws grid lines over the view, a thick one every 5 cells', () => {
    const { minor, major } = gridLines({ south: -120, west: -30, north: 30, east: 260 }, 50);
    // Verticals at x = 0, 50 … 250; horizontals at y = -100 … 0 (plus the one below -120).
    const xs = [...minor, ...major].filter((l) => l[0]?.[1] === l[1]?.[1]).map((l) => l[0]?.[1]);
    expect(xs).toEqual(expect.arrayContaining([0, 50, 100, 150, 200, 250]));
    expect(major).toContainEqual([
      [-120, 250],
      [30, 250],
    ]);
    expect(major).toContainEqual([
      [0, -30],
      [0, 260],
    ]);
    expect(minor).toContainEqual([
      [-50, -30],
      [-50, 260],
    ]);
  });

  it('formats grid distances', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(2000)).toBe('2 km');
    expect(formatDistance(0.5)).toBe('0.5 m');
  });

  it('keeps the trail of the selected item until another one is selected', () => {
    const truck = (x: number, y: number) => ({ ...point('t', 'vehicle'), x, y });
    const first = trackMovement(null, 't', truck(0, 0), 1000);
    expect(first).toEqual({ uuid: 't', frame: '', last: [0, 0], moves: [] });
    // Same position on the next refresh: unchanged tracker, nothing drawn.
    expect(trackMovement(first, 't', truck(0, 0), 6000)).toBe(first);

    const moved = trackMovement(first, 't', truck(300, 400), 61_000);
    expect(moved?.moves).toEqual([{ from: [0, 0], to: [400, 300], at: 61_000, distance: 500 }]);
    // Every move is kept, each starting from the previous position.
    const again = trackMovement(moved, 't', truck(300, 1400), 121_000);
    expect(again?.moves.map((m) => [m.from, m.to])).toEqual([
      [
        [0, 0],
        [400, 300],
      ],
      [
        [400, 300],
        [1400, 300],
      ],
    ]);
    // A refresh without the item keeps the trail.
    expect(trackMovement(again, 't', undefined, 0)).toBe(again);

    // Positions in another projection frame are not compared: start over.
    expect(trackMovement(again, 't', truck(9, 9), 0, 'other')?.moves).toEqual([]);

    // Another selection starts over; no selection forgets everything.
    expect(trackMovement(again, 'p', { ...point('p', 'player'), x: 5, y: 5 }, 0)?.moves).toEqual(
      [],
    );
    expect(trackMovement(again, undefined, truck(0, 0), 0)).toBeNull();
  });

  it('keeps the last moves only', () => {
    let tracker = trackMovement(null, 't', { ...point('t', 'vehicle'), x: 0, y: 0 }, 0);
    for (let i = 1; i <= MAX_TRAIL + 5; i++) {
      tracker = trackMovement(tracker, 't', { ...point('t', 'vehicle'), x: i, y: 0 }, i);
    }
    expect(tracker?.moves).toHaveLength(MAX_TRAIL);
    expect(tracker?.moves.at(-1)?.to).toEqual([0, MAX_TRAIL + 5]);
  });

  it('gives the heading of a move, clockwise from north', () => {
    expect(movementHeading({ from: [0, 0], to: [10, 0] })).toBe(0);
    expect(movementHeading({ from: [0, 0], to: [0, 10] })).toBe(90);
    expect(movementHeading({ from: [0, 0], to: [-10, 0] })).toBe(180);
  });
});
