import type { Poi } from '@dyingstar-admin/contracts/inventory';
import type { MissionObjective } from '@dyingstar-admin/contracts/mission';
import { azimuthalEquidistant, dot, latLonOf, normalize, type V } from '@dyingstar-admin/schemas';
import { factsOfModel, type BodyFacts } from './bodies';
import type { ObjectiveView, PlaceRole } from './objectiveSchematics';

/** Where a POI stands, as the panel shows it (ADR 0026). */
export interface PlaceFacts {
  /** The body's scene model (`tarsis_3`), from the POI's `scene`; null in open space or unscoped. */
  model: string | null;
  /** The body's wiki facts, when the panel knows them. */
  body: BodyFacts | null;
  /** Latitude / longitude in degrees, on a body (ADR 0018's frame: +Y pole, 0 on +X). */
  latLon: { lat: number; lon: number } | null;
  /** Height above the wiki radius in metres (the game's altitude), when the body is known. */
  altitude: number | null;
}

/** The body of a POI's scene: its first segment (`tarsis_3/new-haven` stands on `tarsis_3`). */
const bodyModel = (scene: string | null) => {
  const model = scene?.split('/')[0]?.replace(/\.tscn$/, '') ?? '';
  return model === '' || model === 'space' ? null : model;
};

const position = (poi: Poi): V => [poi.x, poi.y, poi.z];

/** A POI's body, latitude / longitude and altitude. */
export function placeFacts(poi: Poi): PlaceFacts {
  const model = bodyModel(poi.scene);
  const body = model ? factsOfModel(model) : null;
  const direction = model ? normalize(position(poi)) : null;
  return {
    model,
    body,
    latLon: direction ? latLonOf(direction) : null,
    altitude: body && direction ? Math.hypot(...position(poi)) - body.radiusKm * 1000 : null,
  };
}

/**
 * Distance in metres between two POIs on the same body, along its surface (great circle on the
 * wiki radius, or the points' mean distance from the centre); null otherwise.
 */
export function surfaceDistance(a: Poi, b: Poi): number | null {
  const model = bodyModel(a.scene);
  if (!model || model !== bodyModel(b.scene)) return null;
  const [da, db] = [normalize(position(a)), normalize(position(b))];
  if (!da || !db) return null;
  const radius =
    (factsOfModel(model)?.radiusKm ?? 0) * 1000 ||
    (Math.hypot(...position(a)) + Math.hypot(...position(b))) / 2;
  return Math.acos(Math.min(1, Math.max(-1, dot(da, db)))) * radius;
}

/** A distance in metres or kilometres. */
export const formatDistance = (metres: number, language: string) =>
  metres >= 1000
    ? `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(metres / 1000)} km`
    : `${Math.round(metres)} m`;

/** A place on the mission's map: `[north, east]` in metres, as Leaflet `CRS.Simple` takes it. */
export type PlaceLatLng = [number, number];

/** One objective using a place, and how. */
export interface PlaceUse {
  objectiveId: string;
  step: number;
  title: string;
  role: PlaceRole;
}

/** A POI drawn on the map, once whatever the objectives using it. */
export interface MapPlace {
  poi: Poi;
  at: PlaceLatLng;
  uses: PlaceUse[];
}

/** A `transport`: from where the goods are loaded to where they are delivered. */
export interface MapRoute {
  objectiveId: string;
  from: PlaceLatLng;
  to: PlaceLatLng;
  loaded: boolean | null;
  /** Along the surface, in metres. */
  distance: number | null;
}

/** A map frame: the projection's centre (unit direction) and sphere radius in metres. */
export interface PlacesFrame {
  center: V;
  radius: number;
}

/**
 * Fixed objects that help find one's way around the places (ADR 0027 update): villages, depots,
 * mining zones, buildings, storage areas. Not what moves or is picked up (vehicles, players,
 * rocks, crates).
 */
export const LANDMARK_TYPES: readonly string[] = [
  'poi_village',
  'city',
  'cargo_depot',
  'mining_depot',
  'miningzone',
  'spawnbuilding',
  'building',
  'simple_building',
  'storagewarehouse',
  'storage_area',
];

/** The places of one body, in a frame of their own (ADR 0027). */
export interface BodyPlaces {
  model: string;
  body: BodyFacts | null;
  places: MapPlace[];
  routes: MapRoute[];
}

