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
 * How much of the goods, one way for every objective: the quantity, then the objective's unit when
 * it has one (`1`, `20 barrels`); the goods follow as `mission` stores them (`× drill_parts`).
 */
export function objectiveAmount(objective: MissionObjective, language: string): string {
  const quantity = new Intl.NumberFormat(language).format(objective.targetQuantity);
  return `${quantity}${objective.unit ? ` ${objective.unit}` : ''}`;
}

/** The sentence of an objective: its kind's keys and the values filling them. */
export interface InstructionParts {
  key: string;
  /** For a delivery every assignee adds up to. */
  pooledKey: string | null;
  values: { amount: string; good: string; from: string; to: string; player: string };
}

/**
 * What the player has to do (ADR 0026), as keys and values: the sentence marks the goods
 * (`<goods>`, their type in `<good>`), the places by role (`<from>`, `<to>`, `<reach>`) and the passenger (`<player>`), so the page
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
      amount: objectiveAmount(objective, language),
      // A technical value of the service, shown as stored (no names exist for good types).
      good: view.good ?? t('missions.objectivePlaces.goods'),
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
