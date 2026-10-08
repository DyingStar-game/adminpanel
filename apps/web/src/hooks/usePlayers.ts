import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PaginatedItemsSchema, type Item } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';

/** Every player, human players first then by name (NPCs make most of them). */
export function usePlayers(enabled = true) {
  const query = useQuery({
    queryKey: ['players'],
    queryFn: () =>
      apiGet('/api/items?object_type=player&page=1&page_size=10000', PaginatedItemsSchema),
    enabled,
    staleTime: 60_000,
  });
  const players = useMemo(() => {
    const items: Item[] = query.data?.items ?? [];
    const name = (item: Item) => String(item.object_data.name ?? '');
    return [...items].sort(
      (a, b) =>
        Number(a.object_data.is_npc === true) - Number(b.object_data.is_npc === true) ||
        name(a).localeCompare(name(b)),
    );
  }, [query.data]);
  return { ...query, players };
}
