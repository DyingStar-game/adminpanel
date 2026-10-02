import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BodyMapResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { usePreferences } from '@/stores/preferences';
import { useLiveInterval } from './useLive';

/** Map of a celestial body (ADR 0018), refreshed at the lists' cadence while live. */
export function useBodyMap(uuid: string) {
  const serverId = usePreferences((s) => s.serverId);
  const refetchInterval = useLiveInterval('list');
  return useQuery({
    queryKey: ['body-map', serverId, uuid],
    queryFn: () =>
      apiGet(`/api/bodies/${encodeURIComponent(uuid)}/map`, BodyMapResponseSchema, { serverId }),
    enabled: !!serverId,
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}
