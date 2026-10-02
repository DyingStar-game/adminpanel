import { Vec3Schema, type Item, type Vec3 } from '@dyingstar-admin/schemas';
import { profileFor } from './profiles';

/** Default gap between an entity and an item spawned next to it, in metres. */
export const SPAWN_DISTANCE = 3;

/** Gap for an item of this type: its profile's `spawnDistance`, else the default. */
export const spawnDistanceFor = (objectType: string | undefined) =>
  profileFor(objectType)?.spawnDistance ?? SPAWN_DISTANCE;

/** Default height added above the reference, in metres, so the item does not spawn in the ground. */
export const SPAWN_HEIGHT = 0.5;

/** Height for an item of this type: its profile's `spawnHeight`, else the default. */
export const spawnHeightFor = (objectType: string | undefined) =>
  profileFor(objectType)?.spawnHeight ?? SPAWN_HEIGHT;

export interface SpawnPreset {
  /** Positions are relative to the parent: the spawned item shares the entity's parent. */
  parentId: string;
  position: Vec3;
  rotation: Vec3;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

type V = [number, number, number];
const add = (a: V, b: V, k: number): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: V): V | null => {
  const n = Math.hypot(...a);
  return n > 1e-9 ? [a[0] / n, a[1] / n, a[2] / n] : null;
};

/**
 * Columns (right, up, back) of the basis of a Godot Euler rotation. Godot's default order is
 * YXZ: the basis is Ry · Rx · Rz.
 */
export function basisFromEuler({ x, y, z }: Vec3): [V, V, V] {
  const [cx, sx, cy, sy, cz, sz] = [
    Math.cos(x),
    Math.sin(x),
    Math.cos(y),
    Math.sin(y),
    Math.cos(z),
    Math.sin(z),
  ];
  return [
    [cy * cz + sy * sx * sz, cx * sz, -sy * cz + cy * sx * sz],
    [-cy * sz + sy * sx * cz, cx * cz, sy * sz + cy * sx * cz],
    [sy * cx, -sx, cy * cx],
  ];
}

/** Godot YXZ Euler angles of a basis given by its columns (inverse of `basisFromEuler`). */
function eulerFromBasis([right, up, back]: [V, V, V]): Vec3 {
  // Row 1 column 2 of the matrix is −sin(x).
  const m12 = back[1];
  if (Math.abs(m12) < 1 - 1e-9) {
    return {
      x: Math.asin(-m12),
      y: Math.atan2(back[0], back[2]),
      z: Math.atan2(right[1], up[1]),
    };
  }
  return { x: m12 < 0 ? Math.PI / 2 : -Math.PI / 2, y: Math.atan2(-right[2], right[0]), z: 0 };
}

/**
 * Beyond this distance from its parent's origin, the reference stands on a celestial body
 * (positions on a planet are relative to its centre): "up" is the radial direction.
 */
export const BODY_FRAME_RADIUS = 1000;

/**
 * Where to spawn an item next to an entity: same parent, `distance` metres in front of it and
 * `height` metres above it, upright, facing the same way.
 *
 * "Up" is the local vertical: the radial direction on a celestial body (the parent is then the
 * planet, whose centre is the origin), else the parent's +Y (buildings, vehicles: only the
 * yaw is kept). Forward is the entity's −Z (Godot convention), laid flat on the plane normal
 * to up. Rotations are Godot Euler angles
 * (order YXZ) in radians. Null when the entity has no usable position.
 */
export function spawnNextTo(
  entity: Item,
  distance = SPAWN_DISTANCE,
  height = 0,
): SpawnPreset | null {
  const position = Vec3Schema.safeParse(entity.object_data.position);
  if (!position.success) return null;
  const rotation = Vec3Schema.safeParse(entity.object_data.rotation);
  const [, ownUp, ownBack] = basisFromEuler(
    rotation.success ? rotation.data : { x: 0, y: 0, z: 0 },
  );
  const origin: V = [position.data.x, position.data.y, position.data.z];

  const up: V = (Math.hypot(...origin) > BODY_FRAME_RADIUS && normalize(origin)) || [0, 1, 0];
  // Forward flattened on the ground; the entity's up when it faces straight up or down.
  const back =
    normalize(add(ownBack, up, -dot(ownBack, up))) ??
    normalize(add(ownUp, up, -dot(ownUp, up))) ??
    normalize(cross(up, [1, 0, 0])) ??
    ([0, 0, 1] as V);
  const target = add(add(origin, back, -distance), up, height);
  const angles = eulerFromBasis([cross(up, back), up, back]);

  return {
    parentId: entity.object_data.parent_id ?? '',
    position: { x: round(target[0]) + 0, y: round(target[1]) + 0, z: round(target[2]) + 0 },
    rotation: {
      x: round(angles.x) + 0,
      y: round(angles.y) + 0,
      z: round(angles.z) + 0,
    },
  };
}

/** Gap in front of the reference and height above it, in metres. */
export interface Offsets {
  distance: number;
  height: number;
}

export type OffsetKey = keyof Offsets;

/** A usable offset: a finite, non-negative number of metres. */
export const offsetValid = (n: number) => Number.isFinite(n) && n >= 0;