/** A place the map does not draw: in open space, unknown to `inventory`, or not read. */
export interface UndrawnPlace {
  poiId: string;
  poi: Poi | null | undefined;
  uses: PlaceUse[];
}

export interface MissionPlaces {
  /** One per body, the one with most places first. */
  bodies: BodyPlaces[];
  undrawn: UndrawnPlace[];
}

/**
 * The places of a mission's objectives for its map (ADR 0027): per body, each POI projected
 * (azimuthal equidistant, ADR 0018's geometry) around the mean direction of the body's places on
 * a sphere of their mean distance from its centre, so distances and directions around them are
 * true; `transport` routes between their two places; the others listed as not drawn.
 */
export function missionPlaces(
  objectives: { objective: MissionObjective; view: ObjectiveView | null }[],
  frames: ReadonlyMap<string, PlacesFrame> = new Map(),
): MissionPlaces {
  const drawn = new Map<string, { poi: Poi; uses: PlaceUse[] }>();
  const undrawn = new Map<string, UndrawnPlace>();
  for (const { objective, view } of objectives) {
    for (const place of view?.places ?? []) {
      if (!place.poiId) continue;
      const use: PlaceUse = {
        objectiveId: objective.id,
        // Counted from 1 for people, as on the objective's card.
        step: objective.order + 1,
        title: objective.title,
        role: place.role,
      };
      const { poi } = place;
      if (poi && bodyModel(poi.scene)) {
        const entry = drawn.get(poi.id) ?? { poi, uses: [] };
        entry.uses.push(use);
        drawn.set(poi.id, entry);
      } else {
        const entry = undrawn.get(place.poiId) ?? { poiId: place.poiId, poi, uses: [] };
        entry.uses.push(use);
        undrawn.set(place.poiId, entry);
      }
    }
  }
  const byBody = new Map<string, { poi: Poi; uses: PlaceUse[] }[]>();
  for (const entry of drawn.values()) {
    const model = bodyModel(entry.poi.scene);
    if (model) byBody.set(model, [...(byBody.get(model) ?? []), entry]);
  }
  const bodies = [...byBody.entries()].map(([model, entries]): BodyPlaces => {
    const directions = entries.map((e) => normalize(position(e.poi)) as V);
    const sum = directions.reduce<V>((s, d) => [s[0] + d[0], s[1] + d[1], s[2] + d[2]], [0, 0, 0]);
    // The planet map's frame when given (its landmarks drawn around), else the places' own.
    const frame = frames.get(model);
    const center = frame?.center ?? normalize(sum) ?? directions[0] ?? ([1, 0, 0] as V);
    const radius =
      frame?.radius ??
      entries.reduce((s, e) => s + Math.hypot(...position(e.poi)), 0) / entries.length;
    const project = azimuthalEquidistant(center, radius);
    const at = new Map(
      entries.map((e, i) => {
        const { x, y } = project(directions[i] as V);
        return [e.poi.id, [y, x] as PlaceLatLng];
      }),
    );
    const routes = objectives.flatMap(({ objective, view }) => {
      const from = view?.places.find((p) => p.role === 'pickup');
      const to = view?.places.find((p) => p.role === 'dropoff');
      const [a, b] = [from?.poi, to?.poi];
      if (!a || !b) return [];
      const [fromAt, toAt] = [at.get(a.id), at.get(b.id)];
      return fromAt && toAt
        ? [
            {
              objectiveId: objective.id,
              from: fromAt,
              to: toAt,
              loaded: view?.loaded ?? null,
              distance: surfaceDistance(a, b),
            },
          ]
        : [];
    });
    return {
      model,
      body: factsOfModel(model),
      places: entries.map((e) => ({
        poi: e.poi,
        uses: e.uses,
        at: at.get(e.poi.id) as PlaceLatLng,
      })),
      routes,
    };
  });
  bodies.sort((a, b) => b.places.length - a.places.length);
  return { bodies, undrawn: [...undrawn.values()] };
}

/** Colour of the goods in an objective's sentence: one no role uses. */
export const GOODS_COLOR = '#c084fc';

/** Colour of a place on the map by its role: load in blue, deliver in gold, reach in green. */
export const ROLE_COLORS: Record<PlaceRole, string> = {
  pickup: '#38bdf8',
  dropoff: '#ffba08',
  target: '#22c55e',
};
