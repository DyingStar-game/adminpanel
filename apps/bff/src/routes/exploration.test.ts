import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  createDataset,
  createDiscoveries,
  ids,
  INVENTORY_URL,
  poiIds,
  SOCIAL_URL,
  socialIds,
} from '@dyingstar-admin/testing';
import {
  ApproveDiscoveryResponseSchema,
  DiscoveriesResponseSchema,
  RefuseDiscoveryResponseSchema,
  type Item,
} from '@dyingstar-admin/schemas';
import { createInventoryClient } from '../clients/inventory';
import { createSocialClient } from '../clients/social';
import { fakeProvider, ORIGIN, setup, signIn, tokens } from '../test/auth';
import { buildApp, mswServer } from '../test/harness';

const dataset = () => [...createDataset(), ...createDiscoveries()];
const discoveryOf = (uuid: string) =>
  createDiscoveries().find((item) => item.object_uuid === uuid) as Item;
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const approve = (uuid: string) => `/api/exploration/discoveries/${uuid}/approve`;
const refuse = (uuid: string) => `/api/exploration/discoveries/${uuid}/refuse`;

describe('exploration routes (ADR 0032)', () => {
  describe('the list', () => {
    it('lists the pending names, oldest proposal first, and every kind met', async () => {
      const { request } = buildApp({ dataset: dataset() });

      const res = await request('/api/exploration/discoveries');
      expect(res.status).toBe(200);
      const body = DiscoveriesResponseSchema.parse(await res.json());
      expect(body.discoveries.map((d) => d.uuid)).toEqual([ids.discoveryEcho, ids.discoveryFang]);
      expect(body).toMatchObject({ total: 2, page: 1, page_size: 20, kinds: ['cave'] });
      expect(body.discoveries[0]?.object_data).toMatchObject({
        place_kind: 'cave',
        proposed_name: "L'Antre des Échos",
        discoverer_id: socialIds.griefer,
        poi_id: poiIds.caveEcho,
      });
    });

    it('filters by status and kind, and pages', async () => {
      const { request } = buildApp({ dataset: dataset() });
      const list = async (query: string) =>
        DiscoveriesResponseSchema.parse(
          await (await request(`/api/exploration/discoveries?${query}`)).json(),
        );

      expect((await list('status=approved')).discoveries.map((d) => d.uuid)).toEqual([
        ids.discoveryHollow,
      ]);
      expect((await list('status=refused')).discoveries[0]?.object_data.refusal_reason).toBe(
        'Names may not advertise a player.',
      );
      expect(await list('kind=lake')).toMatchObject({ total: 0, kinds: ['cave'] });
      const second = await list('page=2&page_size=1');
      expect(second).toMatchObject({ total: 2, page: 2, page_size: 1 });
      expect(second.discoveries.map((d) => d.uuid)).toEqual([ids.discoveryFang]);
    });

    it('refuses an unknown status or a page too large', async () => {
      const { request } = buildApp({ dataset: dataset() });

      expect((await request('/api/exploration/discoveries?status=lost')).status).toBe(400);
      expect((await request('/api/exploration/discoveries?page_size=101')).status).toBe(400);
    });

    it('answers an empty list without any discovery', async () => {
      const { request } = buildApp();

      expect(await (await request('/api/exploration/discoveries')).json()).toEqual({
        discoveries: [],
        total: 0,
        page: 1,
        page_size: 20,
        kinds: [],
      });
    });
  });

  describe('approving', () => {
    it('saves the name, renames the POI, tells the discoverer live and in their history', async () => {
      const { request, persistence, social, inventory } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryEcho);

      const res = await request(approve(ids.discoveryEcho), post({ base }));
      expect(res.status).toBe(200);
      const body = ApproveDiscoveryResponseSchema.parse(await res.json());
      expect(body).toMatchObject({ poiRenamed: true, notified: true, recorded: true });
      const stored = persistence.items.get(ids.discoveryEcho)?.object_data;
      expect(stored).toMatchObject({
        status: 'approved',
        approved_name: "L'Antre des Échos",
        proposed_name: "L'Antre des Échos",
      });
      expect(stored?.decided_at).toBeGreaterThan(1_790_000_000);
      expect(inventory.writes).toEqual([
        {
          call: `PATCH /internal/pois/${poiIds.caveEcho}`,
          body: {
            name: "L'Antre des Échos",
            metadata: {
              kind: 'cave',
              discovery_uuid: ids.discoveryEcho,
              place_uuid: ids.caveEcho,
              place_id: 'tarsis_3_cave_017',
              uncharted: false,
            },
          },
        },
      ]);
      const event = { kind: 'cave', name: "L'Antre des Échos", discoveryId: ids.discoveryEcho };
      expect(social.writes).toEqual([
        {
          call: `POST /internal/players/${socialIds.griefer}/notifications`,
          body: { type: 'place_name_approved', data: event },
        },
        {
          call: `POST /internal/players/${socialIds.griefer}/activity`,
          body: { type: 'place_name_approved', details: event },
        },
      ]);
      expect(social.tokens.at(-1)).toBe('Bearer svc-admin-token');
    });

    it('takes a corrected name, cleaned, and reports an offline player without a POI', async () => {
      const { request, persistence, inventory } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryFang);

      const res = await request(
        approve(ids.discoveryFang),
        post({ base, name: '  Fang   Hollow-Deep ' }),
      );
      expect(await res.json()).toMatchObject({
        poiRenamed: false,
        notified: false,
        recorded: true,
      });
      expect(persistence.items.get(ids.discoveryFang)?.object_data.approved_name).toBe(
        'Fang Hollow-Deep',
      );
      expect(inventory.writes).toEqual([]);
    });

    it('refuses a name breaking the rule before writing anything', async () => {
      const { request, persistence } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryFang);

      const res = await request(approve(ids.discoveryFang), post({ base, name: 'Hi!' }));
      expect(res.status).toBe(400);
      expect(persistence.calls.get('PUT /items/:uuid')).toBeUndefined();
    });

    it('refuses a discovery already decided, and an item that is not a discovery', async () => {
      const { request } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryHollow);

      const decided = await request(approve(ids.discoveryHollow), post({ base }));
      expect(decided.status).toBe(409);
      expect(await decided.json()).toMatchObject({ error: 'DISCOVERY_NOT_PENDING' });
      expect((await request(approve(ids.vehicle), post({ base }))).status).toBe(404);
      expect((await request(approve('not-a-uuid'), post({ base }))).status).toBe(400);
    });

    it('answers EDIT_CONFLICT when the proposal changed since it was read', async () => {
      const { request, persistence, social } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryEcho);
      const stored = persistence.items.get(ids.discoveryEcho);
      if (stored) stored.object_data.proposed_name = 'Another Name';

      const res = await request(approve(ids.discoveryEcho), post({ base }));
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: 'EDIT_CONFLICT' });
      expect(persistence.items.get(ids.discoveryEcho)?.object_data.status).toBe('pending');
      expect(social.writes).toEqual([]);
    });

    it('keeps the decision when social and inventory fail or are not configured', async () => {
      const { request, persistence } = buildApp({
        dataset: dataset(),
        // Without `svc-admin`: no POI renamed.
        inventory: createInventoryClient({ baseUrl: INVENTORY_URL, timeoutMs: 1000 }),
      });
      mswServer.use(
        http.post(`${SOCIAL_URL}/api/internal/players/:id/notifications`, () =>
          HttpResponse.error(),
        ),
        http.post(`${SOCIAL_URL}/api/internal/players/:id/activity`, () =>
          HttpResponse.json({ message: 'Database down' }, { status: 500 }),
        ),
      );
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { object_data: base } = discoveryOf(ids.discoveryEcho);

      const res = await request(approve(ids.discoveryEcho), post({ base }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        poiRenamed: false,
        notified: false,
        recorded: false,
      });
      expect(persistence.items.get(ids.discoveryEcho)?.object_data.status).toBe('approved');
      expect(quiet).toHaveBeenCalledTimes(2);
      quiet.mockRestore();
    });
  });

  describe('refusing', () => {
    it('saves the reason and tells the discoverer the refused name', async () => {
      const { request, persistence, social, inventory } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryEcho);

      const res = await request(refuse(ids.discoveryEcho), post({ base, reason: ' Too long. ' }));
      expect(res.status).toBe(200);
      expect(RefuseDiscoveryResponseSchema.parse(await res.json())).toMatchObject({
        notified: true,
        recorded: true,
      });
      expect(persistence.items.get(ids.discoveryEcho)?.object_data).toMatchObject({
        status: 'refused',
        refusal_reason: 'Too long.',
        approved_name: '',
      });
      const event = {
        kind: 'cave',
        name: "L'Antre des Échos",
        reason: 'Too long.',
        discoveryId: ids.discoveryEcho,
      };
      expect(social.writes.map((w) => w.body)).toEqual([
        { type: 'place_name_refused', data: event },
        { type: 'place_name_refused', details: event },
      ]);
      expect(inventory.writes).toEqual([]);
    });

    it('requires a reason of 1 to 500 characters', async () => {
      const { request } = buildApp({ dataset: dataset() });
      const { object_data: base } = discoveryOf(ids.discoveryEcho);

      expect((await request(refuse(ids.discoveryEcho), post({ base, reason: ' ' }))).status).toBe(
        400,
      );
      expect(
        (await request(refuse(ids.discoveryEcho), post({ base, reason: 'x'.repeat(501) }))).status,
      ).toBe(400);
    });
  });

  describe('rights (ADR 0023)', () => {
    const as = async (clientRoles: string[]) => {
      const ctx = setup(
        fakeProvider(() =>
          tokens({ realmRoles: ['player'], clientRoles: { 'dyingstar-admin': clientRoles } }),
        ),
        { dataset: dataset() },
      );
      const { cookie } = await signIn(ctx);
      const list = await ctx.call('/api/exploration/discoveries', { cookie });
      const res = await ctx.call(approve(ids.discoveryEcho), {
        method: 'POST',
        cookie,
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base: discoveryOf(ids.discoveryEcho).object_data }),
      });
      return {
        list: list.status,
        status: res.status,
        body: (await res.json()) as unknown,
        social: ctx.social.writes.map((w) => w.call),
        inventory: ctx.inventory.writes.length,
        audited: ctx.audited,
      };
    };

    it('lists for persistence:read, decides with persistence:write and social:notify:write', async () => {
      expect(await as(['persistence:read'])).toMatchObject({ list: 200, status: 403 });
      expect(await as(['persistence:write'])).toMatchObject({ status: 403 });
      expect(await as(['social:notify:write'])).toMatchObject({ list: 403, status: 403 });
    });

    it('records the activity and renames the POI only for who holds their roles', async () => {
      const told = await as(['persistence:write', 'social:notify:write']);
      expect(told).toMatchObject({
        status: 200,
        body: { poiRenamed: false, notified: true, recorded: false },
        inventory: 0,
      });
      expect(told.social).toEqual([`POST /internal/players/${socialIds.griefer}/notifications`]);
      expect(told.audited).toEqual([
        expect.objectContaining({
          service: 'persistence',
          method: 'POST',
          path: approve(ids.discoveryEcho),
          status: 200,
        }),
      ]);

      const all = await as([
        'persistence:write',
        'social:notify:write',
        'social:player:write',
        'inventory:poi:manage',
      ]);
      expect(all).toMatchObject({
        body: { poiRenamed: true, notified: true, recorded: true },
        inventory: 1,
      });
    });
  });

  it('is unknown without persistence', async () => {
    const { request } = buildApp({ persistenceUrl: undefined });

    expect((await request('/api/exploration/discoveries')).status).toBe(404);
  });

  it('skips telling the player when social has no svc-admin', async () => {
    const { request, social } = buildApp({
      dataset: dataset(),
      social: createSocialClient({ baseUrl: SOCIAL_URL, timeoutMs: 1000 }),
    });
    const { object_data: base } = discoveryOf(ids.discoveryEcho);

    const res = await request(refuse(ids.discoveryEcho), post({ base, reason: 'No.' }));
    expect(await res.json()).toMatchObject({ notified: false, recorded: false });
    expect(social.writes).toEqual([]);
  });
});
