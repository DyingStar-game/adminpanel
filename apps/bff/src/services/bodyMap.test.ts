import { describe, expect, it } from 'vitest';
import type { Item } from '@dyingstar-admin/schemas';
import { buildBodyMap, ORBIT_ALTITUDE } from './bodyMap';

const R = 6_361_633;
const item = (uuid: string, type: string, data: Record<string, unknown>): Item => ({
  object_type: type,
  object_uuid: uuid,
  object_data: { parent_id: 'planet', ...data },
});
const planet = item('planet', 'planet', { name: 'SandBox', parent_id: '' });
/** A point on the sphere at latitude / longitude (degrees) and altitude, in the body frame. */
const at = (lat: number, lon: number, altitude = 0) => {
  const [phi, lambda] = [(lat * Math.PI) / 180, (lon * Math.PI) / 180];
  const r = R + altitude;
  return {
    x: r * Math.cos(phi) * Math.sin(lambda),
    y: r * Math.sin(phi),
    z: r * Math.cos(phi) * Math.cos(lambda),
  };
};

describe('buildBodyMap', () => {
  it('places surface children by latitude, longitude and altitude', () => {
    const map = buildBodyMap(
      planet,
      [
        item('a', 'spawnbuilding', { name: 'A', position: at(20, 130, 0) }),
        item('b', 'vehicle', { position: at(20, 130, 0) }),
        item('c', 'poi_village', { position: at(21, 131, 300) }),
      ],
      [],
    );

    expect(map.body).toEqual({ object_uuid: 'planet', object_type: 'planet', name: 'SandBox' });
    expect(map.referenceRadius).toBeCloseTo(R, 0);
    const village = map.points.find((p) => p.object_uuid === 'c');
    expect(village).toMatchObject({ object_type: 'poi_village', name: null, via: null });
    expect(village?.lat).toBeCloseTo(21, 4);
    expect(village?.lon).toBeCloseTo(131, 4);
    expect(village?.altitude).toBeCloseTo(300, 0);
  });

  it('keeps distances from the centre in the projection', () => {
    const map = buildBodyMap(
      planet,
      [
        item('a', 'spawnbuilding', { position: at(0, 0) }),
        item('b', 'spawnbuilding', { position: at(0, 0) }),
        item('c', 'spawnbuilding', { position: at(0, 1) }),
      ],
      [],
    );
    const [a, , c] = map.points;
    // One degree of longitude on the equator, east of the centre (one third of the way).
    const degree = (R * Math.PI) / 180;
    expect(Math.hypot((c?.x ?? 0) - (a?.x ?? 0), (c?.y ?? 0) - (a?.y ?? 0))).toBeCloseTo(
      degree,
      -1,
    );
    expect(c?.x).toBeGreaterThan(a?.x ?? 0);
    expect(Math.abs((c?.y ?? 0) - (a?.y ?? 0))).toBeLessThan(1);
  });

  it('places players through their building: position and rotation of the parent', () => {
    const building = at(0, 0);
    const map = buildBodyMap(
      planet,
      [
        item('building', 'spawnbuilding', {
          position: building,
          rotation: { x: 0, y: Math.PI / 2, z: 0 },
        }),
      ],
      [
        item('player', 'player', { parent_id: 'building', position: { x: 0, y: 0, z: -10 } }),
        // Not housed on this body: left out.
        item('elsewhere', 'player', { parent_id: 'other', position: { x: 0, y: 0, z: 0 } }),
      ],
    );

    const player = map.points.find((p) => p.object_uuid === 'player');
    expect(player?.via).toBe('building');
    expect(map.points.some((p) => p.object_uuid === 'elsewhere')).toBe(false);
    // Local −Z rotated by a quarter turn around Y is −X of the body, i.e. 10 m along x.
    const buildingPoint = map.points.find((p) => p.object_uuid === 'building');
    expect(
      Math.hypot(
        (player?.x ?? 0) - (buildingPoint?.x ?? 0),
        (player?.y ?? 0) - (buildingPoint?.y ?? 0),
      ),
    ).toBeCloseTo(10, 1);
  });

  it('lists items high above the surface as in orbit, and skips items without position', () => {
    const map = buildBodyMap(
      planet,
      [
        item('a', 'spawnbuilding', { position: at(15, 90) }),
        item('b', 'spawnbuilding', { position: at(15, 90) }),
        item('station', 'station', { position: at(15, 90, ORBIT_ALTITUDE * 8) }),
        item('moon', 'planet', { positions: [{ x: 1, y: 2, z: 3 }] }),
      ],
      [],
    );

    expect(map.points.map((p) => p.object_uuid)).toEqual(['a', 'b']);
    expect(map.inOrbit.map((p) => p.object_uuid)).toEqual(['station']);
    expect(map.inOrbit[0]?.altitude).toBeCloseTo(ORBIT_ALTITUDE * 8, -1);
  });

  it('returns an empty map for a body without positioned children', () => {
    const map = buildBodyMap(planet, [], []);
    expect(map).toMatchObject({ referenceRadius: 0, points: [], inOrbit: [] });
  });
});
