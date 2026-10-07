import { describe, expect, it } from 'vitest';
import { createDataset, ids } from '@dyingstar-admin/testing';
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

  it('searches a level by a piece of name or UUID, case-insensitive, on every page', async () => {
    const { request } = buildApp();
    const uuids = async (query: string) =>
      (await read(await request(`/api/items?${query}`))).items.map(
        (i: { object_uuid: string }) => i.object_uuid,
      );

    // SandBox's children: a piece of a name, in another case…
    expect(await uuids(`parent_id=${ids.planet}&q=TARSIS_4`)).toEqual([ids.spawnbuilding]);
    // …a piece of a UUID (the vehicle has no name)…
    expect(await uuids(`parent_id=${ids.planet}&q=9ff9-2c69`)).toEqual([ids.vehicle]);
    // …within the listed level only (the player lives in the building).
    expect(await uuids(`parent_id=${ids.planet}&q=ddurieux`)).toEqual([]);
    expect(await uuids(`object_type=player&q=durieux`)).toEqual([ids.player]);
  });

  it('pages the matches of a search and gives their total', async () => {
    const { request } = buildApp();
    // Every child of SandBox has an "a" in its UUID or name: several matches.
    const all = await read(await request(`/api/items?parent_id=${ids.planet}&q=a`));
    expect(all.total).toBeGreaterThan(1);

    const second = await read(
      await request(`/api/items?parent_id=${ids.planet}&q=a&page=2&page_size=1`),
    );
    expect(second).toMatchObject({ total: all.total, page: 2, page_size: 1 });
    expect(second.items).toEqual([all.items[1]]);
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
    object_type: 'planet',
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

  it('refuses an object type without definition', async () => {
    const { request, persistence } = buildApp();

    const res = await request('/api/items', json({ ...box, object_type: 'spaceship' }));

    expect(res.status).toBe(400);
    const body = await read(res);
    expect(body).toMatchObject({ error: 'UNKNOWN_OBJECT_TYPE' });
    expect(body.details.allowed).toContain('vehicle');
    expect(persistence.items.has(box.object_uuid)).toBe(false);
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

  it('refuses to switch an item to an unknown type', async () => {
    const { request, persistence } = buildApp();

    const res = await request(
      `/api/items/${ids.vehicle}`,
      put({ object_type: 'spaceship', base: stored(persistence), changes: {} }),
    );

    expect(res.status).toBe(400);
    expect(await read(res)).toMatchObject({ error: 'UNKNOWN_OBJECT_TYPE' });
  });

  it('keeps an item editable when its own type has no definition', async () => {
    const { request, persistence } = buildApp();
    const rock = persistence.items.get(ids.rock);

    const res = await request(
      `/api/items/${ids.rock}`,
      put({ object_type: 'miningrock', base: rock?.object_data, changes: { weight: 1 } }),
    );

    expect(res.status).toBe(200);
    expect(persistence.items.get(ids.rock)?.object_data.weight).toBe(1);
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

describe('GET /api/items/scenes', () => {
  it('lists scenes in use with their type and count, most used first', async () => {
    const res = await buildApp().request('/api/items/scenes');

    const body = await read(res);
    // Two engines (FL and the orphan), one battery.
    expect(body.scenes[0]).toEqual({
      scenename: 'scenes/_universe/props/vehicles/engine_t1.tscn',
      object_type: 'vehicle_component',
      count: 2,
    });
    expect(body.scenes).toContainEqual({
      scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
      object_type: 'vehicle',
      count: 1,
    });
  });
});

describe('POST /api/items/:uuid/duplicate', () => {
  const duplicate = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

  it('copies the vehicle and its components next to the target, parents first', async () => {
    const { request, persistence } = buildApp();
    const before = persistence.items.size;

    const res = await request(
      `/api/items/${ids.vehicle}/duplicate`,
      duplicate({ parent_id: ids.spawnbuilding, position: { x: 1, y: 0, z: 2 } }),
    );

    expect(res.status).toBe(201);
    const { created } = await read(res);
    expect(created.map((i: { object_type: string }) => i.object_type)).toEqual([
      'vehicle',
      'vehicle_component',
      'vehicle_component',
    ]);
    expect(persistence.items.size).toBe(before + 3);
    const copy = persistence.items.get(created[0].object_uuid);
    expect(copy?.object_data).toMatchObject({
      parent_id: ids.spawnbuilding,
      position: { x: 1, y: 0, z: 2 },
      components: { slot_fl: created[1].object_uuid, slot_fr: created[2].object_uuid },
    });
    // Written like a new item: no pilot, no state of the moment.
    expect(copy?.object_data).not.toHaveProperty('pilot_uuid');
    expect(copy?.object_data).not.toHaveProperty('speed');
    // The original is untouched.
    expect(persistence.items.get(ids.vehicle)?.object_data.pilot_uuid).toBe(ids.player);
  });

  it('can copy the item alone', async () => {
    const { request } = buildApp();

    const res = await request(
      `/api/items/${ids.vehicle}/duplicate`,
      duplicate({ parent_id: ids.planet, children: false }),
    );

    expect((await read(res)).created).toHaveLength(1);
  });

  it('refuses subtrees larger than the limit', async () => {
    const dataset = createDataset();
    for (let i = 0; i < 201; i++) {
      dataset.push({
        object_type: 'vehicle_component',
        object_uuid: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`,
        object_data: { parent_id: ids.vehicle },
      });
    }
    const { request, persistence } = buildApp({ dataset });
    const before = persistence.items.size;

    const res = await request(`/api/items/${ids.vehicle}/duplicate`, duplicate({ parent_id: '' }));

    expect(res.status).toBe(400);
    expect(await read(res)).toMatchObject({ error: 'DUPLICATE_TOO_LARGE' });
    expect(persistence.items.size).toBe(before);
  });

  it('answers 404 for an unknown item', async () => {
    const res = await buildApp().request(
      '/api/items/unknown/duplicate',
      duplicate({ parent_id: '' }),
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/items/check', () => {
  const NEW = '11111111-1111-4111-8111-111111111111';
  const codes = (body: { findings: { code: string }[] }) => body.findings.map((f) => f.code);

  it('checks a new item against its type, parent and references, without writing', async () => {
    const { request, persistence } = buildApp();
    const res = await request(
      '/api/items/check',
      json({
        mode: 'create',
        item: {
          object_type: 'vehicle',
          object_uuid: NEW,
          object_data: {
            parent_id: ids.missingParent,
            position: { x: 0, y: 0, z: 0 },
            components: { slot_fl: ids.wheelFl, slot_fr: ids.player },
          },
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await read(res);
    expect(codes(body)).toEqual(
      expect.arrayContaining(['parentNotFound', 'refTaken', 'refWrongType']),
    );
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect([...persistence.calls.keys()].some((key) => key.startsWith(method))).toBe(false);
    }
  });

  it('checks only the changed keys of an edit, and refuses a descendant as parent', async () => {
    const vehicle = createDataset().find((i) => i.object_uuid === ids.vehicle);
    if (!vehicle) throw new Error('fixture vehicle missing');
    const res = await buildApp().request(
      '/api/items/check',
      json({
        mode: 'edit',
        changed: ['parent_id'],
        item: { ...vehicle, object_data: { ...vehicle.object_data, parent_id: ids.wheelFl } },
      }),
    );

    // The fixture's dangling component (slot_rl) is not the edit's doing: not reported.
    expect(codes(await read(res))).toEqual(['parentTypeUnusual', 'parentDescendant']);
  });

  it('refuses a parent alias, reserved to the import', async () => {
    const res = await buildApp().request(
      '/api/items/check',
      json({
        mode: 'create',
        item: {
          object_type: 'vehicle',
          object_uuid: NEW,
          object_data: { parent_id: '_planet_SandBox' },
        },
      }),
    );
    expect(codes(await read(res))).toContain('parentInvalid');
  });
});

describe('POST /api/items/import/check', () => {
  const NEW = '11111111-1111-4111-8111-111111111111';

  it('returns a status and findings per item, without writing anything', async () => {
    const { request, persistence } = buildApp();
    const res = await request(
      '/api/items/import/check',
      json({
        items: [
          {
            object_type: 'vehicle',
            object_uuid: NEW,
            object_data: { parent_id: ids.planet, position: { x: 0, y: 0, z: 0 }, speed: 'fast' },
          },
          {
            object_type: 'vehicle',
            object_uuid: ids.vehicle,
            object_data: { parent_id: ids.planet },
          },
          { object_type: 'spaceship', object_uuid: NEW, object_data: {} },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const { rows } = await read(res);
    expect(rows.map((r: { status: string }) => r.status)).toEqual(['new', 'conflict', 'invalid']);
    expect(rows[0].findings).toContainEqual(
      expect.objectContaining({ code: 'kindMismatch', path: 'object_data.speed' }),
    );
    expect(rows[2].findings.map((f: { code: string }) => f.code)).toEqual([
      'unknownType',
      'duplicateUuid',
    ]);
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect([...persistence.calls.keys()].some((key) => key.startsWith(method))).toBe(false);
    }
  });

  it('resolves parent aliases against the server and returns the items to send', async () => {
    const res = await buildApp().request(
      '/api/items/import/check',
      json({
        items: [
          {
            object_type: 'vehicle',
            object_uuid: NEW,
            object_data: { parent_id: '_planet_SandBox' },
          },
          {
            object_type: 'vehicle',
            object_uuid: ids.rock,
            object_data: { parent_id: '_planet_Mars' },
          },
        ],
      }),
    );
    const { rows, items } = await read(res);
    expect(items[0].object_data.parent_id).toBe(ids.planet);
    expect(rows[0].findings[0]).toMatchObject({
      code: 'aliasResolved',
      params: { uuid: ids.planet },
    });
    expect(rows[1]).toMatchObject({ status: 'invalid' });
    expect(rows[1].findings[0]).toMatchObject({ code: 'aliasNotFound' });
  });

  it('refuses more items than the import limit', async () => {
    const items = Array.from({ length: 5001 }, () => ({}));
    const res = await buildApp().request('/api/items/import/check', json({ items }));
    expect(res.status).toBe(400);
  });
});
