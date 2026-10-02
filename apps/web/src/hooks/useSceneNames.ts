import { useQuery } from '@tanstack/react-query';
import { PaginatedItemsSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { usePreferences } from '@/stores/preferences';

/** How many items of a type are sampled to collect its known scenes. */
const SAMPLE_SIZE = 500;

/**
 * `scenename` values already used by items of a type, most frequent first: Horizon needs a
 * scene to instantiate an item, so creation suggests the known ones.
 */
export function useSceneNames(objectType: string | undefined) {
  const serverId = usePreferences((s) => s.serverId);
  return useQuery({
    queryKey: ['scene-names', serverId, objectType],
    queryFn: async () => {
      const params = new URLSearchParams({
        object_type: objectType ?? '',
        page: '1',
        page_size: String(SAMPLE_SIZE),
      });
      const page = await apiGet(`/api/items?${params}`, PaginatedItemsSchema, { serverId });
      const counts = new Map<string, number>();
      for (const item of page.items) {
        const scene = item.object_data.scenename;
        if (typeof scene === 'string' && scene) counts.set(scene, (counts.get(scene) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([scene]) => scene);
    },
    enabled: !!serverId && !!objectType,
    staleTime: 5 * 60 * 1000,
  });
}
