import {
  azimuthalEquidistant,
  directionOf,
  type BodyMapResponse,
  type MapPoint,
} from '@dyingstar-admin/schemas';
import { shortUuid } from './itemLabel';
import { profileFor } from './profiles';

/** Whether items of this type have a planetary map (ADR 0018). */
export const hasMap = (objectType: string | undefined) => !!profileFor(objectType)?.map?.body;

/** Whether a type is hidden on the map until the viewer shows it (`miningrock`). */
export const hiddenByDefault = (objectType: string) => !!profileFor(objectType)?.map?.hidden;

/** Whether a type is shown, given the viewer's choices (`true` = hidden). */
export const isShown = (objectType: string, choices: Record<string, boolean>) =>
  !(choices[objectType] ?? hiddenByDefault(objectType));

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

/** Altitude in metres or kilometres. */
export const formatAltitude = (metres: number) =>
  Math.abs(metres) >= 10_000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;

/** Latitude / longitude with hemispheres, e.g. `22.605° N · 130.748° E`. */
export const formatLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;

/** Projected position `[north, east]` in metres: Leaflet `CRS.Simple` order. */
export type MapLatLng = [number, number];

/** Grid step in degrees giving a handful of lines over `span` degrees. */
function graticuleStep(span: number): number {
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30];
  return steps.find((step) => span / step <= 12) ?? 30;
}

/**
 * Latitude / longitude lines around the drawn points, projected like them (the projection is
 * the BFF's one, from `center` and `referenceRadius`).
 */
export function graticule(map: BodyMapResponse): {
  lat: number[];
  lon: number[];
  lines: MapLatLng[][];
} {
  if (map.points.length === 0 || map.referenceRadius === 0) return { lat: [], lon: [], lines: [] };
  const lats = map.points.map((p) => p.lat);
  const lons = map.points.map((p) => p.lon);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
  const step = graticuleStep(Math.max(maxLat - minLat, maxLon - minLon, 0.01));
  const from = (v: number) => Math.floor(v / step) * step - step;
  const to = (v: number) => Math.ceil(v / step) * step + step;
  const range = (a: number, b: number) =>
    Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) =>
      Number((a + i * step).toFixed(6)),
    );
  const latLines = range(from(minLat), to(maxLat)).filter((v) => v > -90 && v < 90);
  const lonLines = range(from(minLon), to(maxLon));
  const project = azimuthalEquidistant(
    directionOf(map.center.lat, map.center.lon),
    map.referenceRadius,
  );
  const at = (lat: number, lon: number): MapLatLng => {
    const { x, y } = project(directionOf(lat, lon));
    return [y, x];
  };
  const samples = (a: number, b: number) =>
    range(a, b).flatMap((v, i, all) =>
      i === all.length - 1 ? [v] : [0, 0.25, 0.5, 0.75].map((f) => v + f * step),
    );
  const [latA, latB] = [latLines[0] ?? minLat, latLines.at(-1) ?? maxLat];
  const [lonA, lonB] = [lonLines[0] ?? minLon, lonLines.at(-1) ?? maxLon];
  return {
    lat: latLines,
    lon: lonLines,
    lines: [
      ...latLines.map((lat) => samples(lonA, lonB).map((lon) => at(lat, lon))),
      ...lonLines.map((lon) => samples(latA, latB).map((lat) => at(lat, lon))),
    ],
  };
}
