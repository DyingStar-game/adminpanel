import { useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import type { ItemSearchResult } from '@/components/molecules/ItemSearch';
import { itemLabel } from '@/lib/itemLabel';
import { useItems, useItemsPage } from './queries';

/**
 * Search of the whole universe by a piece of name or UUID (the BFF's `q` without a level):
 * the first `limit` matches with their parent as hint, their total, and whether results are on
 * their way. Sent once typing pauses; the BFF reads persistence whole until it can search
 * (ADR 0021, item 4), so a first search takes a few seconds.
 */
export function useItemSearch(query: string, limit = 8) {
  const typed = query.trim();
  const [q] = useDebounce(typed, 300);
  const page = useItemsPage({ q }, 1, limit, { enabled: q !== '' });
  const items = useMemo(
    () => (q && typed && !page.isPlaceholderData ? (page.data?.items ?? []) : []),
    [q, typed, page.isPlaceholderData, page.data],
  );
  const parentIds = [
    ...new Set(
      items.flatMap((item) => (item.object_data.parent_id ? [item.object_data.parent_id] : [])),
    ),
  ];
  const parents = useItems(parentIds);
  const parentLabel = new Map(
    parentIds.map((id, i) => {
      const parent = parents[i]?.data;
      return [id, parent ? itemLabel(parent) : undefined] as const;
    }),
  );

  const results: ItemSearchResult[] = items.map((item) => ({
    uuid: item.object_uuid,
    label: itemLabel(item),
    objectType: item.object_type,
    hint: parentLabel.get(item.object_data.parent_id ?? ''),
  }));
  return {
    results,
    total: items.length > 0 ? page.data?.total : undefined,
    loading: typed !== '' && (typed !== q || page.isFetching || page.isPlaceholderData),
  };
}
