import type { Poi } from '@dyingstar-admin/contracts/inventory';
import { dot, latLonOf, normalize, type V } from '@dyingstar-admin/schemas';
import { factsOfModel, type BodyFacts } from './bodies';

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
