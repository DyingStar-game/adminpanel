import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BodyMapResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import type { Item } from '@dyingstar-admin/schemas';
import { hiddenTypes, isShown } from '@/lib/bodyMap';
import { usePreferences } from '@/stores/preferences';
import { useLiveInterval } from './useLive';

/**
 * Map of a celestial body (ADR 0018), refreshed at the lists' cadence while live. Only the shown
 * types are loaded (the hidden ones are counted); the selected item is added when its type is
 * hidden, so it stays on the map.
 */
export function useBodyMap(uuid: string, selected?: Item | null) {
  const mapHidden = usePreferences((s) => s.mapHidden);
  const hide = hiddenTypes(mapHidden).join(',');
  const include =
    selected && !isShown(selected.object_type, mapHidden) ? selected.object_uuid : undefined;
  const params = new URLSearchParams();
  if (hide) params.set('hide', hide);
  if (include) params.set('include', include);
  const search = params.size > 0 ? `?${params.toString()}` : '';
  const refetchInterval = useLiveInterval('list');
  return useQuery({
    queryKey: ['body-map', uuid, hide, include],
    queryFn: () =>
      apiGet(`/api/bodies/${encodeURIComponent(uuid)}/map${search}`, BodyMapResponseSchema),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}
