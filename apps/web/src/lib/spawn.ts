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

/**
 * Where to spawn an item next to an entity: same parent, `distance` metres in front of it
 * (Godot convention: forward is −Z, rotated by the yaw `rotation.y` in radians), `height`
 * metres above it (+Y), same yaw. Null when the entity has no usable position.
 */
export function spawnNextTo(
  entity: Item,
  distance = SPAWN_DISTANCE,
  height = 0,
): SpawnPreset | null {
  const position = Vec3Schema.safeParse(entity.object_data.position);
  if (!position.success) return null;
  const rotation = Vec3Schema.safeParse(entity.object_data.rotation);
  const yaw = rotation.success ? rotation.data.y : 0;
  return {
    parentId: entity.object_data.parent_id ?? '',
    position: {
      x: round(position.data.x - Math.sin(yaw) * distance),
      y: round(position.data.y + height),
      z: round(position.data.z - Math.cos(yaw) * distance),
    },
    rotation: { x: 0, y: yaw, z: 0 },
  };
}
