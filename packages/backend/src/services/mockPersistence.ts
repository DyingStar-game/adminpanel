/**
 * Local JSON file mock for the persistence service during development.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type { CreateItemRequest, ItemResponse, PutItemRequest } from '@dyingstar/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../../data/mock-items.json');
const SEED_PATH = join(__dirname, '../../data/seed.json');

let items: ItemResponse[] = [];

/**
 * Loads items from mock data file or seeds from `seed.json` on first run.
 */
function load(): void {
  if (existsSync(DATA_PATH)) {
    items = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as ItemResponse[];
  } else {
    items = JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as ItemResponse[];
    save();
  }
}

/**
 * Writes the in-memory item list to `mock-items.json`.
 */
function save(): void {
  writeFileSync(DATA_PATH, JSON.stringify(items, null, 2));
}

load();

/**
 * Lists mock items with the same pagination/filter semantics as persistence API.
 * @param params - Page, page size, and optional filters.
 * @returns Paginated items and total count.
 */
export function mockListItems(params: {
  page: number;
  page_size: number;
  object_type?: string;
  scenename?: string;
  parent_id?: string;
}): { items: ItemResponse[]; total: number; page: number; page_size: number } {
  let filtered = [...items];
  if (params.object_type) {
    filtered = filtered.filter((i) => i.object_type === params.object_type);
  }
  if (params.scenename) {
    filtered = filtered.filter((i) =>
      String(i.object_data.scenename ?? '').includes(params.scenename!),
    );
  }
  if (params.parent_id) {
    filtered = filtered.filter((i) => i.object_data.parent_id === params.parent_id);
  }
  const total = filtered.length;
  const start = (params.page - 1) * params.page_size;
  const pageItems = filtered.slice(start, start + params.page_size);
  return { items: pageItems, total, page: params.page, page_size: params.page_size };
}

/**
 * Gets one mock item by UUID.
 * @param uuid - Item object UUID.
 * @returns Item if found.
 */
export function mockGetItem(uuid: string): ItemResponse | undefined {
  return items.find((i) => i.object_uuid === uuid);
}

/**
 * Appends a new mock item and persists to disk.
 * @param body - Create item request.
 * @returns Created item.
 */
export function mockCreateItem(body: CreateItemRequest): ItemResponse {
  const uuid = body.object_uuid ?? randomUUID();
  const item: ItemResponse = {
    object_type: body.object_type,
    object_uuid: uuid,
    object_data: body.object_data,
  };
  items.push(item);
  save();
  return item;
}

/**
 * Merges updates into an existing mock item.
 * @param uuid - Item object UUID.
 * @param body - Update payload.
 * @returns Updated item, or null if not found.
 */
export function mockUpdateItem(uuid: string, body: PutItemRequest): ItemResponse | null {
  const idx = items.findIndex((i) => i.object_uuid === uuid);
  if (idx === -1) return null;
  const existing = items[idx];
  items[idx] = {
    object_type: body.object_type ?? existing.object_type,
    object_uuid: uuid,
    object_data: { ...existing.object_data, ...body.object_data },
  };
  save();
  return items[idx];
}

/**
 * Removes a mock item by UUID.
 * @param uuid - Item object UUID.
 * @returns True if removed.
 */
export function mockDeleteItem(uuid: string): boolean {
  const idx = items.findIndex((i) => i.object_uuid === uuid);
  if (idx === -1) return false;
  items.splice(idx, 1);
  save();
  return true;
}

/**
 * Returns total number of mock items in memory.
 * @returns Item count.
 */
export function mockCountItems(): number {
  return items.length;
}

/**
 * Returns the set of all mock item UUIDs (used for validation/dedup helpers).
 * @returns Set of object UUID strings.
 */
export function mockGetAllUuids(): Set<string> {
  return new Set(items.map((i) => i.object_uuid));
}

/**
 * Detects URLs that should route to the in-process mock persistence store.
 * @param url - Service base URL.
 * @returns True if mock persistence should be used.
 */
export function isMockUrl(url: string): boolean {
  return url.includes('mock-persistence') || url.includes('localhost:3000/mock');
}
