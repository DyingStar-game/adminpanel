import {
  zCancelOrderResponse,
  zCreateFlowResponse,
  zDeleteFlowResponse,
  zDeleteVillagePolicyResponse,
  zDeleteWarehouseCapacityResponse,
  zForceTickResponse,
  zGetDashboardResponse,
  zGetIncomingResponse,
  zGetLocalPricesResponse,
  zGetNetworkResponse,
  zGetOrderResponse,
  zGetPriceHistoryResponse,
  zGetSimulationResponse,
  zGetStockHistoryResponse,
  zGetVillageResponse,
  zGetWarehouseResponse,
  zListEntitiesResponse,
  zListMintEventsResponse,
  zListOrdersResponse,
  zListPricesResponse,
  zListResourcesResponse,
  zListVillagePoliciesResponse,
  zListVillagesResponse,
  zListWarehouseCapacitiesResponse,
  zPauseSimulationResponse,
  zResumeSimulationResponse,
  zUpdateFlowResponse,
  zUpdateVillageResponse,
  zUpsertVillagePolicyResponse,
  zUpsertWarehouseCapacityResponse,
  type PanelFlow,
  type PanelFlowChange,
  type PanelVillagePolicy,
  type PanelVillageUpdate,
  type PanelWarehouseCapacity,
} from '@dyingstar-admin/contracts/universesimulator';
import { createUpstream, type Query } from './upstream';

export interface UniversesimulatorClientOptions {
  /** `universesimulator`'s base URL, without `/api` (e.g. `http://universesimulator:9600`). */
  baseUrl: string;
  timeoutMs: number;
}

/**
 * HTTP client for `universesimulator` (contract pinned in
 * `@dyingstar-admin/contracts/universesimulator`, ADR 0025). The panel uses its Admin API only
 * (`/api/admin/*`), always with the person's token: `universesimulator` checks the moderation
 * role itself (reads `moderator`+, writes `admin` or `supervisor`). Its read routes (villages,
 * warehouses, resources, entities, prices, orders) are served under `/api/admin` too. Villages
 * are the nodes of the simulation; a warehouse is a depot of a village (its ADR 0013).
 */
