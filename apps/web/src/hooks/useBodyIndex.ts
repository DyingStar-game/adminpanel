import { useMemo } from 'react';
import { sceneModel } from '@/lib/schematics';
import { useItemsPage } from './queries';

/**
 * Items of the celestial bodies by scene model (`tarsis_3` → SandBox's UUID): one read of the
 * planets and moons (19 today) and one of the star, to open a body drawn on a schematic.
 */
export function useBodyIndex(enabled = true): ReadonlyMap<string, string> {
  const planets = useItemsPage({ objectType: 'planet' }, 1, 200, { enabled });
  const stars = useItemsPage({ objectType: 'star' }, 1, 10, { enabled });
  return useMemo(() => {
    const index = new Map<string, string>();
    if (!enabled) return index;
    for (const item of [...(planets.data?.items ?? []), ...(stars.data?.items ?? [])]) {
      const model = sceneModel(item.object_data.scenename);
      if (model) index.set(model, item.object_uuid);
    }
    return index;
  }, [enabled, planets.data, stars.data]);
}
