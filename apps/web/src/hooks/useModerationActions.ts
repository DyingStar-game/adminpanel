import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  zAdjustReputationResponse,
  zEscalateReportResponse,
  zIssueSanctionResponse,
  zRevokeSanctionResponse,
  zUpdateReportStatusResponse,
  type SanctionType,
  type UpdateReportStatusData,
} from '@dyingstar-admin/contracts/social';
import { apiSend } from '@/lib/api';

/** Everything `social` shows may change after an action: sheet, lists, stats, log. */
function useAfterAction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['social'] });
}

const playerPath = (playerId: string, action: string) =>
  `/api/social/players/${encodeURIComponent(playerId)}/${action}`;

export interface SanctionInput {
  playerId: string;
  type: SanctionType;
  reason: string;
  /** Null: no end (a permanent ban, a warning). */
  durationHours: number | null;
}

/** Sanctions a player (ADR 0024 step 3); `social` records the user as the actor. */
export function useIssueSanction() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ playerId, ...body }: SanctionInput) =>
      apiSend('POST', playerPath(playerId, 'sanctions'), { body, schema: zIssueSanctionResponse }),
    onSuccess: afterAction,
  });
}

/** Lifts a sanction in force. */
export function useRevokeSanction() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (id: number) =>
      apiSend('DELETE', `/api/social/sanctions/${id}`, { schema: zRevokeSanctionResponse }),
    onSuccess: afterAction,
  });
}

/** Adds `delta` (−100…100) to a player's reputation (`admin` and above). */
export function useAdjustReputation() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ playerId, ...body }: { playerId: string; delta: number; reason: string }) =>
      apiSend('POST', playerPath(playerId, 'reputation'), {
        body,
        schema: zAdjustReputationResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Moves an open report on: under review, upheld (`resolved`) or dismissed, with a note. */
export function useUpdateReportStatus() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & UpdateReportStatusData['body']) =>
      apiSend('PATCH', `/api/social/reports/${id}`, {
        body,
        schema: zUpdateReportStatusResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Escalates an open report one level (moderator → admin → supervisor). */
export function useEscalateReport() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (id: number) =>
      apiSend('POST', `/api/social/reports/${id}/escalate`, { schema: zEscalateReportResponse }),
    onSuccess: afterAction,
  });
}
