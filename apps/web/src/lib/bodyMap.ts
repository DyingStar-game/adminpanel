import { MAP_PLACED_THROUGH_PARENT, type Item, type MapPoint } from '@dyingstar-admin/schemas';
import { shortUuid } from './itemLabel';
import { typeColor } from './objectTypes';
import { profileFor } from './profiles';

/** Whether items of this type have a planetary map (ADR 0018). */
export const hasMap = (objectType: string | undefined) => !!profileFor(objectType)?.map?.body;

/**
 * Body whose map draws this item, or null: a direct child of a celestial body, or an item
 * placed through its parent (a player in a building standing on the body). `ancestors` go from
 * the root down to the direct parent. Same rule as the BFF's map (ADR 0018).
 */
export function mapBodyOf(item: Item, ancestors: Item[]): string | null {
  const parent = ancestors.at(-1);
  if (parent && hasMap(parent.object_type)) return parent.object_uuid;
  const grandparent = ancestors.at(-2);
  if (
    grandparent &&
    hasMap(grandparent.object_type) &&
    MAP_PLACED_THROUGH_PARENT.includes(item.object_type)
  ) {
    return grandparent.object_uuid;
  }
  return null;
}

/** Whether a type is hidden on the map until the viewer shows it (`miningrock`). */
export const hiddenByDefault = (objectType: string) => !!profileFor(objectType)?.map?.hidden;

/** Whether a type is shown, given the viewer's choices (`true` = hidden). */
export const isShown = (objectType: string, choices: Record<string, boolean>) =>
  !(choices[objectType] ?? hiddenByDefault(objectType));

/** Structures, drawn as squares on the map; people and vehicles stay round. */
const STRUCTURE_TYPES = new Set([
  'spawnbuilding',
  'poi_village',
  'cargo_depot',
  'mining_depot',
  'miningzone',
  'building',
  'city',
  'storagewarehouse',
  'station',
]);

/** Marker shape of a type on the map. */
export const markerShape = (objectType: string): 'square' | 'round' =>
  STRUCTURE_TYPES.has(objectType) ? 'square' : 'round';

/** Label of a map point: its name, else type and short UUID (like `itemLabel`). */
export const pointLabel = (point: MapPoint) =>
  point.name ?? `${point.object_type} ${shortUuid(point.object_uuid)}`;

export interface LegendEntry {
  objectType: string;
  count: number;
}

/** Types present on the map with their counts, most numerous first. */
export function mapLegend(points: MapPoint[]): LegendEntry[] {
  const counts = new Map<string, number>();
  for (const point of points)
    counts.set(point.object_type, (counts.get(point.object_type) ?? 0) + 1);
  return [...counts]
    .map(([objectType, count]) => ({ objectType, count }))
    .sort((a, b) => b.count - a.count || a.objectType.localeCompare(b.objectType));
}

