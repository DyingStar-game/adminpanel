import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createDataset, ids } from './fixtures';
import { createPersistenceMock, PERSISTENCE_URL } from './persistenceMock';

const mock = createPersistenceMock(createDataset());
const server = setupServer(...mock.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('persistence mock', () => {
  it('filters children with an exact parent_id, roots with an empty one', async () => {
    const roots = await (await fetch(`${PERSISTENCE_URL}/items?parent_id=`)).json();
    expect(roots.items.map((i: { object_uuid: string }) => i.object_uuid).sort()).toEqual(
      [ids.planet, ids.star].sort(),
    );
  });

  it('does not match scenename substrings', async () => {
    const res = await (await fetch(`${PERSISTENCE_URL}/items?scenename=truck`)).json();
    expect(res.total).toBe(0);
  });

  it('paginates and reports the filtered total', async () => {
    const res = await (await fetch(`${PERSISTENCE_URL}/items?page=2&page_size=3`)).json();
    expect(res).toMatchObject({ page: 2, page_size: 3, total: 10 });
    expect(res.items).toHaveLength(3);
  });

  it('answers 404 with an error body for unknown items', async () => {
    const res = await fetch(`${PERSISTENCE_URL}/items/not-a-uuid`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "item 'not-a-uuid' not found" });
  });

  it('upserts on POST and drops an invalid rotation', async () => {
    const res = await fetch(`${PERSISTENCE_URL}/items`, {
      method: 'POST',
      body: JSON.stringify({
        object_type: 'star',
        object_uuid: ids.star,
        object_data: { name: 'Overwritten', rotation: { w: 1, x: 0 } },
      }),
    });
    expect(res.status).toBe(201);
    expect(mock.items.get(ids.star)?.object_data).toEqual({ name: 'Overwritten' });
  });

  it('always answers 204 on DELETE', async () => {
    const res = await fetch(`${PERSISTENCE_URL}/items/unknown`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});
