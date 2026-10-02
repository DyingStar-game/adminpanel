import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScenesResponseSchema } from '@dyingstar-admin/schemas';
import type { SceneOption } from '@/components/molecules/SceneCombobox';
import { apiGet } from '@/lib/api';
import { SCHEMATICS } from '@/lib/schematics';
import { usePreferences } from '@/stores/preferences';

/**
 * Scenes to suggest for `scenename`: those in use on the server (BFF, cached full scan) plus
 * those declared by schematics, even if no item uses them yet.
 */
export function useSceneOptions(): SceneOption[] {
  const serverId = usePreferences((s) => s.serverId);
  const query = useQuery({
    queryKey: ['scenes', serverId],
    queryFn: () => apiGet('/api/items/scenes', ScenesResponseSchema, { serverId }),
    enabled: !!serverId,
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => {
    const used: SceneOption[] = (query.data?.scenes ?? []).map((s) => ({
      scenename: s.scenename,
      objectType: s.object_type,
      count: s.count,
    }));
    const known = new Set(used.map((s) => s.scenename));
    const declared = SCHEMATICS.filter(
      (s) => !s.scenename.includes('*') && !known.has(s.scenename),
    ).map((s) => ({ scenename: s.scenename, objectType: '', count: 0 }));
    return [...used, ...declared];
  }, [query.data]);
}
