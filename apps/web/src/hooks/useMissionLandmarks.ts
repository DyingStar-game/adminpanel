import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BodyMapResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { LANDMARK_TYPES } from '@/lib/places';
import { sceneModel } from '@/lib/schematics';
import { useCan } from './useCan';
import { usePanel } from './usePanel';
import { useDefinitions, useItemsPage } from './queries';

/** Planets of persistence, read once: a POI's body is found by its scene model. */
const PLANETS_PAGE = 100;

/**
 * The fixed landmarks around a mission's places (ADR 0027 update): the persistence planet whose
 * scene is the places' body (`tarsis_3` → `…/tarsis_3.tscn`), then its map (ADR 0018) with only
 * the `shown` landmark types loaded, every other type left out. For who reads persistence only;
 * `readable: false` otherwise.
 */
export function useMissionLandmarks(model: string | undefined, shown: readonly string[]) {
  const can = useCan();
  const { services } = usePanel();
  const readable = services.includes('persistence') && can('persistence.read');
  const planets = useItemsPage({ objectType: 'planet' }, 1, PLANETS_PAGE, {
    enabled: readable && !!model,
  });
  const body = model
    ? planets.data?.items.find((p) => sceneModel(p.object_data.scenename) === model)
    : undefined;
  const definitions = useDefinitions();
  const hide = (definitions.data?.definitions ?? [])
    .map((d) => d.type)
    .filter((type) => !LANDMARK_TYPES.includes(type) || !shown.includes(type))
    .sort()
    .join(',');
  const map = useQuery({
    queryKey: ['mission-landmarks', body?.object_uuid, hide],
    queryFn: () =>
      apiGet(
        `/api/bodies/${encodeURIComponent(body?.object_uuid ?? '')}/map?hide=${encodeURIComponent(hide)}`,
        BodyMapResponseSchema,
      ),
    enabled: !!body && !!definitions.data,
    placeholderData: keepPreviousData,
  });
  return { readable, body, map };
}
