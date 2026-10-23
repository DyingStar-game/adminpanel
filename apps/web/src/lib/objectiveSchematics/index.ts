import type { Poi } from '@dyingstar-admin/contracts/inventory';
import type { MissionObjective } from '@dyingstar-admin/contracts/mission';
import { valueAt } from '@/lib/schematics';
import { deliverMaterial } from './deliverMaterial';
import { manual } from './manual';
import { ownsItems } from './ownsItems';
import { ObjectiveSchematicSchema, type ObjectiveSchematic, type PlaceRole } from './schema';
import { transport } from './transport';
import { transportPassenger } from './transportPassenger';
import { visit } from './visit';

export type { ObjectiveSchematic, PlaceRole } from './schema';

/** Every objective schematic, validated at load time: a typo fails early (and in tests). */
export const OBJECTIVE_SCHEMATICS: ObjectiveSchematic[] = [
  deliverMaterial,
  transport,
  transportPassenger,
  visit,
  ownsItems,
  manual,
].map((raw) => ObjectiveSchematicSchema.parse(raw));

/** Schematic of an objective kind, if the panel declares one (a kind `mission` added may not). */
export const objectiveSchematicFor = (kind: string): ObjectiveSchematic | null =>
  OBJECTIVE_SCHEMATICS.find((s) => s.kind === kind) ?? null;

/** One place of an objective, as `inventory` answered for it. */
export interface PlaceView {
  role: PlaceRole;
  /** Null when the objective's `params` hold no POI there. */
  poiId: string | null;
  /** `undefined`: not read (no right, `inventory` silent); `null`: `inventory` has no such POI. */
  poi: Poi | null | undefined;
}

/** What an objective asks, read from its `params` and `state` through its kind's schematic. */
export interface ObjectiveView {
  schematic: ObjectiveSchematic;
  places: PlaceView[];
  good: string | null;
  playerId: string | null;
  pooled: boolean;
  /** For a two-phase kind, whether the goods are loaded; null otherwise. */
  loaded: boolean | null;
}

const stringAt = (data: Record<string, unknown> | null, path: string) => {
  const value = data ? valueAt(data, path) : undefined;
  return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * An objective read through its kind's schematic, its POIs resolved from `places` (the mission
 * page's, ADR 0026); null for a kind without a schematic.
 */
export function objectiveView(
  objective: MissionObjective,
  places: Record<string, Poi | null> | undefined,
): ObjectiveView | null {
  const schematic = objectiveSchematicFor(objective.type);
  if (!schematic) return null;
  const { params, state } = objective;
  return {
    schematic,
    places: schematic.places.map(({ path, role }) => {
      const poiId = stringAt(params, `${path}.poiId`);
      return { role, poiId, poi: poiId && places ? places[poiId] : undefined };
    }),
    good: schematic.good ? stringAt(params, schematic.good.path) : null,
    playerId: schematic.player ? stringAt(params, schematic.player.path) : null,
    pooled: schematic.pooled
      ? stringAt(params, schematic.pooled.path) === schematic.pooled.value
      : false,
    loaded: schematic.loaded ? stringAt(state, schematic.loaded.path) !== null : null,
  };
}
