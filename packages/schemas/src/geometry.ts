import type { Vec3 } from './persistence';

/*
 * Godot conventions shared by the BFF and the web app: rotations are Euler angles in radians,
 * order YXZ (Godot's default); forward is −Z, up is +Y.
 */

/** A 3D vector as a tuple, for vector maths. */
export type V = [number, number, number];
/** `a + b × k`. */
export const addScaled = (a: V, b: V, k: number): V => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalize = (a: V): V | null => {
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
export function eulerFromBasis([right, up, back]: [V, V, V]): Vec3 {
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

/** Position `local` of a child, expressed in its parent's frame (`origin`, Euler `rotation`). */
export function toParentFrame(local: V, origin: V, rotation: Vec3): V {
  const [right, up, back] = basisFromEuler(rotation);
  return [
    origin[0] + right[0] * local[0] + up[0] * local[1] + back[0] * local[2],
    origin[1] + right[1] * local[0] + up[1] * local[1] + back[1] * local[2],
    origin[2] + right[2] * local[0] + up[2] * local[1] + back[2] * local[2],
  ];
}

/*
 * Celestial bodies (ADR 0018): positions are relative to the body centre, +Y is the pole and
 * longitude 0 is the +Z direction (assumption to confirm with the game team).
 */
const POLE: V = [0, 1, 0];
const DEG = 180 / Math.PI;
const clamp = (n: number) => Math.max(-1, Math.min(1, n));

/**
 * Latitude / longitude in degrees of a unit direction from the body centre, as the game shows
 * them: pole on +Y, longitude 0 on +X and positive towards +Z (checked against the in-game
 * readout on 2026-10-04: a truck at 15.0968°, −44.6275° shows "15.0967° N 44.6275° O").
 */
export const latLonOf = ([x, y, z]: V) => ({
  lat: Math.asin(clamp(y)) * DEG,
  lon: Math.atan2(z, x) * DEG,
});

/** Unit direction from the body centre of a latitude / longitude in degrees (`latLonOf`'s inverse). */
export function directionOf(lat: number, lon: number): V {
  const [phi, lambda] = [lat / DEG, lon / DEG];
  return [Math.cos(phi) * Math.cos(lambda), Math.sin(phi), Math.cos(phi) * Math.sin(lambda)];
}

/**
 * Azimuthal equidistant projection centred on `center` (unit direction): east / north
 * coordinates in metres on a sphere of `radius`. Distances from the centre are exact.
 */
export function azimuthalEquidistant(center: V, radius: number) {
  const east = normalize(cross(POLE, center)) ?? ([1, 0, 0] as V);
  const north = cross(center, east);
  return (direction: V) => {
    const angle = Math.acos(clamp(dot(direction, center)));
    const k = angle < 1e-12 ? 1 : angle / Math.sin(angle);
    return { x: radius * k * dot(direction, east), y: radius * k * dot(direction, north) };
  };
}

/**
 * Inverse of `azimuthalEquidistant`: the unit direction from the body centre of a point given
 * by its east / north map coordinates in metres.
 */
export function azimuthalEquidistantInverse(center: V, radius: number) {
  const east = normalize(cross(POLE, center)) ?? ([1, 0, 0] as V);
  const north = cross(center, east);
  return (x: number, y: number): V => {
    const rho = Math.hypot(x, y);
    if (rho < 1e-9) return center;
    const angle = rho / radius;
    const along = addScaled(addScaled([0, 0, 0], east, x / rho), north, y / rho);
    return (
      normalize(addScaled(addScaled([0, 0, 0], center, Math.cos(angle)), along, Math.sin(angle))) ??
      center
    );
  };
}
