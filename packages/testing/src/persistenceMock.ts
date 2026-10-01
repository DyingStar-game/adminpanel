import { http, HttpResponse } from 'msw';
import { Vec3Schema, type Item } from '@dyingstar-admin/schemas';

/** Base URL used by tests for the mocked persistence service. */
export const PERSISTENCE_URL = 'http://persistence.test';

export interface PersistenceMock {
  handlers: ReturnType<typeof http.get>[];
  /** Live store, readable and mutable from tests. */
  items: Map<string, Item>;
  /** Number of requests received, by `METHOD path` (query string excluded). */
  calls: Map<string, number>;
}

const notFound = (uuid: string) =>
  HttpResponse.json({ error: `item '${uuid}' not found` }, { status: 404 });

/**
 * Stores an item the way the service does: `position` / `rotation` that are not a valid Vec3
 * are silently dropped (services/persistence/src/rest/handlers.rs).
 */
function normalise(item: Item): Item {
  const invalid = (key: string) =>
    (key === 'position' || key === 'rotation') &&
    !Vec3Schema.safeParse(item.object_data[key]).success;
  return {
    ...item,
    object_data: Object.fromEntries(
      Object.entries(item.object_data).filter(([key]) => !invalid(key)),
    ),
  };
}

/**
 * MSW handlers reproducing the persistence REST behaviour: exact-match filters, 1-based
 * pagination, POST and PUT as upserts, DELETE always 204, `{ "error" }` bodies.
 */
export function createPersistenceMock(
  dataset: Item[],
  baseUrl: string = PERSISTENCE_URL,
): PersistenceMock {
  const items = new Map(dataset.map((item) => [item.object_uuid, item]));
  const calls = new Map<string, number>();
  const count = (key: string) => calls.set(key, (calls.get(key) ?? 0) + 1);

  const handlers = [
    http.get(`${baseUrl}/items`, ({ request }) => {
      count('GET /items');
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('page_size') ?? '100');
      const objectType = url.searchParams.get('object_type');
      const parentId = url.searchParams.get('parent_id');
      const scenename = url.searchParams.get('scenename');
      const filtered = [...items.values()].filter(
        (item) =>
          (objectType === null || item.object_type === objectType) &&
          (parentId === null || (item.object_data.parent_id ?? '') === parentId) &&
          (scenename === null || item.object_data.scenename === scenename),
      );
      const start = (page - 1) * pageSize;
      return HttpResponse.json({
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        page_size: pageSize,
      });
    }),
    http.get(`${baseUrl}/items/:uuid`, ({ params }) => {
      count('GET /items/:uuid');
      const uuid = String(params.uuid);
      const item = items.get(uuid);
      return item ? HttpResponse.json(item) : notFound(uuid);
    }),
    http.post(`${baseUrl}/items`, async ({ request }) => {
      count('POST /items');
      const body = (await request.json()) as Item;
      const item = normalise(body);
      items.set(item.object_uuid, item);
      return HttpResponse.json(item, { status: 201 });
    }),
    http.put(`${baseUrl}/items/:uuid`, async ({ params, request }) => {
      count('PUT /items/:uuid');
      const body = (await request.json()) as Omit<Item, 'object_uuid'>;
      const item = normalise({ ...body, object_uuid: String(params.uuid) });
      items.set(item.object_uuid, item);
      return HttpResponse.json(item);
    }),
    http.delete(`${baseUrl}/items/:uuid`, ({ params }) => {
      count('DELETE /items/:uuid');
      items.delete(String(params.uuid));
      return new HttpResponse(null, { status: 204 });
    }),
  ];

  return { handlers, items, calls };
}
