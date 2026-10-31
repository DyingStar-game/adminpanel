import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { zPoi, zPoiView } from '@dyingstar-admin/contracts/inventory';
import { createInventoryMock, INVENTORY_URL, poiIds } from './inventoryMock';
import { createMissionDataset } from './missionMock';

const mock = createInventoryMock();
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const read = (path: string) =>
  fetch(`${INVENTORY_URL}/api${path}`, { headers: { Authorization: 'Bearer token' } });

describe('inventory mock (ADR 0013)', () => {
  it('serves a POI with its shares, as its code does', async () => {
    const res = await read(`/internal/pois/${poiIds.foundryBay}`);
    expect(res.status).toBe(200);
    expect(zPoiView.safeParse(await res.json()).error).toBeUndefined();
    expect(mock.tokens).toEqual(['Bearer token']);
  });

  it('answers 404 for an unknown POI and 400 for an id that is not a UUID', async () => {
    expect((await read(`/internal/pois/${poiIds.missing}`)).status).toBe(404);
    expect((await read('/internal/pois/foundry')).status).toBe(400);
  });

  it('edits a POI as its code does, the metadata replaced whole (ADR 0032)', async () => {
    const patch = (id: string, body: unknown) =>
      fetch(`${INVENTORY_URL}/api/internal/pois/${id}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const res = await patch(poiIds.caveEcho, { name: 'Echo Cave', metadata: { uncharted: false } });
    expect(res.status).toBe(200);
    const poi = zPoi.parse(await res.json());
    expect(poi).toMatchObject({ name: 'Echo Cave', metadata: { uncharted: false } });
    expect(mock.writes.at(-1)).toEqual({
      call: `PATCH /internal/pois/${poiIds.caveEcho}`,
      body: { name: 'Echo Cave', metadata: { uncharted: false } },
    });
    expect((await patch(poiIds.caveEcho, {})).status).toBe(400);
    expect((await patch(poiIds.missing, { name: 'Lost' })).status).toBe(404);
  });

  it("holds every POI of the mission fixtures' objectives but the missing one", () => {
    const held = new Set(mock.pois.map((p) => p.id));
    const referenced = createMissionDataset().objectives.flatMap((o) =>
      Object.values(o.params ?? {}).flatMap((v) =>
        v && typeof v === 'object' && 'poiId' in v ? [String(v.poiId)] : [],
      ),
    );
    expect(referenced.filter((id) => !held.has(id))).toEqual([poiIds.missing]);
  });
});
