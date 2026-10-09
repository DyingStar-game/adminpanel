import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  zGetCorporationResponse,
  zGetPoliticalEntityResponse,
  zListCorporationMembersResponse,
  zListCorporationsResponse,
  zListPoliticalChildrenResponse,
  zListPoliticalEntitiesResponse,
  zListPoliticalMembersResponse,
  zListSubsidiariesResponse,
  type PoliticalEntityType,
} from '@dyingstar-admin/contracts/social';
import { apiGet } from '@/lib/api';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';

/** `limit` / `offset` of a 1-based page, and more query parameters. */
const query = (page: number, more: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams({
    limit: String(MODERATION_PAGE_SIZE),
    offset: String((page - 1) * MODERATION_PAGE_SIZE),
  });
  for (const [key, value] of Object.entries(more)) if (value) params.set(key, value);
  return params;
};

const corporationPath = (id: string) => `/api/social/corporations/${encodeURIComponent(id)}`;
const politicalPath = (id: string) => `/api/social/politics/${encodeURIComponent(id)}`;

/** Corporations by name or ticker (ADR 0024 step 2). */
export const useCorporations = (search: string, page: number, enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['social', 'corporations', search, page],
    queryFn: () =>
      apiGet(`/api/social/corporations?${query(page, { search })}`, zListCorporationsResponse),
    placeholderData: keepPreviousData,
  });

/** A corporation's page: ranks, parent, first members and subsidiaries. */
export const useCorporation = (id: string) =>
  useQuery({
    queryKey: ['social', 'corporation', id],
    queryFn: () => apiGet(corporationPath(id), zGetCorporationResponse),
  });

export const useCorporationMembers = (id: string, page: number) =>
  useQuery({
    queryKey: ['social', 'corporation', id, 'members', page],
    queryFn: () =>
      apiGet(`${corporationPath(id)}/members?${query(page)}`, zListCorporationMembersResponse),
    placeholderData: keepPreviousData,
  });

export const useSubsidiaries = (id: string, page: number) =>
  useQuery({
    queryKey: ['social', 'corporation', id, 'subsidiaries', page],
    queryFn: () =>
      apiGet(`${corporationPath(id)}/subsidiaries?${query(page)}`, zListSubsidiariesResponse),
    placeholderData: keepPreviousData,
  });

/** Political entities by name, of one level or all. */
export const usePoliticalEntities = (
  search: string,
  type: PoliticalEntityType | undefined,
  page: number,
  enabled = true,
) =>
  useQuery({
    enabled,
    queryKey: ['social', 'politics', search, type, page],
    queryFn: () =>
      apiGet(
        `/api/social/politics?${query(page, { search, type })}`,
        zListPoliticalEntitiesResponse,
      ),
    placeholderData: keepPreviousData,
  });

/** A political entity's page: offices, parent, first members and children. */
export const usePoliticalEntity = (id: string | null) =>
  useQuery({
    queryKey: ['social', 'political', id],
    queryFn: () => apiGet(politicalPath(id ?? ''), zGetPoliticalEntityResponse),
    enabled: !!id,
  });

export const usePoliticalMembers = (id: string, page: number) =>
  useQuery({
    queryKey: ['social', 'political', id, 'members', page],
    queryFn: () =>
      apiGet(`${politicalPath(id)}/members?${query(page)}`, zListPoliticalMembersResponse),
    placeholderData: keepPreviousData,
  });

export const usePoliticalChildren = (id: string, page: number) =>
  useQuery({
    queryKey: ['social', 'political', id, 'children', page],
    queryFn: () =>
      apiGet(`${politicalPath(id)}/children?${query(page)}`, zListPoliticalChildrenResponse),
    placeholderData: keepPreviousData,
  });
