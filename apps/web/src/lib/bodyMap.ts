import { MAP_PLACED_THROUGH_PARENT, type Item, type MapPoint } from '@dyingstar-admin/schemas';
import { shortUuid } from './itemLabel';
import { typeColor } from './objectTypes';
import { mapHiddenTypes, profileFor } from './profiles';

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
  'simple_building',
  'city',
  'storagewarehouse',
  'storage_area',
  'crate_container',
  'station',
]);

/** Kinds of item that can be teleported from the map ("Teleport here…"). */
export const TELEPORTABLE_TYPES = ['player', 'vehicle'] as const;
export type TeleportableType = (typeof TELEPORTABLE_TYPES)[number];

/**
 * Items of the map that can be teleported, by kind, by name: players (with their building as a
 * hint) and vehicles of the body.
 */
export function teleportCandidates(
  points: MapPoint[],
  byUuid: ReadonlyMap<string, MapPoint>,
): Record<TeleportableType, { uuid: string; label: string; objectType: string; hint?: string }[]> {
  const of = (type: TeleportableType) =>
    points
      .filter((point) => point.object_type === type)
      .map((point) => {
        const building = point.via ? byUuid.get(point.via) : undefined;
        return {
          uuid: point.object_uuid,
          label: pointLabel(point),
          objectType: type,
          ...(building ? { hint: pointLabel(building) } : {}),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  return { player: of('player'), vehicle: of('vehicle') };
}

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

/**
 * Types on the body with their counts (from the BFF, loaded or not), most numerous first.
 * Bodies (moons) have their own map and no point here: they are left out.
 */
export function mapLegend(counts: { object_type: string; total: number }[]): LegendEntry[] {
  return counts
    .filter((c) => c.total > 0 && !profileFor(c.object_type)?.map?.body)
    .map((c) => ({ objectType: c.object_type, count: c.total }))
    .sort((a, b) => b.count - a.count || a.objectType.localeCompare(b.objectType));
}

/**
 * Types the viewer hides (profile defaults not overridden, and their own choices), sent to the
 * BFF so it loads them last and may leave out the too numerous ones (ADR 0018).
 */
export function hiddenTypes(choices: Record<string, boolean>): string[] {
  const types = new Set([...mapHiddenTypes(), ...Object.keys(choices)]);
  return [...types].filter((type) => !isShown(type, choices)).sort();
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
  Math.abs(metres) >= 10_000
    ? `${(metres / 1000).toFixed(1)} km`
    : Math.abs(metres) >= 1000
      ? `${(metres / 1000).toFixed(2)} km`
      : `${Math.round(metres)} m`;

/**
 * Altitude as the game shows it: above the body's radius from the wiki (SandBox's ground stands
 * about 4 km above its 6,356 km). The map's own altitudes are above the ground level measured on
 * its items (`referenceRadius`); without the wiki radius, they are kept.
 */
export const gameAltitude = (
  altitude: number,
  referenceRadius: number,
  radiusKm: number | undefined,
) => (radiusKm === undefined ? altitude : altitude + referenceRadius - radiusKm * 1000);

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

/**
 * Zoom of an arrival on an item ("show on map"): 1 m = 2^zoom px, so 2^3.5 ≈ 11.3 m per pixel,
 * where the grid steps by 1 km — the item among its surroundings.
 */
export const ARRIVAL_ZOOM = -3.5;

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

/** Longest trail kept for the selected item (oldest moves dropped first). */
export const MAX_TRAIL = 100;

/** Last known position of the selected item, and its moves since selected. Memory only. */
export interface MovementTracker {
  uuid: string;
  /** Projection frame the positions are in (the map centre); another one starts over. */
  frame: string;
  last: MapLatLng;
  /** Successive moves, oldest first. */
  moves: Movement[];
}

/**
 * Follows the selected item between refreshes: each new position adds a move from the previous
 * one to its trail. Returns the same tracker when nothing changed (safe to compare); another
 * selection starts over, no selection forgets everything. A refresh without the item (being
 * reloaded) keeps the trail.
 */
export function trackMovement(
  tracker: MovementTracker | null,
  selected: string | undefined,
  point: MapPoint | undefined,
  receivedAt: number,
  frame = '',
): MovementTracker | null {
  if (!selected) return null;
  if (!point || point.object_uuid !== selected) {
    return tracker?.uuid === selected ? tracker : null;
  }
  const position: MapLatLng = [point.y, point.x];
  // Positions in another frame (the BFF restarted) cannot be compared: start over.
  if (!tracker || tracker.uuid !== selected || tracker.frame !== frame) {
    return { uuid: selected, frame, last: position, moves: [] };
  }
  if (tracker.last[0] === position[0] && tracker.last[1] === position[1]) return tracker;
  const move: Movement = {
    from: tracker.last,
    to: position,
    at: receivedAt,
    distance: Math.hypot(position[0] - tracker.last[0], position[1] - tracker.last[1]),
  };
  return {
    uuid: selected,
    frame,
    last: position,
    moves: [...tracker.moves, move].slice(-MAX_TRAIL),
  };
}

/** Heading of a movement in degrees, clockwise from north (map up). */
export const movementHeading = ({ from, to }: Pick<Movement, 'from' | 'to'>) =>
  (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** A point further than this many times the 90th percentile distance is left out of the fit. */
const FIT_OUTLIER_FACTOR = 3;

/**
 * Points the first view is fitted on: all of them but the lone ones far from the rest (a
 * vehicle driven to the other side of the planet would zoom the view out to the whole body).
 * Distances are taken from the median point; the outliers stay on the map, out of the frame.
 */
export function fitPoints<P extends { x: number; y: number }>(points: P[]): P[] {
  if (points.length < 10) return points;
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;
  const cx = median(points.map((p) => p.x));
  const cy = median(points.map((p) => p.y));
  const distances = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const sorted = [...distances].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const kept = points.filter((_, i) => (distances[i] ?? 0) <= FIT_OUTLIER_FACTOR * p90);
  return kept.length > 0 ? kept : points;
}
