import { useCan } from './useCan';
import { useCorporation, usePoliticalEntity } from './useOrganisations';
import { usePanel } from './usePanel';
import { useSimulationEntities } from './useSimulation';

/** Who issues or pays for a mission, as `mission` names their kind. */
export type HolderType = 'player' | 'corporation' | 'politics';

/**
 * The name of a corporation or political entity a mission refers to, which `mission` gives as an
 * id only: a political entity from `universesimulator`'s mirror (one list, read once) else from
 * `social`, a corporation from `social`, for who may read them; `undefined` otherwise.
 */
export function useHolderName(type: HolderType, id: string): string | undefined {
  const can = useCan();
  const { services } = usePanel();
  const social = services.includes('social') && can('social.moderate');
  const simulation = services.includes('universesimulator') && can('simulation.view');
  const politics = type === 'politics';

  const mirror = useSimulationEntities(politics && simulation);
  const mirrored = mirror.data?.items.find((e) => e.id === id)?.name;
  // `social` only for what the mirror does not hold, once it answered (or is not read).
  const political = usePoliticalEntity(
    politics && social && !mirrored && !mirror.isLoading ? id : null,
  );
  const corporation = useCorporation(id, type === 'corporation' && social);

  if (politics) return mirrored ?? political.data?.name;
  if (type === 'corporation') return corporation.data?.name;
  return undefined;
}
