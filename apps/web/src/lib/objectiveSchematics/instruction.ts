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

/** The objective's quantity with its unit, e.g. `20 barrels`. */
export const objectiveQuantity = (objective: MissionObjective, language: string) =>
  `${new Intl.NumberFormat(language).format(objective.targetQuantity)}${objective.unit ? ` ${objective.unit}` : ''}`;

/**
 * What the player has to do, in a sentence filled with the objective's values (ADR 0026): its
 * kind's `instruction`, plus `pooled` for a delivery every assignee adds up to.
 */
export function objectiveInstruction(
  t: TFunction,
  objective: MissionObjective,
  view: ObjectiveView,
  { language, players }: { language: string; players: Record<string, string> },
): string {
  const by = (role: PlaceView['role']) => view.places.find((p) => p.role === role);
  const values = {
    quantity: objectiveQuantity(objective, language),
    good: view.good ?? t('missions.objectivePlaces.goods'),
    from: placeName(t, by('pickup')),
    to: placeName(t, by('dropoff') ?? by('target')),
    player: view.playerId
      ? (players[view.playerId] ?? shortId(view.playerId))
      : t('missions.objectivePlaces.passenger'),
  };
  const kind = view.schematic.kind;
  const sentence = t(`missions.objectiveKinds.${kind}.instruction` as never, values);
  return view.pooled
    ? `${sentence} ${t(`missions.objectiveKinds.${kind}.pooled` as never, values)}`
    : sentence;
}
