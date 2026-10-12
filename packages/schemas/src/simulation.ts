import { z } from 'zod';

/**
 * What the BFF adds to `universesimulator`'s network (`GET /api/simulation/network`, ADR 0025):
 * its villages, and their warehouses, placed on the planetary map of a body, in the same frame
 * as `/map/$uuid` (ADR 0018), so each lands where its persistence object is drawn there.
 */

/**
 * A village (`poi_village`) or one of its warehouses (`cargo_depot`) projected on the body's
 * map, from the position the simulation caches (`x`, `y`, `z`).
 */
export const SimulationMapPositionSchema = z.object({
  id: z.string(),
  kind: z.enum(['village', 'warehouse']),
  /** Degrees, as the game shows them (`latLonOf`). */
  lat: z.number(),
  lon: z.number(),
  /** Metres above the map's reference radius (the ground measured on the body's items). */
  altitude: z.number(),
  /** Projected metres (azimuthal equidistant, the body's map frame): east, north. */
  x: z.number(),
  y: z.number(),
});
export type SimulationMapPosition = z.infer<typeof SimulationMapPositionSchema>;

/** The body whose map frame placed the villages. */
export const SimulationProjectionSchema = z.object({
  body: z.object({ object_uuid: z.string(), name: z.string().nullable() }),
  referenceRadius: z.number(),
  center: z.object({ lat: z.number(), lon: z.number() }),
});
export type SimulationProjection = z.infer<typeof SimulationProjectionSchema>;

/**
 * Why the villages were not projected: no body asked, no persistence configured, the body
 * unknown to persistence, persistence failing, or a body without any positioned item (no frame).
 */
export const SIMULATION_PROJECTION_ISSUES = [
  'noBody',
  'noPersistence',
  'bodyNotFound',
  'unreachable',
  'noFrame',
] as const;
export type SimulationProjectionIssue = (typeof SIMULATION_PROJECTION_ISSUES)[number];

/** Fields the BFF adds next to `universesimulator`'s `Network`. */
export const SimulationNetworkExtrasSchema = z.object({
  projection: SimulationProjectionSchema.nullable(),
  projectionIssue: z.enum(SIMULATION_PROJECTION_ISSUES).nullable(),
  /**
   * Projected villages and warehouses; one without a cached position is left out. Empty when
   * not projected.
   */
  positions: z.array(SimulationMapPositionSchema),
});
export type SimulationNetworkExtras = z.infer<typeof SimulationNetworkExtrasSchema>;
