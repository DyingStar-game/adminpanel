import { useQuery } from '@tanstack/react-query';
import { PanelResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';

/**
 * What this panel serves (ADR 0023, 0024): its environment, its one game server, and the game
 * services it manages.
 */
export function usePanel() {
  const query = useQuery({
    queryKey: ['panel'],
    queryFn: () => apiGet('/api/panel', PanelResponseSchema),
    staleTime: Infinity,
  });
  return {
    ...query,
    environment: query.data?.environment ?? null,
    gameServerName: query.data?.gameServerName ?? null,
    services: query.data?.services ?? [],
  };
}
