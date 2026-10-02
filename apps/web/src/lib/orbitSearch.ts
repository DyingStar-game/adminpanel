import { z } from 'zod';

/**
 * Orbit view state carried by the URL: opened clusters (several at once), the page shown in
 * each, inspected entity. A single `open` string (older links) still opens that cluster.
 */
export const OrbitSearchSchema = z.object({
  open: z
    .preprocess(
      (value) => (typeof value === 'string' ? [value] : value),
      z.array(z.string().min(1)),
    )
    .catch([])
    .default([]),
  pages: z.record(z.string(), z.coerce.number().int().min(1)).catch({}).default({}),
  selected: z.string().min(1).optional().catch(undefined),
});

export type OrbitSearch = z.infer<typeof OrbitSearchSchema>;

/** Page shown in an open cluster (1 by default). */
export const pageOf = (search: OrbitSearch, objectType: string) => search.pages[objectType] ?? 1;

/** Opens a closed cluster, closes an open one (forgetting its page). */
export function toggleCluster(search: OrbitSearch, objectType: string): OrbitSearch {
  if (!search.open.includes(objectType)) {
    return { ...search, open: [...search.open, objectType] };
  }
  return {
    ...search,
    open: search.open.filter((type) => type !== objectType),
    pages: Object.fromEntries(Object.entries(search.pages).filter(([type]) => type !== objectType)),
  };
}

/** Shows another page of an open cluster. */
export const setClusterPage = (search: OrbitSearch, objectType: string, page: number) => ({
  ...search,
  pages: { ...search.pages, [objectType]: Math.max(1, page) },
});