/** Points matching a search on name, UUID or type (case-insensitive), names first. */
export function searchPoints(points: MapPoint[], query: string, limit = 8): MapPoint[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (point: MapPoint) => {
    const name = point.name?.toLowerCase() ?? '';
    if (name === q || point.object_uuid === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    if (point.object_uuid.startsWith(q)) return 3;
    if (point.object_type.toLowerCase().includes(q)) return 4;
    return -1;
  };
  return points
    .map((point) => ({ point, rank: score(point) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank || pointLabel(a.point).localeCompare(pointLabel(b.point)))
    .slice(0, limit)
    .map((r) => r.point);
}

/**
 * Ring of a cluster: one arc per type, proportional to its share, most numerous first
 * (a CSS `conic-gradient`). A cluster of a single type gets a plain ring of its colour.
 */
export function typeMixGradient(objectTypes: string[]): string {
  const counts = new Map<string, number>();
  for (const type of objectTypes) counts.set(type, (counts.get(type) ?? 0) + 1);
  const total = objectTypes.length || 1;
  let from = 0;
  const arcs = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => {
      const to = from + (count / total) * 100;
      const arc = `${typeColor(type)} ${Number(from.toFixed(2))}% ${Number(to.toFixed(2))}%`;
      from = to;
      return arc;
    });
  return `conic-gradient(${arcs.join(', ')})`;
}

/** Altitude in metres or kilometres. */
export const formatAltitude = (metres: number) =>
  Math.abs(metres) >= 10_000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;

/** Latitude / longitude with hemispheres, e.g. `22.605° N · 130.748° E`. */
export const formatLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;

/** Projected position `[north, east]` in metres: Leaflet `CRS.Simple` order. */
export type MapLatLng = [number, number];

/** Target size of a grid cell on screen, in pixels. */
export const GRID_CELL_PX = 80;
/** A thick line every this many cells. */
export const GRID_MAJOR_EVERY = 5;

/**
 * Grid step in metres: the 1-2-5 series value (1 m, 2 m, 5 m, 10 m…) closest above
 * `GRID_CELL_PX` pixels at this scale, so cells stay about the same size on screen.
 */
export function gridStep(metresPerPixel: number): number {
  const target = metresPerPixel * GRID_CELL_PX;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((v) => v >= target * 0.75);
  return Math.max(step ?? 10 * magnitude, 0.1);
}

/** Visible area in projected metres. */
export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Metric grid lines over `bounds` (ADR 0018): the projection keeps distances, so cells of
 * `step` metres measure the map. Lines are split between minor and major (every
 * `GRID_MAJOR_EVERY` steps), aligned on multiples of the step from the map centre.
 */
export function gridLines(
  bounds: MapBounds,
  step: number,
): { minor: MapLatLng[][]; major: MapLatLng[][] } {
  const minor: MapLatLng[][] = [];
  const major: MapLatLng[][] = [];
  const along = (from: number, to: number) => {
    const values: number[] = [];
    for (let i = Math.floor(from / step); i * step <= to; i++) values.push(i);
    return values;
  };
  for (const i of along(bounds.west, bounds.east)) {
    const line: MapLatLng[] = [
      [bounds.south, i * step],
      [bounds.north, i * step],
    ];
    (i % GRID_MAJOR_EVERY === 0 ? major : minor).push(line);
  }
  for (const i of along(bounds.south, bounds.north)) {
    const line: MapLatLng[] = [
      [i * step, bounds.west],
      [i * step, bounds.east],
    ];
    (i % GRID_MAJOR_EVERY === 0 ? major : minor).push(line);
  }
  return { minor, major };
}

/** Distance in metres or kilometres, e.g. `500 m`, `2 km`. */
export const formatDistance = (metres: number) =>
  metres >= 1000 ? `${Number((metres / 1000).toFixed(3))} km` : `${Number(metres.toFixed(1))} m`;

/** Last move of the selected item, seen between two map refreshes. */
export interface Movement {
  from: MapLatLng;
  to: MapLatLng;
  /** When the new position was received (ms since epoch). */
  at: number;
  /** Straight-line distance in metres (the projection keeps distances). */
  distance: number;
}

/** Last known position of the selected item, and its last move. Kept in memory only. */
export interface MovementTracker {
  uuid: string;
  last: MapLatLng;
  movement: Movement | null;
}

/**
 * Follows the selected item between refreshes: a new position becomes the end of a movement
 * from the previous one. Returns the same tracker when nothing changed (safe to compare), and
 * starts over when another item is selected.
 */
export function trackMovement(
  tracker: MovementTracker | null,
  point: MapPoint | undefined,
  receivedAt: number,
): MovementTracker | null {
  if (!point) return null;
  const position: MapLatLng = [point.y, point.x];
  if (!tracker || tracker.uuid !== point.object_uuid) {
    return { uuid: point.object_uuid, last: position, movement: null };
  }
  if (tracker.last[0] === position[0] && tracker.last[1] === position[1]) return tracker;
  return {
    uuid: point.object_uuid,
    last: position,
    movement: {
      from: tracker.last,
      to: position,
      at: receivedAt,
      distance: Math.hypot(position[0] - tracker.last[0], position[1] - tracker.last[1]),
    },
  };
}

/** Heading of a movement in degrees, clockwise from north (map up). */
export const movementHeading = ({ from, to }: Pick<Movement, 'from' | 'to'>) =>
  (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
