import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  zBulkNpcsResponse,
  zCancelNpcTaskResponse,
  zCreateNpcTaskResponse,
  zCreateNpcsResponse,
  zCreatePatternResponse,
  zImportSchedulesResponse,
  zPatchNpcResponse,
  zPutActivityActionsResponse,
  zPutSettingsResponse,
  zReassignNpcResponse,
  zSetVillageWorkplaceResponse,
  zSpawnNpcResponse,
  zUpdatePatternResponse,
  type PanelActivityActions,
  type PanelBulk,
  type PanelCreateNpcs,
  type PanelCreatePattern,
  type PanelImportSchedules,
  type PanelNewTask,
  type PanelNpcPatch,
  type PanelUpdatePattern,
  type PanelWorkplace,
} from '@dyingstar-admin/contracts/npc';
import { apiSend } from '@/lib/api';

/**
 * Writes of the NPCs section (ADR 0026, `admin` or `supervisor`). Every NPC view is refreshed
 * after a write: the roster, the counts, the routine, the tasks and the events may all change.
 */
function useAfterAction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['npc'] });
}

const PATH = '/api/npc';
const enc = encodeURIComponent;

/** Turns every enabled NPC on or off on the servers. */
export function useNpcSwitch() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (npcsEnabled: boolean) =>
      apiSend('PUT', `${PATH}/settings`, { body: { npcsEnabled }, schema: zPutSettingsResponse }),
    onSuccess: afterAction,
  });
}

/** Creates NPCs (generated names, Keycloak accounts). */
export function useCreateNpcs() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelCreateNpcs) =>
      apiSend('POST', `${PATH}/npcs`, { body, schema: zCreateNpcsResponse }),
    onSuccess: afterAction,
  });
}

/** Spawns, despawns or deletes several NPCs, by ids or by count. */
export function useBulkNpcs() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelBulk) =>
      apiSend('POST', `${PATH}/npcs/bulk`, { body, schema: zBulkNpcsResponse }),
    onSuccess: afterAction,
  });
}

/** Spawns or despawns one NPC. */
export function useNpcToggle() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'spawn' | 'despawn' }) =>
      apiSend('POST', `${PATH}/npcs/${enc(id)}/${action}`, { schema: zSpawnNpcResponse }),
    onSuccess: afterAction,
  });
}

/** Forgets an NPC's role and workplace: the automatic assignment runs again. */
export function useReassignNpc() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (id: string) =>
      apiSend('POST', `${PATH}/npcs/${enc(id)}/reassign`, { schema: zReassignNpcResponse }),
    onSuccess: afterAction,
  });
}

/** Sets a new random Keycloak password. */
export function useResetNpcCredentials() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (id: string) => apiSend('POST', `${PATH}/npcs/${enc(id)}/reset-credentials`),
    onSuccess: afterAction,
  });
}

/** Deletes an NPC: its runtime, its Keycloak user, its row. */
export function useDeleteNpc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend('DELETE', `${PATH}/npcs/${enc(id)}`),
    // Its own page is left: refresh the lists, never read the deleted NPC again.
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['npc', 'npc', id] });
      return queryClient.invalidateQueries({ queryKey: ['npc'] });
    },
  });
}

/** Edits an NPC (hot-pushed to its runtime). */
export function usePatchNpc() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PanelNpcPatch }) =>
      apiSend('PATCH', `${PATH}/npcs/${enc(id)}`, { body: patch, schema: zPatchNpcResponse }),
    onSuccess: afterAction,
  });
}

/** Gives an NPC a task, which pre-empts its schedule. */
export function useCreateNpcTask() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, task }: { id: string; task: PanelNewTask }) =>
      apiSend('POST', `${PATH}/npcs/${enc(id)}/tasks`, {
        body: task,
        schema: zCreateNpcTaskResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Cancels an open task (aborted when running). */
export function useCancelNpcTask() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: string; taskId: bigint }) =>
      apiSend('DELETE', `${PATH}/npcs/${enc(id)}/tasks/${taskId}`, {
        schema: zCancelNpcTaskResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Creates a shift pattern, or changes one (`name` given). */
export function useSavePattern() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (
      input: { create: PanelCreatePattern } | { name: string; update: PanelUpdatePattern },
    ) =>
      'create' in input
        ? apiSend('POST', `${PATH}/schedule/patterns`, {
            body: input.create,
            schema: zCreatePatternResponse,
          })
        : apiSend('PUT', `${PATH}/schedule/patterns/${enc(input.name)}`, {
            body: input.update,
            schema: zUpdatePatternResponse,
          }),
    onSuccess: afterAction,
  });
}

/** Deletes a shift pattern; refused (409) while NPCs use it. */
export function useDeletePattern() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (name: string) => apiSend('DELETE', `${PATH}/schedule/patterns/${enc(name)}`),
    onSuccess: afterAction,
  });
}

/** Replaces the actions of the activities given. */
export function useSaveActivityActions() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelActivityActions) =>
      apiSend('PUT', `${PATH}/schedule/activity-actions`, {
        body,
        schema: zPutActivityActionsResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Imports the service's `schedules.yaml`, or the YAML given. */
export function useImportSchedules() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelImportSchedules) =>
      apiSend('POST', `${PATH}/schedule/import`, { body, schema: zImportSchedulesResponse }),
    onSuccess: afterAction,
  });
}

/** Sets a village's workplace by hand. */
export function useSetWorkplace() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: PanelWorkplace }) =>
      apiSend('PUT', `${PATH}/villages/${enc(code)}/workplace`, {
        body,
        schema: zSetVillageWorkplaceResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Forgets a village's workplace: resolved again at the next assignment. */
export function useDeleteWorkplace() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (code: string) => apiSend('DELETE', `${PATH}/villages/${enc(code)}/workplace`),
    onSuccess: afterAction,
  });
}
