import { describe, expect, it } from 'vitest';
import { ids, simulationIds as sim } from '@dyingstar-admin/testing';
import { BodyMapResponseSchema, SimulationNetworkExtrasSchema } from '@dyingstar-admin/schemas';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { buildApp } from '../test/harness';

const json = (method: string, body?: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe('universesimulator routes (ADR 0025)', () => {
  it('lists universesimulator among the services when configured', async () => {
    const res = await buildApp().request('/api/panel');
    expect(((await res.json()) as { services: string[] }).services).toContain('universesimulator');

    const without = buildApp({ universesimulator: undefined });
    const panel = await without.request('/api/panel');
    expect(((await panel.json()) as { services: string[] }).services).not.toContain(
      'universesimulator',
    );
    // Unset, its routes do not exist.
    expect((await without.request('/api/simulation/dashboard')).status).toBe(404);
  });

  it('reads the Admin views, villages being the nodes', async () => {
    const { request, universesimulator } = buildApp();
    const get = async (path: string) => {
      const res = await request(`/api/simulation${path}`);
      expect(res.status, path).toBe(200);
      return (await res.json()) as { items: unknown[]; points: unknown[] };
    };

    expect(await get('/dashboard')).toMatchObject({ openOrders: 2, activeMissions: 2 });
    expect((await get('/villages')).items).toHaveLength(4);
    expect(await get(`/villages/${sim.m0002}`)).toMatchObject({
      village: { code: 'M0002' },
      warehouses: [{ main: true }],
    });
    expect(await get(`/warehouses/${sim.c0001Annex}`)).toMatchObject({
      village: { code: 'C0001' },
    });
    expect(await get(`/orders?status=in_progress&village=${sim.f0001}`)).toMatchObject({
      total: 1,
      items: [{ id: sim.waterOrder }],
    });
    expect(await get(`/orders/${sim.waterOrder}`)).toMatchObject({ legs: [{}, {}] });
    expect((await get('/prices')).items).toHaveLength(5);
    expect((await get(`/price-history?resource=${sim.water}`)).points.length).toBeGreaterThan(0);
    expect((await get(`/local-prices?resource=${sim.food}`)).items).toHaveLength(3);
    expect(await get(`/stock-history?village=${sim.m0002}&resource=${sim.water}`)).toMatchObject({
      minThreshold: 300,
      targetLevel: 1_000,
    });
    expect(
      (await get(`/stock-history?warehouse=${sim.c0001Annex}&resource=${sim.water}`)).points.length,
    ).toBeGreaterThan(0);
    expect((await get(`/incoming?village=${sim.m0002}`)).items).toHaveLength(2);
    expect((await get('/mint-events?limit=1')).items).toHaveLength(1);
    expect((await get('/resources')).items).toHaveLength(5);
    expect((await get('/entities')).items).toHaveLength(5);
    expect(await get('/simulation')).toMatchObject({ enabled: true, tickSeconds: 60 });
    expect((await get(`/village-policies?village=${sim.m0002}`)).items).toHaveLength(5);
    expect((await get(`/warehouse-capacities?warehouse=${sim.c0001Annex}`)).items).toHaveLength(1);
    expect(universesimulator.tokens).toHaveLength(18);
  });

  it('refuses invalid input before calling universesimulator', async () => {
    const { request, universesimulator } = buildApp();
    const status = async (path: string, init: RequestInit = {}) =>
      (await request(`/api/simulation${path}`, init)).status;

    expect(await status('/villages/not-a-uuid')).toBe(400);
    expect(await status('/warehouses/not-a-uuid')).toBe(400);
    expect(await status('/orders?status=lost')).toBe(400);
    expect(await status('/orders?limit=500')).toBe(400);
    expect(await status(`/stock-history?resource=${sim.water}`)).toBe(400);
    expect(await status(`/stock-history?village=${sim.m0002}`)).toBe(400);
    expect(await status('/price-history')).toBe(400);
    expect(await status(`/price-history?resource=${sim.water}&from=yesterday`)).toBe(400);
    expect(await status('/incoming')).toBe(400);
    expect(await status('/mint-events?limit=0')).toBe(400);
    expect(await status('/network?body=not-a-uuid')).toBe(400);
    expect(await status('/orders/not-a-uuid/cancel', { method: 'POST' })).toBe(400);
    expect(universesimulator.tokens).toHaveLength(0);
  });

  it('places the villages and their warehouses on the body map frame, or says why not', async () => {
    const { request } = buildApp();
    const network = async (query: string) =>
      SimulationNetworkExtrasSchema.parse(
        await (await request(`/api/simulation/network${query}`)).json(),
      );

    expect(await network('')).toEqual({
      projection: null,
      projectionIssue: 'noBody',
      positions: [],
    });
    expect((await network(`?body=${sim.water}`)).projectionIssue).toBe('bodyNotFound');

    const placed = await network(`?body=${ids.planet}`);
    expect(placed.projectionIssue).toBeNull();
    expect(placed.projection?.body).toEqual({ object_uuid: ids.planet, name: 'SandBox' });
    expect(placed.positions.filter((p) => p.kind === 'village').map((p) => p.id)).toEqual([
      sim.c0001,
      sim.f0001,
      sim.m0002,
      sim.f0003,
    ]);
    expect(placed.positions.filter((p) => p.kind === 'warehouse')).toHaveLength(6);
    // Same frame as the body's map: C0001 stands 1.5 km west, 0.8 km north of the building.
    const map = BodyMapResponseSchema.parse(
      await (await request(`/api/bodies/${ids.planet}/map`)).json(),
    );
    const building = map.points.find((p) => p.object_uuid === ids.spawnbuilding);
    const c0001 = placed.positions[0];
    if (!building || !c0001) throw new Error('fixtures missing');
    expect(c0001.x - building.x).toBeCloseTo(-1_500, -2);
    expect(c0001.y - building.y).toBeCloseTo(800, -2);
  });

  it('leaves the villages unprojected without persistence', async () => {
    const { request } = buildApp({ persistenceUrl: undefined });
    const body = (await (await request(`/api/simulation/network?body=${ids.planet}`)).json()) as {
      villages: unknown[];
    };

    expect(body).toMatchObject({ projectionIssue: 'noPersistence', positions: [] });
    expect(body.villages).toHaveLength(4);
  });

  it('pauses, resumes, ticks and cancels an order, recording each write', async () => {
    const { request, universesimulator, audited } = buildApp();
    const post = (path: string) => request(`/api/simulation${path}`, { method: 'POST' });

    expect(await (await post('/simulation/pause')).json()).toMatchObject({ paused: true });
    expect(await (await post('/simulation/resume')).json()).toMatchObject({ paused: false });
    expect(await (await post('/simulation/tick')).json()).toMatchObject({ federations: 1 });
    expect((await post(`/orders/${sim.copperOrder}/cancel`)).status).toBe(204);
    const again = await post(`/orders/${sim.copperOrder}/cancel`);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ message: 'order is cancelled' });
    expect(universesimulator.writes.map((w) => w.call)).toEqual([
      'POST /simulation/pause',
      'POST /simulation/resume',
      'POST /simulation/tick',
      `POST /orders/${sim.copperOrder}/cancel`,
      `POST /orders/${sim.copperOrder}/cancel`,
    ]);
    expect(audited.map((a) => [a.service, a.path, a.status])).toEqual([
      ['universesimulator', '/api/simulation/simulation/pause', 200],
      ['universesimulator', '/api/simulation/simulation/resume', 200],
      ['universesimulator', '/api/simulation/simulation/tick', 200],
      ['universesimulator', `/api/simulation/orders/${sim.copperOrder}/cancel`, 204],
      ['universesimulator', `/api/simulation/orders/${sim.copperOrder}/cancel`, 409],
    ]);
  });

  it('sends the person token, opens reads to moderators and writes to admin and supervisor', async () => {
    const as = async (realmRoles: string[]) => {
      const ctx = setup(fakeProvider(() => tokens({ realmRoles, clientRoles: {} })));
      const { cookie } = await signIn(ctx);
      const send = async (method: string, path: string) =>
        (
          await ctx.call(`/api/simulation${path}`, {
            method,
            cookie,
            headers: { Origin: ORIGIN },
          })
        ).status;
      return {
        statuses: {
          dashboard: await send('GET', '/dashboard'),
          pause: await send('POST', '/simulation/pause'),
          cancel: await send('POST', `/orders/${sim.waterOrder}/cancel`),
        },
        tokens: ctx.universesimulator.tokens,
        writes: ctx.universesimulator.writes.length,
      };
    };

    const moderator = await as(['moderator']);
    expect(moderator.statuses).toEqual({ dashboard: 200, pause: 403, cancel: 403 });
    // The person's own token, never svc-admin; refused writes never reach the service.
    expect(moderator.tokens).toEqual(['Bearer access']);
    expect(moderator.writes).toBe(0);
    expect((await as(['admin'])).statuses).toEqual({ dashboard: 200, pause: 200, cancel: 204 });
    expect((await as(['supervisor'])).statuses).toMatchObject({ pause: 200 });
    // Without a moderation role the section stays closed (here, a persistence account).
    const ctx = setup(
      fakeProvider(() => tokens({ clientRoles: { 'dyingstar-admin': ['persistence:write'] } })),
    );
    const { cookie } = await signIn(ctx);
    expect((await ctx.call('/api/simulation/dashboard', { cookie })).status).toBe(403);
    expect(ctx.universesimulator.tokens).toHaveLength(0);
  });
});

