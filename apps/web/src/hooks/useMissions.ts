import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { zMissionCatalogue, zMissionPage } from '@dyingstar-admin/contracts/mission';
import { apiGet } from '@/lib/api';
import { MISSIONS_PAGE_SIZE, type MissionsSearch } from '@/lib/missionsSearch';

/** `mission`'s catalogue, any status, newest first, by pages (ADR 0024 step O). */
export const useMissions = ({ status, category, kind, page }: MissionsSearch) =>
  useQuery({
    queryKey: ['mission', 'missions', status, category, kind, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(MISSIONS_PAGE_SIZE),
        offset: String((page - 1) * MISSIONS_PAGE_SIZE),
      });
      for (const [key, value] of Object.entries({ status, category, kind })) {
        if (value) params.set(key, value);
      }
      return apiGet(`/api/mission/missions?${params}`, zMissionCatalogue);
    },
    placeholderData: keepPreviousData,
  });

/**
 * One mission whatever its visibility: its objectives, who took it, names from `social`, its
 * objectives' POIs from `inventory` when the account may read them (ADR 0026).
 */
export const useMission = (id: string) =>
  useQuery({
    queryKey: ['mission', 'missions', 'detail', id],
    queryFn: () => apiGet(`/api/mission/missions/${encodeURIComponent(id)}`, zMissionPage),
  });
