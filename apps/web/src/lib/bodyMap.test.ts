import { describe, expect, it } from 'vitest';
import type { MapPoint } from '@dyingstar-admin/schemas';
import {
  formatAltitude,
  formatLatLon,
  formatDistance,
  gridLines,
  gridStep,
  hasMap,
  isShown,
  mapLegend,
  markerShape,
  pointLabel,
  searchPoints,
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
    expect(['spawnbuilding', 'poi_village', 'player', 'vehicle'].map(markerShape)).toEqual([
      'square',
      'square',
      'round',
      'round',
    ]);
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
});
