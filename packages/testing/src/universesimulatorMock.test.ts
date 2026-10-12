import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { z } from 'zod';
import {
  zCreateFlowResponse,
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
  zListFlowsResponse,
  zListMintEventsResponse,
  zListOrdersResponse,
  zListPricesResponse,
  zListResourcesResponse,
  zListVillagePoliciesResponse,
  zListVillagesResponse,
  zListWarehouseCapacitiesResponse,
  zPauseSimulationResponse,
  zUpdateVillageResponse,
  zUpsertVillagePolicyResponse,
  zUpsertWarehouseCapacityResponse,
} from '@dyingstar-admin/contracts/universesimulator';
import {
  createUniversesimulatorMock,
  simulationIds as ids,
  UNIVERSESIMULATOR_URL,
} from './universesimulatorMock';

const mock = createUniversesimulatorMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const admin = (path: string) => `${UNIVERSESIMULATOR_URL}/api/admin${path}`;
const read = async (path: string) => (await fetch(admin(path))).json();
const post = (path: string) => fetch(admin(path), { method: 'POST' });
const send = (method: string, path: string, body?: unknown) =>
  fetch(admin(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('universesimulator mock (ADR 0013, 0025)', () => {
  it('answers as the contract says', async () => {
    const checks: [string, z.ZodType][] = [
      ['/dashboard', zGetDashboardResponse],
      ['/network', zGetNetworkResponse],
      ['/villages', zListVillagesResponse],
      [`/villages/${ids.c0001}`, zGetVillageResponse],
      [`/warehouses/${ids.c0001Annex}`, zGetWarehouseResponse],
      ['/orders', zListOrdersResponse],
      [`/orders/${ids.waterOrder}`, zGetOrderResponse],
      ['/prices', zListPricesResponse],
      [`/price-history?resource=${ids.water}`, zGetPriceHistoryResponse],
      [`/local-prices?resource=${ids.water}`, zGetLocalPricesResponse],
      [`/stock-history?village=${ids.m0002}&resource=${ids.water}`, zGetStockHistoryResponse],
      [`/stock-history?warehouse=${ids.c0001Main}&resource=${ids.water}`, zGetStockHistoryResponse],
      [`/incoming?village=${ids.m0002}`, zGetIncomingResponse],
      ['/mint-events', zListMintEventsResponse],
      ['/resources', zListResourcesResponse],
      ['/entities', zListEntitiesResponse],
      ['/simulation', zGetSimulationResponse],
      [`/village-policies?village=${ids.m0002}`, zListVillagePoliciesResponse],
      [`/warehouse-capacities?village=${ids.c0001}`, zListWarehouseCapacitiesResponse],
      [`/flows?village=${ids.c0001}`, zListFlowsResponse],
    ];
    for (const [path, schema] of checks) {
      expect(schema.safeParse(await read(path)).error, path).toBeUndefined();
    }
  });

  it('sums the warehouses of a village, and alerts on the village stock', async () => {
    const village = zGetVillageResponse.parse(await read(`/villages/${ids.c0001}`));
    expect(village.stocks.find((s) => s.resourceId === ids.water)).toMatchObject({
      quantity: 17_400,
      held: 600,
      available: 16_800,
      minThreshold: 2_000,
      netFlowPerHour: 70,
    });
    expect(village.warehouses.map((w) => [w.warehouse.name, w.main])).toEqual([
      ['C0001 — Cargo depot', true],
      ['C0001 — Annex', false],
    ]);
    expect(village.warehouses[1]?.stocks.find((s) => s.resourceId === ids.water)).toMatchObject({
      quantity: 5_400,
      capacity: 20_000,
    });

    const dashboard = zGetDashboardResponse.parse(await read('/dashboard'));
    expect(dashboard.alerts.map((a) => [a.villageId, a.resourceId])).toEqual([
      [ids.c0001, ids.oreCuivre],
      [ids.m0002, ids.water],
      [ids.m0002, ids.oreFer],
      [ids.m0002, ids.oreTitane],
    ]);
    // 120 l left, 30 l used per hour: 4 hours.
    expect(dashboard.alerts[1]).toMatchObject({ available: 120, autonomyHours: 4 });
    expect(dashboard).toMatchObject({ openOrders: 2, activeMissions: 2 });
    expect(dashboard.treasury).toMatchObject({ escrowed: 3_340, minted24h: 1_000_000 });
  });

  it('draws villages with their warehouses, routes and legs between villages', async () => {
    const network = zGetNetworkResponse.parse(await read('/network'));
    expect(network.villages.map((v) => [v.code, v.warehouses.length])).toEqual([
      ['C0001', 2],
      ['F0001', 2],
      ['M0002', 1],
      ['F0003', 1],
    ]);
    expect(network.activeLegs.map((l) => [l.status, l.fromVillageId, l.toVillageId])).toEqual([
      ['published', ids.f0001, ids.m0002],
      ['published', null, ids.m0002],
      ['pending', ids.m0002, ids.f0001],
      ['waiting', ids.f0001, ids.c0001],
    ]);
  });

  it('filters orders through a village of the path, newest first', async () => {
    const page = zListOrdersResponse.parse(await read(`/orders?village=${ids.f0001}`));
    expect(page.items.map((o) => o.id)).toEqual([ids.copperOrder, ids.waterOrder]);
  });

  it('refuses a missing target and unknown ids', async () => {
    expect((await fetch(admin(`/stock-history?resource=${ids.water}`))).status).toBe(400);
    expect((await fetch(admin(`/villages/${ids.water}`))).status).toBe(404);
  });

  it('pauses, ticks, and cancels an open order once', async () => {
    const paused = zPauseSimulationResponse.parse(await (await post('/simulation/pause')).json());
    expect(paused.paused).toBe(true);
    const report = zForceTickResponse.parse(await (await post('/simulation/tick')).json());
    expect(report.federations).toBe(1);
    expect((await post(`/orders/${ids.copperOrder}/cancel`)).status).toBe(204);
    expect((await post(`/orders/${ids.copperOrder}/cancel`)).status).toBe(409);
  });

  it('upserts and deletes village policies, refusing a target below the threshold', async () => {
    const policy = {
      villageId: ids.f0001,
      resourceId: ids.oreFer,
      minThreshold: 100,
      targetLevel: 400,
    };
    const saved = await send('PUT', '/village-policies', policy);
    expect(zUpsertVillagePolicyResponse.parse(await saved.json())).toEqual(policy);
    expect((await send('PUT', '/village-policies', { ...policy, targetLevel: 50 })).status).toBe(
      400,
    );
    expect((await send('DELETE', `/village-policies/${ids.f0001}/${ids.oreFer}`)).status).toBe(204);
    expect((await send('DELETE', `/village-policies/${ids.f0001}/${ids.oreFer}`)).status).toBe(404);
  });

  it('sets capacities per warehouse, null for none', async () => {
    const saved = await send('PUT', '/warehouse-capacities', {
      warehouseId: ids.f0001Annex,
      resourceId: ids.water,
      capacity: null,
    });
    expect(zUpsertWarehouseCapacityResponse.parse(await saved.json())).toMatchObject({
      capacity: null,
      initialStock: 0,
    });
    expect(
      (
        await send('PUT', '/warehouse-capacities', {
          warehouseId: ids.f0001Annex,
          resourceId: ids.water,
          capacity: -1,
        })
      ).status,
    ).toBe(400);
    expect(
      (await send('DELETE', `/warehouse-capacities/${ids.f0001Annex}/${ids.water}`)).status,
    ).toBe(204);
  });

  it("changes a village's main warehouse to one of its own only", async () => {
    const changed = await send('PUT', `/villages/${ids.f0001}`, {
      mainWarehouseId: ids.f0001Annex,
    });
    expect(zUpdateVillageResponse.parse(await changed.json()).mainWarehouseId).toBe(ids.f0001Annex);
    expect(
      (await send('PUT', `/villages/${ids.f0001}`, { mainWarehouseId: ids.c0001Main })).status,
    ).toBe(400);
  });

  it('creates, changes, clears the label of and deletes flows', async () => {
    const created = await send('POST', '/flows', {
      villageId: ids.f0001,
      resourceId: ids.food,
      ratePerHour: -12,
      source: 'population',
      label: 'Dockers',
    });
    expect(created.status).toBe(201);
    const flow = zCreateFlowResponse.parse(await created.json());
    const changed = await send('PUT', `/flows/${flow.id}`, { ratePerHour: -20, label: null });
    expect(await changed.json()).toMatchObject({ ratePerHour: -20, label: null });
    expect((await send('PUT', `/flows/${flow.id}`, { source: 'manual' })).status).toBe(400);
    const village = zGetVillageResponse.parse(await read(`/villages/${ids.f0001}`));
    expect(village.stocks.find((s) => s.resourceId === ids.food)?.netFlowPerHour).toBe(-20);
    expect((await send('DELETE', `/flows/${flow.id}`)).status).toBe(204);
    expect((await send('DELETE', `/flows/${flow.id}`)).status).toBe(404);
  });
});
