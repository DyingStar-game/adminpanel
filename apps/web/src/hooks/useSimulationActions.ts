import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  zCreateFlowResponse,
  zForceTickResponse,
  zUpdateFlowResponse,
  zUpdateVillageResponse,
  zUpsertVillagePolicyResponse,
  zUpsertWarehouseCapacityResponse,
  type PanelFlow,
  type PanelFlowChange,
  type PanelVillagePolicy,
  type PanelVillageUpdate,
  type PanelWarehouseCapacity,
  zPauseSimulationResponse,
  zResumeSimulationResponse,
} from '@dyingstar-admin/contracts/universesimulator';
import { apiSend } from '@/lib/api';

/** Every simulation view may change after an action. */
function useAfterAction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['simulation'] });
}

/** Pauses or resumes the simulation (`admin` or `supervisor`, ADR 0025). */
export function useSimulationRunning() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (action: 'pause' | 'resume') =>
      apiSend('POST', `/api/simulation/simulation/${action}`, {
        schema: action === 'pause' ? zPauseSimulationResponse : zResumeSimulationResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Runs a tick now, even when paused; refused (409) while one is running. */
export function useForceTick() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: () =>
      apiSend('POST', '/api/simulation/simulation/tick', { schema: zForceTickResponse }),
    onSuccess: afterAction,
  });
}

/** Cancels an open order: its mission, its inventory hold, the order itself. */
export function useCancelOrder() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (id: string) =>
      apiSend('POST', `/api/simulation/orders/${encodeURIComponent(id)}/cancel`),
    onSuccess: afterAction,
  });
}

const enc = encodeURIComponent;

/**
 * Configuration (ADR 0025 › Configuration, `admin` or `supervisor`): a village's policies, flows
 * and main warehouse, a warehouse's capacities. Every simulation view is refreshed after a
 * change (stocks, alerts, autonomy depend on it).
 */
export function useSaveVillagePolicy() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelVillagePolicy) =>
      apiSend('PUT', '/api/simulation/village-policies', {
        body,
        schema: zUpsertVillagePolicyResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useDeleteVillagePolicy() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ villageId, resourceId }: { villageId: string; resourceId: string }) =>
      apiSend('DELETE', `/api/simulation/village-policies/${enc(villageId)}/${enc(resourceId)}`),
    onSuccess: afterAction,
  });
}

export function useSaveWarehouseCapacity() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelWarehouseCapacity) =>
      apiSend('PUT', '/api/simulation/warehouse-capacities', {
        body,
        schema: zUpsertWarehouseCapacityResponse,
      }),
    onSuccess: afterAction,
  });
}

/** Sets a village's main warehouse, where deliveries and production go. */
export function useUpdateVillage() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: PanelVillageUpdate }) =>
      apiSend('PUT', `/api/simulation/villages/${enc(id)}`, {
        body: change,
        schema: zUpdateVillageResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useCreateFlow() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (body: PanelFlow) =>
      apiSend('POST', '/api/simulation/flows', { body, schema: zCreateFlowResponse }),
    onSuccess: afterAction,
  });
}

export function useUpdateFlow() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: PanelFlowChange }) =>
      apiSend('PUT', `/api/simulation/flows/${enc(id)}`, {
        body: change,
        schema: zUpdateFlowResponse,
      }),
    onSuccess: afterAction,
  });
}

export function useDeleteFlow() {
  const afterAction = useAfterAction();
  return useMutation({
    mutationFn: (id: string) => apiSend('DELETE', `/api/simulation/flows/${enc(id)}`),
    onSuccess: afterAction,
  });
}
