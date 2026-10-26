import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import {
  zGetDashboardResponse,
  zGetLocalPricesResponse,
  zGetOrderResponse,
  zGetPriceHistoryResponse,
  zGetSimulationResponse,
  zGetStockHistoryResponse,
  zGetVillageResponse,
  zListEntitiesResponse,
  zListMintEventsResponse,
  zListOrdersResponse,
  zListPricesResponse,
  zListResourcesResponse,
  zListVillagesResponse,
  zNetwork,
  type OrderStatus,
} from '@dyingstar-admin/contracts/universesimulator';
import { simulationLegOf, type MissionObjective } from '@dyingstar-admin/contracts/mission';
import { SimulationNetworkExtrasSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { useLiveInterval } from './useLive';

/**
 * Reads of the Simulation section (ADR 0025), through `/api/simulation`; villages are the nodes
 * of the simulation (the service's ADR 0013). What changes with the ticks is polled at the
 * lists' rate (ADR 0009, paused with the live switch); the catalogue (resources, entities) is
 * read once.
 */

const PATH = '/api/simulation';
const enc = encodeURIComponent;
/** Query string of the given values, empty ones left out. */
const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.size ? `?${search}` : '';
};

/** The network as the BFF serves it: `universesimulator`'s, plus positions on the body's map. */
export const zSimulationNetwork = zNetwork.extend(SimulationNetworkExtrasSchema.shape);

function useLive<S extends z.ZodType>(key: unknown[], path: string, schema: S, enabled = true) {
  const refetchInterval = useLiveInterval('list', enabled);
  return useQuery({
    queryKey: ['simulation', ...key],
    queryFn: () => apiGet(path, schema),
    placeholderData: keepPreviousData,
    refetchInterval,
    enabled,
  });
}

export const useSimulationDashboard = () =>
  useLive(['dashboard'], `${PATH}/dashboard`, zGetDashboardResponse);

export const useSimulationState = () =>
  useLive(['simulation'], `${PATH}/simulation`, zGetSimulationResponse);

/** The network; `body` places the villages on that body's map frame. */
export const useSimulationNetwork = (body: string | undefined) =>
  useLive(['network', body ?? ''], `${PATH}/network${qs({ body })}`, zSimulationNetwork);

/** Villages with their aggregated stocks and warehouse counts. */
export const useVillages = () => useLive(['villages'], `${PATH}/villages`, zListVillagesResponse);

/**
 * A village: aggregated stocks, its warehouses with their own stocks (the main one marked),
 * policies, flows, capacities, mineral sources, local prices, goods on the way.
 */
export const useVillage = (id: string | undefined) =>
  useLive(['village', id ?? ''], `${PATH}/villages/${enc(id ?? '')}`, zGetVillageResponse, !!id);

export interface OrderFilters {
  status?: OrderStatus | undefined;
  resource?: string | undefined;
  /** Orders whose path goes through this village. */
  village?: string | undefined;
}

/** The latest orders (up to 100) matching the filters, newest first. */
export const useSimulationOrders = (filters: OrderFilters, enabled = true) =>
  useLive(
    ['orders', filters],
    `${PATH}/orders${qs({ ...filters, limit: 100 })}`,
    zListOrdersResponse,
    enabled,
  );

export const useSimulationOrder = (id: string | undefined) =>
  useLive(['order', id ?? ''], `${PATH}/orders/${enc(id ?? '')}`, zGetOrderResponse, !!id);

export const usePriceIndices = () => useLive(['prices'], `${PATH}/prices`, zListPricesResponse);

export const usePriceHistory = (resource: string | undefined) =>
  useLive(
    ['price-history', resource ?? ''],
    `${PATH}/price-history${qs({ resource })}`,
    zGetPriceHistoryResponse,
    !!resource,
  );

/** The last day of the price index of several resources, in the input order (trends). */
export function usePriceHistories(resources: string[]) {
  const refetchInterval = useLiveInterval('list');
  return useQueries({
    queries: resources.map((resource) => ({
      queryKey: ['simulation', 'price-history', resource],
      queryFn: () => apiGet(`${PATH}/price-history${qs({ resource })}`, zGetPriceHistoryResponse),
      refetchInterval,
    })),
  });
}

export const useLocalPrices = (resource: string | undefined) =>
  useLive(
    ['local-prices', resource ?? ''],
    `${PATH}/local-prices${qs({ resource })}`,
    zGetLocalPricesResponse,
    !!resource,
  );

/** The last day of a village's stock of a resource (its warehouses summed). */
export const useVillageHistory = (village: string | undefined, resource: string | undefined) =>
  useLive(
    ['stock-history', village ?? '', resource ?? ''],
    `${PATH}/stock-history${qs({ village, resource })}`,
    zGetStockHistoryResponse,
    !!village && !!resource,
  );

export const useMintEvents = () =>
  useLive(['mint-events'], `${PATH}/mint-events${qs({ limit: 100 })}`, zListMintEventsResponse);

/** Resources of the simulation (read once: a catalogue). */
export const useSimulationResources = () =>
  useQuery({
    queryKey: ['simulation', 'resources'],
    queryFn: () => apiGet(`${PATH}/resources`, zListResourcesResponse),
    staleTime: 5 * 60_000,
  });

/** Political entities mirrored from `social` (read once); a village is a commune. */
export const useSimulationEntities = () =>
  useQuery({
    queryKey: ['simulation', 'entities'],
    queryFn: () => apiGet(`${PATH}/entities`, zListEntitiesResponse),
    staleTime: 5 * 60_000,
  });

/** Names by id of the resources, villages, warehouses and entities, for tables and panels. */
export function useSimulationNames() {
  const resources = useSimulationResources();
  const entities = useSimulationEntities();
  const network = useSimulationNetwork(undefined);
  const villages = network.data?.villages ?? [];
  return {
    resources: new Map((resources.data?.items ?? []).map((r) => [r.id, r])),
    entities: new Map((entities.data?.items ?? []).map((e) => [e.id, e.name])),
    villages: new Map(villages.map((v) => [v.id, v.name])),
    warehouses: new Map(villages.flatMap((v) => v.warehouses.map((w) => [w.id, w.name] as const))),
  };
}

/**
 * The supply order and leg a mission of the simulation carries (ADR 0028): the order its
 * objectives' `payload` names, else the one of the latest 100 whose leg holds the mission.
 * Nothing while `enabled` is false, for another mission, or before the order arrives.
 */
export function useMissionOrder(
  missionId: string,
  objectives: readonly Pick<MissionObjective, 'payload'>[],
  enabled: boolean,
) {
  const named = simulationLegOf(objectives);
  const order = useSimulationOrder(enabled && named ? named.orderId : undefined);
  const latest = useSimulationOrders({}, enabled && !named);
  if (!enabled) return undefined;
  if (named) {
    const leg = order.data?.legs?.find((l) => l.id === named.legId);
    return order.data && leg ? { order: order.data, leg } : undefined;
  }
  return (latest.data?.items ?? []).flatMap((o) =>
    (o.legs ?? []).filter((l) => l.missionId === missionId).map((leg) => ({ order: o, leg })),
  )[0];
}
