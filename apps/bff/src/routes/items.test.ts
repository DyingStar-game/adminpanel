import { describe, expect, it } from 'vitest';
import { ids } from '@dyingstar-admin/testing';
import { buildApp } from '../test/harness';

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
// Response bodies are asserted on loosely; typing them would only duplicate the schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<any> => res.json();

describe('server resolution', () => {
  it('requires the X-Server-Id header', async () => {
    const res = await buildApp().app.request('/api/items');

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'SERVER_REQUIRED' });
  });

  it('rejects an unknown server', async () => {
    const res = await buildApp().app.request('/api/items', { headers: { 'X-Server-Id': 'nope' } });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'UNKNOWN_SERVER' });
  });
});

describe('GET /api/items', () => {
  it('lists roots with an empty parent_id filter', async () => {
    const res = await buildApp().request('/api/items?parent_id=');

    const body = await read(res);
    expect(body.total).toBe(2);
  });

  it('only accepts known object types as filter', async () => {
    const { request } = buildApp();

    expect((await request('/api/items?object_type=vehicle')).status).toBe(200);
    const res = await request('/api/items?object_type=spaceship');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
  });

  it('validates pagination', async () => {
    expect((await buildApp().request('/api/items?page_size=20000')).status).toBe(400);
  });
});

describe('GET /api/items/:uuid', () => {
  it('returns the item or a 404', async () => {
    const { request } = buildApp();

    expect(await (await request(`/api/items/${ids.vehicle}`)).json()).toMatchObject({
      object_type: 'vehicle',
    });
    const res = await request('/api/items/unknown');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'NOT_FOUND' });
  });
});

describe('GET /api/items/:uuid/ancestors', () => {
  it('returns ancestors from the root down', async () => {
    const res = await buildApp().request(`/api/items/${ids.player}/ancestors`);

    const body = await read(res);
    expect(body.ancestors.map((i: { object_uuid: string }) => i.object_uuid)).toEqual([
      ids.planet,
      ids.spawnbuilding,
    ]);
    expect(body).toMatchObject({ missingParentId: null, truncated: false });
  });

  it('reports the missing parent of an orphan', async () => {
    const res = await buildApp().request(`/api/items/${ids.orphanComponent}/ancestors`);

    expect(await res.json()).toEqual({
      ancestors: [],
      missingParentId: ids.missingParent,
      truncated: false,
    });
  });

  it('stops on a cycle', async () => {
    const a = { object_type: 'box', object_uuid: 'aaaa', object_data: { parent_id: 'bbbb' } };
    const b = { object_type: 'box', object_uuid: 'bbbb', object_data: { parent_id: 'aaaa' } };

    const res = await buildApp({ dataset: [a, b] }).request('/api/items/aaaa/ancestors');

    expect(await res.json()).toMatchObject({ truncated: true });
  });
});

describe('GET /api/items/:uuid/children-counts', () => {
  it('counts children per known type, the rest as other', async () => {
    const res = await buildApp().request(`/api/items/${ids.planet}/children-counts`);

    const body = await read(res);
    // miningrock has no definition in the test GitHub mock.
    expect(body).toMatchObject({ total: 4, other: 1 });
    expect(body.byType).toEqual(
      expect.arrayContaining([
        { object_type: 'planet', total: 1 },
        { object_type: 'spawnbuilding', total: 1 },
        { object_type: 'vehicle', total: 1 },
      ]),
    );
  });

  it('short-circuits for an item without children', async () => {
    const { request, persistence } = buildApp();

    expect(await (await request(`/api/items/${ids.rock}/children-counts`)).json()).toEqual({
      total: 0,
      byType: [],
      other: 0,
    });
    expect(persistence.calls.get('GET /items')).toBe(1);
  });
});

describe('POST /api/items/exists', () => {
  it('checks a few UUIDs one by one', async () => {
    const { request, persistence } = buildApp();

    const res = await request('/api/items/exists', json({ uuids: [ids.vehicle, 'unknown'] }));

    expect(await res.json()).toEqual({ existing: [ids.vehicle] });
    expect(persistence.calls.get('GET /items')).toBeUndefined();
  });

  it('scans the whole dataset for many UUIDs', async () => {
    const { request, persistence } = buildApp();
    const uuids = [ids.star, ...Array.from({ length: 60 }, (_, i) => `missing-${i}`)];

    const res = await request('/api/items/exists', json({ uuids }));

    expect(await res.json()).toEqual({ existing: [ids.star] });
    expect(persistence.calls.get('GET /items/:uuid')).toBeUndefined();
  });
});

