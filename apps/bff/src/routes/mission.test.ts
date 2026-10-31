import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { INVENTORY_URL, MISSION_URL, missionIds, poiIds } from '@dyingstar-admin/testing';
import { createInventoryClient } from '../clients/inventory';
import { createMissionClient } from '../clients/mission';
import { objectivePoiIds } from './mission';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { buildApp, mswServer } from '../test/harness';

describe('mission routes (ADR 0024 step O, reading)', () => {
  it('lists mission among the services only with svc-admin', async () => {
    expect(await (await buildApp().request('/api/panel')).json()).toMatchObject({
      services: expect.arrayContaining(['mission']),
    });
    // Without svc-admin there is no catalogue: hidden, its routes unknown.
    const { request } = buildApp({
      mission: createMissionClient({ baseUrl: MISSION_URL, timeoutMs: 1000 }),
    });
    const panel = (await (await request('/api/panel')).json()) as { services: string[] };
    expect(panel.services).not.toContain('mission');
    expect((await request('/api/mission/missions')).status).toBe(404);
  });

  it('reads the catalogue as svc-admin', async () => {
    const { request, mission } = buildApp();

    const list = await (await request('/api/mission/missions?status=available&limit=5')).json();
    expect(list).toMatchObject({ total: 3, limit: 5, offset: 0 });
    expect(mission.tokens).toEqual(['Bearer svc-admin-token']);
  });

  it("reads a mission's detail as svc-admin", async () => {
    const { request, mission } = buildApp();

    const res = await request(`/api/mission/missions/${missionIds.delivery}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mission: { id: missionIds.delivery },
      summary: { assignments: 3, progressBp: 6000 },
    });
    expect(mission.tokens).toEqual(['Bearer svc-admin-token']);
  });

  it('answers 404 for an unknown mission, 400 for an id that is not a UUID', async () => {
    const { request, mission } = buildApp();

    expect(
      (await request('/api/mission/missions/3a55105e-0000-4000-8000-0000000000ff')).status,
    ).toBe(404);
    expect((await request('/api/mission/missions/expire')).status).toBe(400);
    expect(mission.tokens).toHaveLength(1);
  });

  it('refuses invalid filters before calling mission', async () => {
    const { request, mission } = buildApp();

    expect((await request('/api/mission/missions?status=lost')).status).toBe(400);
    expect((await request('/api/mission/missions?limit=101')).status).toBe(400);
    expect(mission.tokens).toHaveLength(0);
  });

  it("opens the catalogue and a mission with mission's capability role only", async () => {
    const as = async (realmRoles: string[], clientRoles: string[]) => {
      const ctx = setup(
        fakeProvider(() => tokens({ realmRoles, clientRoles: { 'dyingstar-admin': clientRoles } })),
      );
      const { cookie } = await signIn(ctx);
      return Promise.all(
        ['/api/mission/missions', `/api/mission/missions/${missionIds.scenario}`].map(
          async (path) => (await ctx.call(path, { cookie })).status,
        ),
      );
    };

    expect(await as(['supervisor'], ['economie:wallet:read'])).toEqual([403, 403]);
    expect(await as([], ['mission:read'])).toEqual([200, 200]);
  });

  it("names the objectives' POIs from inventory as svc-admin, a minute (ADR 0026)", async () => {
    const { request, inventory } = buildApp();

    const page = (await (await request(`/api/mission/missions/${missionIds.delivery}`)).json()) as {
      places: Record<string, { name: string } | null>;
    };
    // The foundry is known; the foreman's office no longer is.
    expect(page.places).toEqual({
      [poiIds.foundryBay]: expect.objectContaining({ name: 'Foundry loading bay' }),
      [poiIds.missing]: null,
    });
    // `inventory`'s grants stay out of the page.
    expect(page.places[poiIds.foundryBay]).not.toHaveProperty('shares');
    expect(inventory.tokens).toEqual(['Bearer svc-admin-token', 'Bearer svc-admin-token']);

    await request(`/api/mission/missions/${missionIds.delivery}`);
    expect(inventory.tokens).toHaveLength(2);
  });

  it('takes only RFC 9562 uuids as POI ids, as mission does', () => {
    const poi = (poiId: string) => ({ kind: 'poi', poiId });
    // A v4 POI made by inventory, then an id with no RFC version or variant digits.
    const valid = '149cb396-6b0e-4c1a-9f2d-3a8e5b7c1d20';
    const objective = {
      params: { source: poi(valid), zone: poi('8276a47f-c581-27a0-e40a-58bdb7e7b27b') },
    };
    expect(
      objectivePoiIds({ objectives: [objective] } as unknown as Parameters<
        typeof objectivePoiIds
      >[0]),
    ).toEqual([valid]);
  });

  it('serves the page without places when inventory is silent or not configured', async () => {
    const { request } = buildApp();
    mswServer.use(http.get(`${INVENTORY_URL}/api/internal/pois/:id`, () => HttpResponse.error()));
    const res = await request(`/api/mission/missions/${missionIds.transport}`);
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty('places');

    const without = buildApp({
      inventory: createInventoryClient({ baseUrl: INVENTORY_URL, timeoutMs: 1000 }),
    });
    const panel = (await (await without.request('/api/panel')).json()) as { services: string[] };
    expect(panel.services).not.toContain('inventory');
    const page = await (
      await without.request(`/api/mission/missions/${missionIds.transport}`)
    ).json();
    expect(page).not.toHaveProperty('places');
    expect(without.inventory.tokens).toHaveLength(0);
  });

  it("names the POIs for inventory's capability role only", async () => {
    const as = async (clientRoles: string[]) => {
      const ctx = setup(
        fakeProvider(() =>
          tokens({ realmRoles: [], clientRoles: { 'dyingstar-admin': clientRoles } }),
        ),
      );
      const { cookie } = await signIn(ctx);
      const res = await ctx.call(`/api/mission/missions/${missionIds.scenario}`, { cookie });
      return Object.keys((await res.json()) as object).includes('places');
    };

    expect(await as(['mission:read'])).toBe(false);
    expect(await as(['mission:read', 'inventory:read'])).toBe(true);
  });

  describe('cancelling a mission (ADR 0028)', () => {
    const cancel = (request: ReturnType<typeof buildApp>['request'], id: string) =>
      request(`/api/mission/missions/${id}/cancel`, { method: 'POST' });

    it('cancels as svc-admin: active assignments abandoned, escrow refunded', async () => {
      const { request, mission } = buildApp();

      const res = await cancel(request, missionIds.transport);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        id: missionIds.transport,
        status: 'cancelled',
        escrowStatus: 'refunded',
        escrowItemStatus: 'released',
      });
      expect(mission.writes).toEqual([`cancel ${missionIds.transport}`]);
      // The detail read first, to tell a simulation mission apart, then the cancel.
      expect(mission.tokens).toEqual(['Bearer svc-admin-token', 'Bearer svc-admin-token']);
      expect(
        mission.data.assignments.filter((a) => a.missionId === missionIds.transport),
      ).not.toContainEqual(expect.objectContaining({ status: 'active' }));
    });

    it("passes on mission's refusal of a completed mission", async () => {
      const { request } = buildApp();

      const res = await cancel(request, missionIds.scenario);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        message: 'A completed mission cannot be cancelled',
      });
    });

    it("refuses a simulation mission without calling mission's cancel", async () => {
      const { request, mission } = buildApp();

      const res = await cancel(request, missionIds.simulation);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: 'SIMULATION_MISSION' });
      expect(mission.writes).toEqual([]);
      expect(mission.data.missions.find((m) => m.id === missionIds.simulation)?.status).toBe(
        'available',
      );
    });

    it('answers 404 for an unknown mission, 400 for an id that is not a UUID', async () => {
      const { request, mission } = buildApp();

      expect((await cancel(request, '3a55105e-0000-4000-8000-0000000000ff')).status).toBe(404);
      expect((await cancel(request, 'expire')).status).toBe(400);
      expect(mission.writes).toEqual([]);
    });

    it("opens it with mission's write role only, and records every attempt", async () => {
      const as = async (realmRoles: string[], clientRoles: string[]) => {
        const ctx = setup(
          fakeProvider(() =>
            tokens({ realmRoles, clientRoles: { 'dyingstar-admin': clientRoles } }),
          ),
        );
        const { cookie } = await signIn(ctx);
        const res = await ctx.call(`/api/mission/missions/${missionIds.delivery}/cancel`, {
          method: 'POST',
          cookie,
          headers: { Origin: ORIGIN },
        });
        return { status: res.status, writes: ctx.mission.writes.length, audited: ctx.audited };
      };

      expect((await as(['supervisor'], ['mission:read'])).status).toBe(403);
      const allowed = await as([], ['mission:write']);
      expect(allowed).toMatchObject({ status: 200, writes: 1 });
      expect(allowed.audited).toEqual([
        expect.objectContaining({
          service: 'mission',
          method: 'POST',
          path: `/api/mission/missions/${missionIds.delivery}/cancel`,
          status: 200,
        }),
      ]);
    });
  });
});
