/**
 * HTTP client for the game persistence service (items CRUD).
 */
import fetch from 'node-fetch';
import type { CreateItemRequest, ItemResponse, PutItemRequest } from '@dyingstar/shared';
import {
  isMockUrl,
  mockListItems,
  mockGetItem,
  mockCreateItem,
  mockUpdateItem,
  mockDeleteItem,
  mockCountItems,
} from '../services/mockPersistence.js';

/**
 * Performs a JSON request against the persistence service base URL.
 * @param baseUrl - Persistence service root URL.
 * @param path - API path (including query string if needed).
 * @param options - Optional HTTP method and JSON body.
 * @returns Raw fetch response.
 */
async function request(baseUrl: string, path: string, options?: { method?: string; body?: unknown }) {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

/** Persistence API wrapper with mock fallback for local development. */
export const persistenceClient = {
  /**
   * Lists items with pagination and optional filters.
   * @param baseUrl - Persistence service root URL.
   * @param params - Page, page size, and filter fields.
   * @returns Paginated item list JSON from persistence or mock store.
   */
  async list(
    baseUrl: string,
    params: {
      page: number;
      page_size: number;
      object_type?: string;
      scenename?: string;
      parent_id?: string;
    },
  ) {
    if (isMockUrl(baseUrl)) return mockListItems(params);
    const qs = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.page_size),
    });
    if (params.object_type) qs.set('object_type', params.object_type);
    if (params.scenename) qs.set('scenename', params.scenename);
    if (params.parent_id) qs.set('parent_id', params.parent_id);
    const res = await request(baseUrl, `/items?${qs}`);
    if (!res.ok) throw new Error(`Persistence error: ${res.status}`);
    return res.json();
  },

  /**
   * Fetches a single item by UUID.
   * @param baseUrl - Persistence service root URL.
   * @param uuid - Item object UUID.
   * @returns Item payload, or null if not found.
   */
  async get(baseUrl: string, uuid: string): Promise<ItemResponse | null> {
    if (isMockUrl(baseUrl)) return mockGetItem(uuid) ?? null;
    const res = await request(baseUrl, `/items/${uuid}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Persistence error: ${res.status}`);
    return res.json() as Promise<ItemResponse>;
  },

  /**
   * Creates a new persistence item.
   * @param baseUrl - Persistence service root URL.
   * @param body - Create item request body.
   * @returns Created item.
   */
  async create(baseUrl: string, body: CreateItemRequest): Promise<ItemResponse> {
    if (isMockUrl(baseUrl)) return mockCreateItem(body);
    const res = await request(baseUrl, '/items', { method: 'POST', body });
    if (!res.ok) throw new Error(`Persistence error: ${res.status}`);
    return res.json() as Promise<ItemResponse>;
  },

  /**
   * Updates an existing item by UUID.
   * @param baseUrl - Persistence service root URL.
   * @param uuid - Item object UUID.
   * @param body - Partial update payload.
   * @returns Updated item, or null if not found.
   */
  async update(baseUrl: string, uuid: string, body: PutItemRequest): Promise<ItemResponse | null> {
    if (isMockUrl(baseUrl)) return mockUpdateItem(uuid, body);
    const res = await request(baseUrl, `/items/${uuid}`, { method: 'PUT', body });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Persistence error: ${res.status}`);
    return res.json() as Promise<ItemResponse>;
  },

  /**
   * Deletes an item by UUID.
   * @param baseUrl - Persistence service root URL.
   * @param uuid - Item object UUID.
   * @returns True if deletion succeeded.
   */
  async delete(baseUrl: string, uuid: string): Promise<boolean> {
    if (isMockUrl(baseUrl)) return mockDeleteItem(uuid);
    const res = await request(baseUrl, `/items/${uuid}`, { method: 'DELETE' });
    return res.ok;
  },

  /**
   * Returns total item count (uses list endpoint with page_size=1).
   * @param baseUrl - Persistence service root URL.
   * @returns Total items, or 0 on error.
   */
  async count(baseUrl: string): Promise<number> {
    if (isMockUrl(baseUrl)) return mockCountItems();
    try {
      const data = await this.list(baseUrl, { page: 1, page_size: 1 });
      return (data as { total: number }).total ?? 0;
    } catch {
      return 0;
    }
  },
};