describe('POST /api/items', () => {
  const box = {
    object_type: 'box',
    object_uuid: '11111111-2222-3333-4444-555555555555',
    object_data: { parent_id: ids.planet },
  };

  it('creates a new item', async () => {
    const { request, persistence } = buildApp();

    const res = await request('/api/items', json(box));

    expect(res.status).toBe(201);
    expect(persistence.items.has(box.object_uuid)).toBe(true);
  });

  it('refuses to overwrite an existing item (persistence POST is an upsert)', async () => {
    const { request, persistence } = buildApp();

    const res = await request('/api/items', json({ ...box, object_uuid: ids.vehicle }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'ALREADY_EXISTS' });
    expect(persistence.items.get(ids.vehicle)?.object_type).toBe('vehicle');
  });

  it('validates the body', async () => {
    const res = await buildApp().request('/api/items', json({ ...box, object_uuid: 'nope' }));

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/items/:uuid', () => {
  const put = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body) });
  /** Stored data of the fixture vehicle, as the game would see it. */
  const stored = (persistence: ReturnType<typeof buildApp>['persistence']) => {
    const item = persistence.items.get(ids.vehicle);
    if (!item) throw new Error('fixture vehicle missing');
    return item.object_data;
  };

  it('merges the edit on the latest version without reverting game saves', async () => {
    const { request, persistence } = buildApp();
    const base = structuredClone(stored(persistence));
    // The game saves a new position after the user opened the editor.
    stored(persistence).position = { x: 1, y: 2, z: 3 };

    const res = await request(
      `/api/items/${ids.vehicle}`,
      put({ object_type: 'vehicle', base, changes: { engine: false } }),
    );

    expect(res.status).toBe(200);
    expect(persistence.items.get(ids.vehicle)?.object_data).toMatchObject({
      engine: false,
      position: { x: 1, y: 2, z: 3 },
    });
  });

  it('answers 409 with the conflicts when the game changed an edited key', async () => {
    const { request, persistence } = buildApp();
    const base = structuredClone(stored(persistence));
    stored(persistence).speed = 99;

    const res = await request(
      `/api/items/${ids.vehicle}`,
      put({ object_type: 'vehicle', base, changes: { speed: 0 } }),
    );

    expect(res.status).toBe(409);
    const body = await read(res);
    expect(body.error).toBe('EDIT_CONFLICT');
    expect(body.details.conflicts).toEqual([{ key: 'speed', base: 28.7, latest: 99, mine: 0 }]);
    expect(persistence.items.get(ids.vehicle)?.object_data.speed).toBe(99);
  });

  it('applies the edit when forced', async () => {
    const { request, persistence } = buildApp();
    const base = structuredClone(stored(persistence));
    stored(persistence).speed = 99;

    await request(
      `/api/items/${ids.vehicle}`,
      put({ object_type: 'vehicle', base, changes: { speed: 0 }, force: true }),
    );

    expect(persistence.items.get(ids.vehicle)?.object_data.speed).toBe(0);
  });

  it('returns 404 instead of creating an unknown item (persistence PUT is an upsert)', async () => {
    const { request, persistence } = buildApp();

    const res = await request(
      '/api/items/unknown',
      put({ object_type: 'box', base: {}, changes: { a: 1 } }),
    );

    expect(res.status).toBe(404);
    expect(persistence.items.has('unknown')).toBe(false);
  });
});

describe('DELETE /api/items/:uuid', () => {
  it('deletes and answers 204', async () => {
    const { request, persistence } = buildApp();

    const res = await request(`/api/items/${ids.rock}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(persistence.items.has(ids.rock)).toBe(false);
  });
});

describe('read coalescing', () => {
  it('shares concurrent identical reads and drops them after a write', async () => {
    const { request, persistence } = buildApp({ readCacheTtlMs: 10_000 });

    await Promise.all([1, 2, 3].map(() => request(`/api/items/${ids.vehicle}`)));
    expect(persistence.calls.get('GET /items/:uuid')).toBe(1);

    await request(`/api/items/${ids.rock}`, { method: 'DELETE' });
    await request(`/api/items/${ids.vehicle}`);
    expect(persistence.calls.get('GET /items/:uuid')).toBe(2);
  });
});