export function createUniversesimulatorClient({
  baseUrl,
  timeoutMs,
}: UniversesimulatorClientOptions) {
  const { call, get } = createUpstream({ name: 'Universesimulator', baseUrl, timeoutMs });
  const admin = (path: string) => `/admin${path}`;
  const id = (value: string) => encodeURIComponent(value);
  type Token = string | undefined;

  return {
    /** Tick state, treasury, open orders, active missions, villages below their threshold. */
    dashboard: (token: Token, query: Query) =>
      get(token, admin('/dashboard'), zGetDashboardResponse, query),
    /** Villages (positions, aggregated stocks, warehouses), routes, active legs. */
    network: (token: Token, query: Query) =>
      get(token, admin('/network'), zGetNetworkResponse, query),
    /** Villages with their aggregated stocks and warehouse counts. */
    villages: (token: Token, query: Query) =>
      get(token, admin('/villages'), zListVillagesResponse, query),
    /** A village: aggregated stocks, its warehouses' own stocks, policies, flows, capacities… */
    village: (token: Token, villageId: string) =>
      get(token, admin(`/villages/${id(villageId)}`), zGetVillageResponse),
    /** A warehouse's live stocks and capacities. */
    warehouse: (token: Token, warehouseId: string) =>
      get(token, admin(`/warehouses/${id(warehouseId)}`), zGetWarehouseResponse),
    /** Supply orders with their legs, newest first. */
    orders: (token: Token, query: Query) =>
      get(token, admin('/orders'), zListOrdersResponse, query),
    order: (token: Token, orderId: string) =>
      get(token, admin(`/orders/${id(orderId)}`), zGetOrderResponse),
    /** Federation price indices. */
    prices: (token: Token, query: Query) =>
      get(token, admin('/prices'), zListPricesResponse, query),
    priceHistory: (token: Token, query: Query) =>
      get(token, admin('/price-history'), zGetPriceHistoryResponse, query),
    /** Buy and sell prices per village, largest spread first. */
    localPrices: (token: Token, query: Query) =>
      get(token, admin('/local-prices'), zGetLocalPricesResponse, query),
    /** History of a village (sum of its warehouses) or of one warehouse. */
    stockHistory: (token: Token, query: Query) =>
      get(token, admin('/stock-history'), zGetStockHistoryResponse, query),
    /** Active legs heading to a village. */
    incoming: (token: Token, query: Query) =>
      get(token, admin('/incoming'), zGetIncomingResponse, query),
    mintEvents: (token: Token, query: Query) =>
      get(token, admin('/mint-events'), zListMintEventsResponse, query),
    resources: (token: Token) => get(token, admin('/resources'), zListResourcesResponse),
    /** Political entities mirrored from `social` (a village is a commune). */
    entities: (token: Token, query: Query) =>
      get(token, admin('/entities'), zListEntitiesResponse, query),
    /** Tick state and settings (enabled, tick period, time scale, external mode). */
    simulation: (token: Token) => get(token, admin('/simulation'), zGetSimulationResponse),
    /** Runs a tick now, even when paused; 409 while one is running. */
    tick: (token: Token) => call('POST', token, admin('/simulation/tick'), zForceTickResponse),
    pause: (token: Token) =>
      call('POST', token, admin('/simulation/pause'), zPauseSimulationResponse),
    resume: (token: Token) =>
      call('POST', token, admin('/simulation/resume'), zResumeSimulationResponse),
    /** Cancels the published mission, releases the hold, closes the order; 409 once closed. */
    cancelOrder: (token: Token, orderId: string) =>
      call('POST', token, admin(`/orders/${id(orderId)}/cancel`), zCancelOrderResponse),
    // Configuration (ADR 0025 › Configuration): villages, their policies and flows, warehouses'
    // capacities.
    /** Sets a village's main warehouse (one of its own) or whether it is simulated. */
    updateVillage: (token: Token, villageId: string, body: PanelVillageUpdate) =>
      call('PUT', token, admin(`/villages/${id(villageId)}`), zUpdateVillageResponse, { body }),
    /** Thresholds and target levels per village and resource. */
    villagePolicies: (token: Token, query: Query) =>
      get(token, admin('/village-policies'), zListVillagePoliciesResponse, query),
    saveVillagePolicy: (token: Token, body: PanelVillagePolicy) =>
      call('PUT', token, admin('/village-policies'), zUpsertVillagePolicyResponse, { body }),
    deleteVillagePolicy: (token: Token, villageId: string, resourceId: string) =>
      call(
        'DELETE',
        token,
        admin(`/village-policies/${id(villageId)}/${id(resourceId)}`),
        zDeleteVillagePolicyResponse,
      ),
    /** Capacities (and initial stocks) per warehouse and resource. */
    warehouseCapacities: (token: Token, query: Query) =>
      get(token, admin('/warehouse-capacities'), zListWarehouseCapacitiesResponse, query),
    saveWarehouseCapacity: (token: Token, body: PanelWarehouseCapacity) =>
      call('PUT', token, admin('/warehouse-capacities'), zUpsertWarehouseCapacityResponse, {
        body,
      }),
    deleteWarehouseCapacity: (token: Token, warehouseId: string, resourceId: string) =>
      call(
        'DELETE',
        token,
        admin(`/warehouse-capacities/${id(warehouseId)}/${id(resourceId)}`),
        zDeleteWarehouseCapacityResponse,
      ),
    /** Adds a production (positive rate) or consumption (negative) per game hour to a village. */
    createFlow: (token: Token, body: PanelFlow) =>
      call('POST', token, admin('/flows'), zCreateFlowResponse, { body }),
    updateFlow: (token: Token, flowId: string, body: PanelFlowChange) =>
      call('PUT', token, admin(`/flows/${id(flowId)}`), zUpdateFlowResponse, { body }),
    deleteFlow: (token: Token, flowId: string) =>
      call('DELETE', token, admin(`/flows/${id(flowId)}`), zDeleteFlowResponse),
  };
}

export type UniversesimulatorClient = ReturnType<typeof createUniversesimulatorClient>;
