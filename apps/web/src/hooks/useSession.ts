import { useQuery } from '@tanstack/react-query';
import { LogoutResponseSchema, MeResponseSchema } from '@dyingstar-admin/schemas';
import { ApiError, apiGet, apiSend } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/lib/queryClient';

/** Where the BFF starts the Keycloak sign-in, coming back to the page on screen (ADR 0023). */
export const signInUrl = (returnTo = window.location.pathname + window.location.search) =>
  `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

/** Ends the panel session and Keycloak's, then leaves for Keycloak's end of session. */
export async function signOut() {
  const res = await apiSend('POST', '/auth/logout', { schema: LogoutResponseSchema });
  window.location.assign(res?.redirect ?? '/');
}

/**
 * The signed-in user (`GET /api/me`). `signedOut` when the BFF answers 401, so the app shows the
 * sign-in page; any 401 elsewhere refreshes this query (`lib/queryClient.ts`).
 */
export function useSession() {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => apiGet('/api/me', MeResponseSchema),
    staleTime: 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
  });
  const signedOut = query.error instanceof ApiError && query.error.status === 401;
  return { ...query, me: query.data ?? null, signedOut };
}
