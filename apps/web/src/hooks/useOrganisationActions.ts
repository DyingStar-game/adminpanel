import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  zInternalCreateCorporationResponse,
  zInternalCreatePoliticalEntityResponse,
  zInternalSetCorporationMemberRankResponse,
  zInternalTransferCorporationCeoResponse,
  zInternalTransferPoliticalHeadResponse,
  zInternalUpdateCorporationResponse,
  zInternalUpdatePoliticalEntityResponse,
  type InternalCreateCorporationData,
  type InternalCreatePoliticalEntityData,
  type InternalUpdateCorporationData,
  type InternalUpdatePoliticalEntityData,
} from '@dyingstar-admin/contracts/social';
import { apiSend } from '@/lib/api';

/** Organisations, players' memberships and lists may all change after an action. */
function useAfterAction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['social'] });
}

const corporationPath = (id: string) => `/api/social/corporations/${encodeURIComponent(id)}`;
const politicalPath = (id: string) => `/api/social/politics/${encodeURIComponent(id)}`;

/** Creates a corporation with the CEO chosen (ADR 0024 step N, through `svc-admin`). */
export function useCreateCorporation() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: InternalCreateCorporationData['body']) =>
      apiSend('POST', '/api/social/corporations', {
        body,
        schema: zInternalCreateCorporationResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useUpdateCorporation(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: InternalUpdateCorporationData['body']) =>
      apiSend('PATCH', corporationPath(id), { body, schema: zInternalUpdateCorporationResponse }),
    onSuccess: afterAction,
  });
}

export function useDisbandCorporation(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: () => apiSend('DELETE', corporationPath(id)),
    onSuccess: afterAction,
  });
}

/** Gives the CEO to a member; the former CEO takes the highest rank below. */
export function useTransferCorporation(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (playerId: string) =>
      apiSend('POST', `${corporationPath(id)}/transfer`, {
        body: { playerId },
        schema: zInternalTransferCorporationCeoResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useSetMemberRank(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ playerId, rankId }: { playerId: string; rankId: number }) =>
      apiSend('PATCH', `${corporationPath(id)}/members/${encodeURIComponent(playerId)}`, {
        body: { rankId },
        schema: zInternalSetCorporationMemberRankResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useRemoveMember(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (playerId: string) =>
      apiSend('DELETE', `${corporationPath(id)}/members/${encodeURIComponent(playerId)}`),
    onSuccess: afterAction,
  });
}

/** Creates a political entity with the head chosen. */
export function useCreatePoliticalEntity() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: InternalCreatePoliticalEntityData['body']) =>
      apiSend('POST', '/api/social/politics', {
        body,
        schema: zInternalCreatePoliticalEntityResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useUpdatePoliticalEntity(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: InternalUpdatePoliticalEntityData['body']) =>
      apiSend('PATCH', politicalPath(id), { body, schema: zInternalUpdatePoliticalEntityResponse }),
    onSuccess: afterAction,
  });
}

export function useDisbandPoliticalEntity(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: () => apiSend('DELETE', politicalPath(id)),
    onSuccess: afterAction,
  });
}

/** Gives the head office to a member. */
export function useTransferPoliticalEntity(id: string) {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (playerId: string) =>
      apiSend('POST', `${politicalPath(id)}/transfer`, {
        body: { playerId },
        schema: zInternalTransferPoliticalHeadResponse,
      }),
    onSuccess: afterAction,
  });
}
