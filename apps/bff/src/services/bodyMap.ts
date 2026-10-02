import {
  azimuthalEquidistant,
  latLonOf,
  normalize,
  toParentFrame,
  Vec3Schema,
  type BodyMapResponse,
  type Item,
  type MapPoint,
  type V,
} from '@dyingstar-admin/schemas';

/** Above this altitude an item is in orbit: listed, not drawn (ADR 0018). */
export const ORBIT_ALTITUDE = 50_000;

/** Items placed through their parent rather than directly on the body (ADR 0018). */
export const PLACED_THROUGH_PARENT = ['player'];

const round = (n: number, digits: number) => Number(n.toFixed(digits)) + 0;

const positionOf = (item: Item): V | null => {
  const position = Vec3Schema.safeParse(item.object_data.position);
  return position.success ? [position.data.x, position.data.y, position.data.z] : null;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Map of a celestial body (ADR 0018) from its direct children and the items placed through one
 * of them (players in their building). Positions are relative to the body centre.
 */
export function buildBodyMap(body: Item, children: Item[], placed: Item[]): BodyMapResponse {
  const located: { item: Item; via: string | null; world: V }[] = [];
  const parents = new Map<string, { world: V; item: Item }>();
  for (const child of children) {
    const world = positionOf(child);
    if (!world) continue;
    located.push({ item: child, via: null, world });
    parents.set(child.object_uuid, { world, item: child });
  }
  for (const item of placed) {
    const parent = parents.get(item.object_data.parent_id ?? '');
    const local = positionOf(item);
    if (!parent || !local) continue;
    const rotation = Vec3Schema.safeParse(parent.item.object_data.rotation);
    const world = toParentFrame(
      local,
      parent.world,
      rotation.success ? rotation.data : { x: 0, y: 0, z: 0 },
    );
    located.push({ item, via: parent.item.object_uuid, world });
  }

  const referenceRadius = median(
    located.filter((l) => l.via === null).map((l) => Math.hypot(...l.world)),
  );
  const entries = located.flatMap((l) => {
    const distance = Math.hypot(...l.world);
    const direction = normalize(l.world);
    return direction ? [{ ...l, direction, altitude: distance - referenceRadius }] : [];
  });
  const drawn = entries.filter((e) => e.altitude <= ORBIT_ALTITUDE);

  const sum = drawn.reduce<V>(
    (acc, e) => [acc[0] + e.direction[0], acc[1] + e.direction[1], acc[2] + e.direction[2]],
    [0, 0, 0],
  );
  const center = normalize(sum) ?? ([0, 0, 1] as V);
  const project = azimuthalEquidistant(center, referenceRadius);

  const toPoint = (e: (typeof entries)[number]): MapPoint => {
    const { lat, lon } = latLonOf(e.direction);
    const { x, y } = project(e.direction);
    const name = e.item.object_data.name;
    return {
      object_uuid: e.item.object_uuid,
      object_type: e.item.object_type,
      name: typeof name === 'string' && name ? name : null,
      via: e.via,
      lat: round(lat, 6),
      lon: round(lon, 6),
      altitude: round(e.altitude, 1),
      x: round(x, 2),
      y: round(y, 2),
    };
  };
  const centerLatLon = latLonOf(center);
  const bodyName = body.object_data.name;

  return {
    body: {
      object_uuid: body.object_uuid,
      object_type: body.object_type,
      name: typeof bodyName === 'string' && bodyName ? bodyName : null,
    },
    referenceRadius: round(referenceRadius, 1),
    center: { lat: round(centerLatLon.lat, 6), lon: round(centerLatLon.lon, 6) },
    points: drawn.map(toPoint),
    inOrbit: entries.filter((e) => e.altitude > ORBIT_ALTITUDE).map(toPoint),
  };
}
