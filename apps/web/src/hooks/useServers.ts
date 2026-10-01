import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ServersResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { usePreferences } from '@/stores/preferences';

/** Game servers known by the BFF, and the one selected by this viewer. */
export function useServers() {
  const { serverId, setServerId } = usePreferences();
  const query = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiGet('/api/servers', ServersResponseSchema),
    staleTime: Infinity,
  });
  const servers = query.data?.servers ?? [];
  const selected = servers.find((s) => s.id === serverId) ?? servers[0] ?? null;

  // Keep the stored id valid when the configured servers change.
  useEffect(() => {
    if (selected && selected.id !== serverId) setServerId(selected.id);
  }, [selected, serverId, setServerId]);

  return { ...query, servers, selected, select: setServerId };
}
