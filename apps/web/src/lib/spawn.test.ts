import { describe, expect, it } from 'vitest';
import { basisFromEuler, directionOf, dot, toParentFrame } from '@dyingstar-admin/schemas';
import {
  SPAWN_DISTANCE,
  SPAWN_HEIGHT,
  spawnDistanceFor,
  spawnHeightFor,
  moveOnBody,
  placeOnBody,
  spawnNextTo,
  type SpawnPreset,
} from './spawn';

const player = (data: Record<string, unknown>) => ({
  object_type: 'player',
  object_uuid: 'p',
  object_data: { parent_id: 'building', ...data },
});

describe('spawnNextTo', () => {
  it('shares the parent, since positions are relative to it', () => {
    expect(spawnNextTo(player({ position: { x: 0, y: 0, z: 0 } }))?.parentId).toBe('building');
  });

  it('places the item in front (−Z) when the entity faces the default direction', () => {
    const preset = spawnNextTo(
      player({ position: { x: 1, y: 0.5, z: 10 }, rotation: { x: 0, y: 0, z: 0 } }),
      2,
    );
    expect(preset).toEqual({
      parentId: 'building',
      position: { x: 1, y: 0.5, z: 8 },
      rotation: { x: 0, y: 0, z: 0 },
    });
  });

  it('follows the yaw', () => {
    const preset = spawnNextTo(
      player({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } }),
      2,
    );
    expect(preset?.position).toEqual({ x: -2, y: 0, z: 0 });
    expect(preset?.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it('uses the default gap when none is given', () => {
    const preset = spawnNextTo(player({ position: { x: 0, y: 0, z: 0 } }));
    expect(preset?.position.z).toBe(-SPAWN_DISTANCE);
  });

  it('raises the item above the reference', () => {
    const preset = spawnNextTo(player({ position: { x: 0, y: 0.071, z: 0 } }), 2, 1);
    expect(preset?.position.y).toBe(1.071);
  });

  it('only keeps the yaw outside a celestial body, even when the reference is tilted', () => {
    const preset = spawnNextTo(
      player({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0.3, y: 1, z: 0.2 } }),
      2,
    );
    expect(preset?.rotation).toEqual({ x: 0, y: 1, z: 0 });
    expect(preset?.position.y).toBe(0);
  });

  it('on a planet, raises the item along the radial direction and aligns it with the ground', () => {
    // A vehicle resting on SandBox (live data): positions are relative to the planet centre.
    const position = { x: 4450682.975, y: 2674166.505, z: -3675680.385 };
    const vehicle = {
      object_type: 'vehicle',
      object_uuid: 'v',
      object_data: {
        parent_id: 'sandbox',
        position,
        rotation: { x: -1.135, y: -0.845, z: -0.045 },
      },
    };
    const preset = spawnNextTo(vehicle, 8, 5) as SpawnPreset;
    const radius = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

    expect(preset.parentId).toBe('sandbox');
    expect(radius(preset.position) - radius(position)).toBeCloseTo(5, 1);
    const dx = preset.position.x - position.x;
    const dy = preset.position.y - position.y;
    const dz = preset.position.z - position.z;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(Math.hypot(8, 5), 1);
    // The spawned item's up is the radial direction.
    const [, up] = basisFromEuler(preset.rotation);
    const r = radius(position);
    expect(
      up[0] * (position.x / r) + up[1] * (position.y / r) + up[2] * (position.z / r),
    ).toBeCloseTo(1, 3);
  });

  it('needs a position', () => {
    expect(spawnNextTo(player({}))).toBeNull();
  });
});

describe('spawnDistanceFor', () => {
  it('leaves more room for vehicles than for other types', () => {
    expect(spawnDistanceFor('vehicle')).toBe(8);
    expect(spawnDistanceFor('box')).toBe(SPAWN_DISTANCE);
    expect(spawnDistanceFor(undefined)).toBe(SPAWN_DISTANCE);
  });
});

describe('spawnHeightFor', () => {
  it('raises vehicles more than other types', () => {
    expect(spawnHeightFor('vehicle')).toBe(1);
    expect(spawnHeightFor('box')).toBe(SPAWN_HEIGHT);
  });

  it('places an item on a body where the map was clicked: upright, facing north', () => {
    const direction = directionOf(19.2, 132.6);
    const preset = placeOnBody('body', direction, 6_360_000);
    expect(preset.parentId).toBe('body');
    const { x, y, z } = preset.position;
    expect(Math.hypot(x, y, z)).toBeCloseTo(6_360_000, 0);
    const [, up, back] = basisFromEuler(preset.rotation);
    // Its +Y along the local vertical, its forward (−Z) towards the pole.
    up.forEach((value, i) => expect(value).toBeCloseTo(direction[i] ?? 0, 3));
    expect(dot(back, [0, 1, 0])).toBeLessThan(0);
  });

  it('moves an item on a body: upright at the new place, same heading, same item when in place', () => {
    const from = directionOf(19.2, 132.6);
    // A building as the game places it: upright, any heading.
    const start = placeOnBody('body', from, 6_361_600);
    const [, , startBack] = basisFromEuler(start.rotation);
    const yawed = { x: start.rotation.x, y: start.rotation.y, z: start.rotation.z };
    const item = {
      object_type: 'simple_building',
      object_uuid: 'b',
      object_data: { parent_id: 'body', position: start.position, rotation: yawed },
    };

    const to = directionOf(20.5, 135.1);
    const moved = moveOnBody(item, to, 6_361_700);
    const [, up, back] = basisFromEuler(moved.rotation);
    up.forEach((value, i) => expect(value).toBeCloseTo(to[i] ?? 0, 3));
    expect(Math.hypot(moved.position.x, moved.position.y, moved.position.z)).toBeCloseTo(
      6_361_700,
      0,
    );
    // Still facing about the same way (north here): a small turn for a move of a few degrees.
    expect(dot(back, startBack)).toBeGreaterThan(0.99);

    // Moved onto itself: the same rotation.
    const still = moveOnBody(item, from, 6_361_600);
    expect(still.rotation).toEqual(start.rotation);
  });

  it('moves a player in its building: same parent, placement given in the building frame', () => {
    const buildingAt = directionOf(19.2, 132.6);
    const building = placeOnBody('body', buildingAt, 6_361_600);
    const player = {
      object_type: 'player',
      object_uuid: 'p',
      object_data: {
        parent_id: 'building',
        position: { x: -3.2, y: 0.07, z: 8 },
        rotation: { x: 0, y: 1.7, z: 0 },
      },
    };
    const to = directionOf(19.21, 132.61);
    const moved = moveOnBody(player, to, 6_361_601, building);

    expect(moved.parentId).toBe('building');
    // Back in the body frame: at the clicked place, at the given distance, upright.
    const world = toParentFrame(
      [moved.position.x, moved.position.y, moved.position.z],
      [building.position.x, building.position.y, building.position.z],
      building.rotation,
    );
    expect(Math.hypot(...world)).toBeCloseTo(6_361_601, 0);
    const dir = world.map((v) => v / Math.hypot(...world));
    dir.forEach((value, i) => expect(value).toBeCloseTo(to[i] ?? 0, 6));
    const [, buildingUp] = basisFromEuler(building.rotation);
    const [, localUp] = basisFromEuler(moved.rotation);
    // Its up, expressed in the building, stays the building's up (about: the ground turns a bit).
    expect(localUp[1]).toBeGreaterThan(0.999);
    expect(dot(buildingUp, buildingAt)).toBeCloseTo(1, 6);
  });
});
