import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { INVENTORY_URL, MISSION_URL, missionIds, poiIds } from '@dyingstar-admin/testing';
import { createInventoryClient } from '../clients/inventory';
import { createMissionClient } from '../clients/mission';
import { fakeProvider, setup, signIn, tokens } from '../test/auth';
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
    expect(list).toMatchObject({ total: 2, limit: 5, offset: 0 });
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
});
