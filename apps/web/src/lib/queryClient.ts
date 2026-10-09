import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';

/** Query key of `GET /api/me` (see `hooks/useSession.ts`). */
export const SESSION_QUERY_KEY = ['me'] as const;

const isSessionQuery = (queryKey: readonly unknown[]) => queryKey[0] === SESSION_QUERY_KEY[0];

/**
 * The app's query client. A 401 anywhere means the session ended (expired, signed out
 * elsewhere): it asks `/api/me` again, which brings the sign-in page (ADR 0023). Never for
 * `/api/me` itself: its 401 is the signed-out state, asking again would loop.
 */
export function createQueryClient() {
  const sessionEnded = (error: Error, queryKey?: readonly unknown[]) => {
    if (queryKey && isSessionQuery(queryKey)) return;
    if (error instanceof ApiError && error.status === 401) {
      void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => sessionEnded(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error) => sessionEnded(error) }),
  });
  return client;
}
