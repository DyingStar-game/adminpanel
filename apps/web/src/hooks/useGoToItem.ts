import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Item } from '@dyingstar-admin/schemas';
import { fetchItem, queryKeys } from './queries';

/** Loads an item through the query cache, for navigation (search, links); null if unknown. */
export function useGoToItem(): (uuid: string) => Promise<Item | null> {
  const queryClient = useQueryClient();
  return useCallback(
    (uuid) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.item(uuid),
        queryFn: () => fetchItem(uuid),
      }),
    [queryClient],
  );
}
