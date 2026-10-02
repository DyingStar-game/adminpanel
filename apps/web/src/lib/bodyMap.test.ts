import { describe, expect, it } from 'vitest';
import type { BodyMapResponse, MapPoint } from '@dyingstar-admin/schemas';
import {
  formatAltitude,
  formatLatLon,
  graticule,
  hasMap,
  isShown,
  mapLegend,
  pointLabel,
  searchPoints,
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

  it('counts the types, most numerous first', () => {
    const points = [point('a', 'player'), point('b', 'vehicle'), point('c', 'player')];
    expect(mapLegend(points)).toEqual([
      { objectType: 'player', count: 2 },
      { objectType: 'vehicle', count: 1 },
    ]);
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

  it('formats altitudes and coordinates', () => {
    expect(formatAltitude(301.4)).toBe('301 m');
    expect(formatAltitude(394651)).toBe('394.7 km');
    expect(formatLatLon(22.605108, -130.748103)).toBe('22.605° N · 130.748° W');
  });

  it('draws latitude and longitude lines around the points', () => {
    const map: BodyMapResponse = {
      body: { object_uuid: 'p', object_type: 'planet', name: 'SandBox' },
      referenceRadius: 6_361_633,
      center: { lat: 22, lon: 130 },
      points: [
        { ...point('a', 'player'), lat: 20, lon: 129 },
        { ...point('b', 'player'), lat: 24, lon: 133 },
      ],
      inOrbit: [],
    };
    const grid = graticule(map);
    // Half-degree lines over a 4° span, one step of margin on each side.
    expect(grid.lat).toEqual([19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5]);
    expect(grid.lines).toHaveLength(grid.lat.length + grid.lon.length);
    // The centre's parallel passes through the projection origin.
    const centreLat = grid.lines[grid.lat.indexOf(22)] ?? [];
    expect(Math.min(...centreLat.map(([north]) => Math.abs(north)))).toBeLessThan(1000);

    expect(graticule({ ...map, points: [] }).lines).toEqual([]);
  });
});
