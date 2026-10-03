import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BodyMapResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { hiddenTypes } from '@/lib/bodyMap';
import { usePreferences } from '@/stores/preferences';
import { useLiveInterval } from './useLive';

/** Map of a celestial body (ADR 0018), refreshed at the lists' cadence while live. */
export function useBodyMap(uuid: string) {
  const serverId = usePreferences((s) => s.serverId);
  const mapHidden = usePreferences((s) => s.mapHidden);
  // Hidden types are loaded last by the BFF; showing an omitted one asks for it first.
  const hide = hiddenTypes(mapHidden).join(',');
  const refetchInterval = useLiveInterval('list');
  return useQuery({
    queryKey: ['body-map', serverId, uuid, hide],
    queryFn: () =>
      apiGet(
        `/api/bodies/${encodeURIComponent(uuid)}/map${hide ? `?hide=${encodeURIComponent(hide)}` : ''}`,
        BodyMapResponseSchema,
        { serverId },
      ),
    enabled: !!serverId,
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}
