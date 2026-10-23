import type { TFunction } from 'i18next';
import type { MissionObjective } from '@dyingstar-admin/contracts/mission';
import { shortId } from '@/lib/format';
import type { ObjectiveView, PlaceView } from './index';

/**
 * A place in a sentence: the POI's name, or its short id when `inventory` was not read, or an
 * unknown place when it has no such POI (ADR 0026).
 */
export function placeName(t: TFunction, place: PlaceView | undefined): string {
  if (!place?.poiId) return t('missions.objectivePlaces.somewhere');
  if (place.poi) return place.poi.name;
  if (place.poi === null)
    return t('missions.objectivePlaces.unknownNamed', { id: shortId(place.poiId) });
  return t('missions.objectivePlaces.poi', { id: shortId(place.poiId) });
}

/**
 * A good as people read it: `drill_parts` → `Drill parts` (`inventory` holds no names for its
 * good types).
 */
export const goodName = (goodType: string) => {
  const words = goodType.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * What is carried or owned, with its quantity: `1 × Drill parts`, or with the objective's unit
 * `20 barrels (Water barrel)`.
 */
export function objectiveGoods(
  objective: MissionObjective,
  good: string | null,
  language: string,
  fallback: string,
): string {
  const quantity = new Intl.NumberFormat(language).format(objective.targetQuantity);
  const name = good ? goodName(good) : fallback;
  return objective.unit ? `${quantity} ${objective.unit} (${name})` : `${quantity} × ${name}`;
}

/** The sentence of an objective: its kind's keys and the values filling them. */
export interface InstructionParts {
  key: string;
  /** For a delivery every assignee adds up to. */
  pooledKey: string | null;
  values: { goods: string; from: string; to: string; player: string };
}

/**
 * What the player has to do (ADR 0026), as keys and values: the sentence marks the goods
 * (`<goods>`), the places by role (`<from>`, `<to>`, `<reach>`) and the passenger (`<player>`), so the page
 * can highlight them.
 */
export function instructionParts(
  t: TFunction,
  objective: MissionObjective,
  view: ObjectiveView,
  { language, players }: { language: string; players: Record<string, string> },
): InstructionParts {
  const by = (role: PlaceView['role']) => view.places.find((p) => p.role === role);
  const kind = view.schematic.kind;
  return {
    key: `missions.objectiveKinds.${kind}.instruction`,
    pooledKey: view.pooled ? `missions.objectiveKinds.${kind}.pooled` : null,
    values: {
      goods: objectiveGoods(objective, view.good, language, t('missions.objectivePlaces.goods')),
      from: placeName(t, by('pickup')),
      to: placeName(t, by('dropoff') ?? by('target')),
      player: view.playerId
        ? (players[view.playerId] ?? shortId(view.playerId))
        : t('missions.objectivePlaces.passenger'),
    },
  };
}

/** The sentence as plain text, its marks left out (titles, tests). */
export function objectiveInstruction(
  t: TFunction,
  objective: MissionObjective,
  view: ObjectiveView,
  options: { language: string; players: Record<string, string> },
): string {
  const { key, pooledKey, values } = instructionParts(t, objective, view, options);
  const plain = (k: string) => String(t(k as never, values)).replace(/<\/?\w+>/g, '');
  return pooledKey ? `${plain(key)} ${plain(pooledKey)}` : plain(key);
}