describe('universesimulator configuration: villages, policies, capacities, flows (ADR 0025)', () => {
  const policy = {
    villageId: sim.m0002,
    resourceId: sim.water,
    minThreshold: 400,
    targetLevel: 1_200,
  };

  it('upserts and deletes village policies and warehouse capacities, recording each write', async () => {
    const { request, universesimulator, audited } = buildApp();

    const saved = await request('/api/simulation/village-policies', json('PUT', policy));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual(policy);
    const capacity = { warehouseId: sim.c0001Annex, resourceId: sim.water, capacity: null };
    const capped = await request('/api/simulation/warehouse-capacities', json('PUT', capacity));
    expect(await capped.json()).toMatchObject({ capacity: null, initialStock: 5_000 });
    const paths = [
      `/api/simulation/village-policies/${sim.m0002}/${sim.water}`,
      `/api/simulation/warehouse-capacities/${sim.c0001Annex}/${sim.water}`,
    ];
    for (const path of paths) {
      expect((await request(path, { method: 'DELETE' })).status).toBe(204);
    }
    expect(universesimulator.writes).toEqual([
      { call: 'PUT /village-policies', body: policy },
      { call: 'PUT /warehouse-capacities', body: capacity },
      { call: `DELETE /village-policies/${sim.m0002}/${sim.water}` },
      { call: `DELETE /warehouse-capacities/${sim.c0001Annex}/${sim.water}` },
    ]);
    expect(audited.map((a) => [a.method, a.status])).toEqual([
      ['PUT', 200],
      ['PUT', 200],
      ['DELETE', 204],
      ['DELETE', 204],
    ]);
  });

  it("sets a village's main warehouse, refused by the service for another village's", async () => {
    const { request } = buildApp();

    const changed = await request(
      `/api/simulation/villages/${sim.c0001}`,
      json('PUT', { mainWarehouseId: sim.c0001Annex }),
    );
    expect(await changed.json()).toMatchObject({ mainWarehouseId: sim.c0001Annex });
    const refused = await request(
      `/api/simulation/villages/${sim.c0001}`,
      json('PUT', { mainWarehouseId: sim.m0002Main }),
    );
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({
      error: 'UPSTREAM_REJECTED',
      message: 'mainWarehouseId is not a warehouse of this village',
    });
  });

  it('creates, changes (clearing the label) and deletes flows', async () => {
    const { request, universesimulator } = buildApp();

    const created = await request(
      '/api/simulation/flows',
      json('POST', {
        villageId: sim.f0001,
        resourceId: sim.food,
        ratePerHour: -12.5,
        source: 'population',
        label: ' Dockers ',
      }),
    );
    expect(created.status).toBe(201);
    const flow = (await created.json()) as { id: string; label: string };
    // Labels are trimmed by the panel.
    expect(flow.label).toBe('Dockers');
    const changed = await request(
      `/api/simulation/flows/${flow.id}`,
      json('PUT', { ratePerHour: -20, label: null }),
    );
    expect(await changed.json()).toMatchObject({ ratePerHour: -20, label: null });
    expect((await request(`/api/simulation/flows/${flow.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect(universesimulator.writes.map((w) => w.call)).toEqual([
      'POST /flows',
      `PUT /flows/${flow.id}`,
      `DELETE /flows/${flow.id}`,
    ]);
  });

  it('refuses incoherent or malformed input before calling universesimulator', async () => {
    const { request, universesimulator } = buildApp();
    const status = async (path: string, init: RequestInit) =>
      (await request(`/api/simulation${path}`, init)).status;
    const flowId = 'a7e50000-0000-4000-8000-000000000201';

    // Target below the threshold, negative, decimal, a field the service no longer takes.
    expect(await status('/village-policies', json('PUT', { ...policy, targetLevel: 100 }))).toBe(
      400,
    );
    expect(await status('/village-policies', json('PUT', { ...policy, minThreshold: -1 }))).toBe(
      400,
    );
    expect(await status('/village-policies', json('PUT', { ...policy, targetLevel: 1.5 }))).toBe(
      400,
    );
    expect(await status('/village-policies', json('PUT', { ...policy, capacity: 10 }))).toBe(400);
    expect(await status('/village-policies', json('PUT', { ...policy, villageId: 'x' }))).toBe(400);
    expect(await status('/village-policies/nope/nope', { method: 'DELETE' })).toBe(400);
    const capacity = { warehouseId: sim.c0001Main, resourceId: sim.water };
    expect(await status('/warehouse-capacities', json('PUT', capacity))).toBe(400);
    expect(await status('/warehouse-capacities', json('PUT', { ...capacity, capacity: -5 }))).toBe(
      400,
    );
    expect(await status(`/villages/${sim.c0001}`, json('PUT', {}))).toBe(400);
    expect(await status(`/villages/${sim.c0001}`, json('PUT', { mainWarehouseId: 'nope' }))).toBe(
      400,
    );
    expect(
      await status('/flows', json('POST', { villageId: sim.f0001, resourceId: sim.food })),
    ).toBe(400);
    expect(
      await status(
        '/flows',
        json('POST', { warehouseId: sim.f0001Main, resourceId: sim.food, ratePerHour: 1 }),
      ),
    ).toBe(400);
    expect(await status(`/flows/${flowId}`, json('PUT', {}))).toBe(400);
    expect(await status(`/flows/${flowId}`, json('PUT', { label: '  ' }))).toBe(400);
    expect(await status(`/flows/${flowId}`, json('PUT', { source: 'manual' }))).toBe(400);
    expect(universesimulator.tokens).toHaveLength(0);
  });

  it('opens configuration writes to admin and supervisor only, with their own token', async () => {
    const as = async (realmRoles: string[]) => {
      const ctx = setup(fakeProvider(() => tokens({ realmRoles, clientRoles: {} })));
      const { cookie } = await signIn(ctx);
      const send = async (method: string, path: string, body?: unknown) =>
        (
          await ctx.call(`/api/simulation${path}`, {
            method,
            cookie,
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        ).status;
      return {
        statuses: {
          read: await send('GET', '/village-policies'),
          policy: await send('PUT', '/village-policies', policy),
          capacity: await send('PUT', '/warehouse-capacities', {
            warehouseId: sim.m0002Main,
            resourceId: sim.water,
            capacity: 2_500,
          }),
          village: await send('PUT', `/villages/${sim.m0002}`, { mainWarehouseId: sim.m0002Main }),
          flow: await send('PUT', '/flows/a7e50000-0000-4000-8000-000000000201', {
            ratePerHour: 300,
          }),
          deleteFlow: await send('DELETE', '/flows/a7e50000-0000-4000-8000-000000000202'),
        },
        tokens: ctx.universesimulator.tokens,
        writes: ctx.universesimulator.writes.length,
        audited: ctx.audited.map((a) => [a.user, a.method, a.status]),
      };
    };

    const moderator = await as(['moderator']);
    expect(moderator.statuses).toEqual({
      read: 200,
      policy: 403,
      capacity: 403,
      village: 403,
      flow: 403,
      deleteFlow: 403,
    });
    expect(moderator.writes).toBe(0);
    expect(moderator.audited).toHaveLength(5);
    const admin = await as(['admin']);
    expect(admin.statuses).toEqual({
      read: 200,
      policy: 200,
      capacity: 200,
      village: 200,
      flow: 200,
      deleteFlow: 204,
    });
    expect(admin.tokens.every((t) => t === 'Bearer access')).toBe(true);
    expect((await as(['supervisor'])).statuses).toMatchObject({ policy: 200, capacity: 200 });
  });
});
