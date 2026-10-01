import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Item } from '@dyingstar-admin/schemas';
import { usePreferences } from '@/stores/preferences';
import { fetchItem, queryKeys } from './queries';

/** Loads an item through the query cache, for navigation (search, links); null if unknown. */
export function useGoToItem(): (uuid: string) => Promise<Item | null> {
  const queryClient = useQueryClient();
  const serverId = usePreferences((s) => s.serverId);
  return useCallback(
    (uuid) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.item(serverId, uuid),
        queryFn: () => fetchItem(serverId, uuid),
      }),
    [queryClient, serverId],
  );
}
