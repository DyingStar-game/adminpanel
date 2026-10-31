import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApproveDiscoveryResponseSchema,
  DISCOVERIES_PAGE_SIZE,
  DiscoveriesResponseSchema,
  RefuseDiscoveryResponseSchema,
  type ApproveDiscoveryBody,
  type RefuseDiscoveryBody,
} from '@dyingstar-admin/schemas';
import { apiGet, apiSend } from '@/lib/api';
import type { PlaceNamesSearch } from '@/lib/placeNamesSearch';

/** Every query of the Exploration section starts with this key. */
const EXPLORATION = ['exploration'] as const;

/**
 * Discoveries of a status and kind, by pages (ADR 0032): the names to review oldest proposal
 * first, the decided ones most recent first, and every kind of place met.
 */
export const useDiscoveries = ({ status, kind, page }: PlaceNamesSearch) =>
  useQuery({
    queryKey: [...EXPLORATION, 'discoveries', status, kind, page],
    queryFn: () => {
      const params = new URLSearchParams({
        status,
        page: String(page),
        page_size: String(DISCOVERIES_PAGE_SIZE),
      });
      if (kind) params.set('kind', kind);
      return apiGet(`/api/exploration/discoveries?${params}`, DiscoveriesResponseSchema);
    },
    placeholderData: keepPreviousData,
  });

const discoveryPath = (uuid: string, action: 'approve' | 'refuse') =>
  `/api/exploration/discoveries/${encodeURIComponent(uuid)}/${action}`;

/**
 * Approves a proposed name (or a corrected one): saved on the discovery, the discoverer's POI
 * renamed and the discoverer told, as far as the services answer. The list is read again,
 * whatever the outcome (a conflict means it changed).
 */
export function useApproveDiscovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uuid, ...body }: ApproveDiscoveryBody & { uuid: string }) =>
      ApproveDiscoveryResponseSchema.parse(
        await apiSend('POST', discoveryPath(uuid, 'approve'), {
          body,
          schema: ApproveDiscoveryResponseSchema,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: EXPLORATION }),
  });
}

/** Refuses a proposed name with the reason the discoverer reads; the list is read again. */
export function useRefuseDiscovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uuid, ...body }: RefuseDiscoveryBody & { uuid: string }) =>
      RefuseDiscoveryResponseSchema.parse(
        await apiSend('POST', discoveryPath(uuid, 'refuse'), {
          body,
          schema: RefuseDiscoveryResponseSchema,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: EXPLORATION }),
  });
}
