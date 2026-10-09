import {
  keepPreviousData,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AncestorsResponseSchema,
  ChildrenCountsResponseSchema,
  DefinitionsResponseSchema,
  ItemSchema,
  PaginatedItemsSchema,
  type Item,
} from '@dyingstar-admin/schemas';
import { ApiError, apiGet } from '@/lib/api';
import { useLiveInterval } from './useLive';

/** Filters of a children / list query. `parentId: ''` targets roots. */
export interface ListFilter {
  parentId?: string | undefined;
  objectType?: string | undefined;
  /** Search in the whole level: a piece of name or UUID (the BFF's `q`). */
  q?: string | undefined;
}

const listPath = ({ parentId, objectType, q }: ListFilter, page: number, pageSize: number) => {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (parentId !== undefined) params.set('parent_id', parentId);
  if (objectType) params.set('object_type', objectType);
  if (q) params.set('q', q);
  return `/api/items?${params}`;
};

/** Query keys, all scoped by game server so switching server never mixes data. */
export const queryKeys = {
  definitions: ['definitions'] as const,
  item: (uuid: string) => ['item', uuid] as const,
  list: (filter: ListFilter, page: number, pageSize: number) =>
    ['items', filter, page, pageSize] as const,
  infinite: (filter: ListFilter, pageSize: number) => ['items-infinite', filter, pageSize] as const,
  ancestors: (uuid: string) => ['ancestors', uuid] as const,
  childrenCounts: (uuid: string) => ['children-counts', uuid] as const,
};

/** Fetches one item; resolves to null when it does not exist. */
export async function fetchItem(uuid: string): Promise<Item | null> {
  try {
    return await apiGet(`/api/items/${encodeURIComponent(uuid)}`, ItemSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function useDefinitions() {
  return useQuery({
    queryKey: queryKeys.definitions,
    queryFn: () => apiGet('/api/definitions', DefinitionsResponseSchema),
    staleTime: 5 * 60 * 1000,
  });
}

/** Polling opt-in: only the data on screen is refreshed live (ADR 0009). */
export interface LiveOption {
  live?: boolean;
}

export function useItem(uuid: string | undefined, { live = false }: LiveOption = {}) {
  const refetchInterval = useLiveInterval('entity', live);
  return useQuery({
    queryKey: queryKeys.item(uuid ?? ''),
    queryFn: () => fetchItem(uuid ?? ''),
    enabled: !!uuid,
    // An item that no longer exists (deleted, or respawned under another UUID by the game) is
    // not polled any more.
    refetchInterval: (query) => (query.state.data === null ? false : refetchInterval),
  });
}

/** Several items at once (reference resolution); results keep the input order. */
export function useItems(uuids: string[]) {
  return useQueries({
    queries: uuids.map((uuid) => ({
      queryKey: queryKeys.item(uuid),
      queryFn: () => fetchItem(uuid),
      staleTime: 30_000,
    })),
  });
}

export function useItemsPage(
  filter: ListFilter,
  page: number,
  pageSize: number,
  { live = false, enabled = true }: LiveOption & { enabled?: boolean } = {},
) {
  const refetchInterval = useLiveInterval('list', live);
  return useQuery({
    queryKey: queryKeys.list(filter, page, pageSize),
    queryFn: () => apiGet(listPath(filter, page, pageSize), PaginatedItemsSchema),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}

/**
 * Several list pages at once (open clusters of the orbit view). Resolves to one page per
 * request, in order, or null while it loads or still shows the previous page's placeholder;
 * the array is stable while the results do not change.
 */
export function useItemsPages(
  requests: { filter: ListFilter; page: number }[],
  pageSize: number,
  { live = false }: LiveOption = {},
) {
  const refetchInterval = useLiveInterval('list', live);
  return useQueries({
    queries: requests.map(({ filter, page }) => ({
      queryKey: queryKeys.list(filter, page, pageSize),
      queryFn: () => apiGet(listPath(filter, page, pageSize), PaginatedItemsSchema),
      placeholderData: keepPreviousData,
      refetchInterval,
    })),
    combine: (results) =>
      results.map((result) => (result.data && !result.isPlaceholderData ? result.data : null)),
  });
}

/** Reads a page ahead of time (e.g. a cluster hovered before it is opened). */
export function usePrefetchItemsPage(pageSize: number) {
  const client = useQueryClient();
  return (filter: ListFilter, page: number) =>
    void client.prefetchQuery({
      queryKey: queryKeys.list(filter, page, pageSize),
      queryFn: () => apiGet(listPath(filter, page, pageSize), PaginatedItemsSchema),
    });
}

/** "Load more" listing used by tree levels (ADR 0005). */
export function useItemsInfinite(
  filter: ListFilter,
  pageSize: number,
  enabled = true,
  { live = false }: LiveOption = {},
) {
  const refetchInterval = useLiveInterval('list', live);
  return useInfiniteQuery({
    refetchInterval,
    queryKey: queryKeys.infinite(filter, pageSize),
    queryFn: ({ pageParam }) => apiGet(listPath(filter, pageParam, pageSize), PaginatedItemsSchema),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.page_size < last.total ? last.page + 1 : undefined,
    enabled,
  });
}

export function useAncestors(uuid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ancestors(uuid ?? ''),
    queryFn: () =>
      apiGet(`/api/items/${encodeURIComponent(uuid ?? '')}/ancestors`, AncestorsResponseSchema),
    enabled: !!uuid,
  });
}

export function useChildrenCounts(
  uuid: string | undefined,
  enabled = true,
  { live = false }: LiveOption = {},
) {
  const refetchInterval = useLiveInterval('counts', live);
  return useQuery({
    refetchInterval,
    queryKey: queryKeys.childrenCounts(uuid ?? ''),
    queryFn: () =>
      apiGet(
        `/api/items/${encodeURIComponent(uuid ?? '')}/children-counts`,
        ChildrenCountsResponseSchema,
      ),
    enabled: enabled && !!uuid,
    staleTime: 30_000,
  });
}
