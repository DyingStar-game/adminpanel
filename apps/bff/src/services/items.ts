import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import {
  EditConflictDetailsSchema,
  ErrorCode,
  type AncestorsResponse,
  type BodyMapResponse,
  type ChildrenCountsResponse,
  type CreateItem,
  type DuplicateRequest,
  type Item,
  type ListItemsQuery,
  type PaginatedItems,
  type SceneUsage,
} from '@dyingstar-admin/schemas';
import type { PersistenceClient } from '../clients/persistence';
import { ApiError, notFound } from '../lib/errors';
import type { DefinitionsService } from './definitions';
import { buildBodyMap, PLACED_THROUGH_PARENT } from './bodyMap';
import { planDuplicate } from './duplicate';
import { mergeEdit, type EditRequest } from './merge';

/** Depth guard when walking `parent_id` up (ADR 0005). */
export const MAX_ANCESTOR_DEPTH = 32;
/** Below this many UUIDs, existence is checked item by item instead of a full scan. */
const EXISTS_DIRECT_LOOKUP_MAX = 50;
const SCAN_PAGE_SIZE = 10_000;
/** Lifetime of the known scenes list (one full scan per refresh). */
const SCENES_TTL_MS = 5 * 60 * 1000;
/** Largest subtree duplicated at once (ADR 0017). */
export const MAX_DUPLICATE = 200;
/** Largest body map computed at once (ADR 0018). */
export const MAX_MAP_POINTS = 20_000;

export interface ItemsServiceOptions {
  client: PersistenceClient;
  definitions: DefinitionsService;
  /** Lifetime of coalesced reads; 0 disables coalescing. */
  readCacheTtlMs: number;
}

/** Item operations for one game server, adding what persistence does not provide. */
export function createItemsService({ client, definitions, readCacheTtlMs }: ItemsServiceOptions) {
  const limit = pLimit(8);
  // Identical concurrent reads share one persistence call (ADR 0009). Values are boxed because
  // the cache cannot hold null (unknown item).
  const reads = new LRUCache<string, { value: unknown }, () => Promise<unknown>>({
    max: 500,
    ttl: Math.max(readCacheTtlMs, 1),
    fetchMethod: async (_key, _stale, { context }) => ({ value: await context() }),
  });

  async function read<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (readCacheTtlMs === 0) return load();
    const boxed = await reads.fetch(key, { context: load });
    return boxed?.value as T;
  }

  const get = (uuid: string) => read(`get:${uuid}`, () => client.get(uuid));
  const list = (query: ListItemsQuery) =>
    read(`list:${JSON.stringify(query)}`, () => client.list(query));
  const total = async (query: Omit<ListItemsQuery, 'page' | 'page_size'>) =>
    (await list({ ...query, page: 1, page_size: 1 })).total;

  /**
   * Persistence stores any `object_type` (no check in services/persistence): writes are only
   * allowed for types that have a definition (ADR 0015). No definition at all = no restriction.
   */
  async function assertKnownType(objectType: string): Promise<void> {
    const types = (await definitions.list()).definitions.map((d) => d.type);
    if (types.length > 0 && !types.includes(objectType)) {
      throw new ApiError(400, ErrorCode.unknownObjectType, `Unknown object_type "${objectType}"`, {
        allowed: types,
      });
    }
  }

  /** Every item matching a filter, page by page. */
  async function listAll(filter: Omit<ListItemsQuery, 'page' | 'page_size'>): Promise<Item[]> {
    const all: Item[] = [];
    for (let page = 1; ; page++) {
      const res = await client.list({ ...filter, page, page_size: SCAN_PAGE_SIZE });
      all.push(...res.items);
      if (res.items.length < SCAN_PAGE_SIZE || page * SCAN_PAGE_SIZE >= res.total) break;
    }
    return all;
  }

  /** Every item, page by page (full scan: reserved to rare, cached or explicit uses). */
  const scanAll = () => listAll({});

  // Known scenes change rarely and need a full scan: cached for a few minutes.
  const scenes = new LRUCache<'scenes', SceneUsage[]>({
    max: 1,
    ttl: SCENES_TTL_MS,
    fetchMethod: async () => {
      const counts = new Map<string, SceneUsage>();
      for (const item of await scanAll()) {
        const scenename = item.object_data.scenename;
        if (typeof scenename !== 'string' || !scenename) continue;
        const key = `${item.object_type}|${scenename}`;
        const entry = counts.get(key) ?? { scenename, object_type: item.object_type, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      }
      return [...counts.values()].sort((a, b) => b.count - a.count);
    },
  });

  async function getOrThrow(uuid: string): Promise<Item> {
    const item = await get(uuid);
    if (!item) throw notFound(`Item ${uuid} not found`);
    return item;
  }

  return {
    list(query: ListItemsQuery): Promise<PaginatedItems> {
      return list(query);
    },

    get: getOrThrow,

    /** Ancestors from the root down to the direct parent. */
    async ancestors(uuid: string): Promise<AncestorsResponse> {
      const item = await getOrThrow(uuid);
      const ancestors: Item[] = [];
      const seen = new Set([item.object_uuid]);
      let parentId = item.object_data.parent_id;
      while (parentId) {
        if (seen.has(parentId) || ancestors.length >= MAX_ANCESTOR_DEPTH) {
          return { ancestors: ancestors.reverse(), missingParentId: null, truncated: true };
        }
        const parent = await get(parentId);
        if (!parent) {
          return { ancestors: ancestors.reverse(), missingParentId: parentId, truncated: false };
        }
        seen.add(parentId);
        ancestors.push(parent);
        parentId = parent.object_data.parent_id;
      }
      return { ancestors: ancestors.reverse(), missingParentId: null, truncated: false };
    },

    /** Children count, overall and per known object type. */
    async childrenCounts(uuid: string): Promise<ChildrenCountsResponse> {
      const [all, { definitions: defs }] = await Promise.all([
        total({ parent_id: uuid }),
        definitions.list(),
      ]);
      if (all === 0) return { total: 0, byType: [], other: 0 };
      const counts = await Promise.all(
        defs.map((d) =>
          limit(async () => ({
            object_type: d.type,
            total: await total({ parent_id: uuid, object_type: d.type }),
          })),
        ),
      );
      const byType = counts.filter((c) => c.total > 0);
      const known = byType.reduce((sum, c) => sum + c.total, 0);
      return { total: all, byType, other: Math.max(all - known, 0) };
    },

    /**
     * Duplicates an item, and its descendants when asked, next to a target (ADR 0017).
     * Parents are created before their children; a failure reports what was already created.
     */
    async duplicate(uuid: string, request: DuplicateRequest): Promise<Item[]> {
      const source = await client.get(uuid);
      if (!source) throw notFound(`Item ${uuid} not found`);
      const items = [source];
      // Breadth-first: parents always come before their children.
      for (let i = 0; request.children !== false && i < items.length; i++) {
        const parent = items[i] as Item;
        for (let page = 1; ; page++) {
          const res = await client.list({
            parent_id: parent.object_uuid,
            page,
            page_size: SCAN_PAGE_SIZE,
          });
          items.push(...res.items);
          if (items.length > MAX_DUPLICATE) {
            throw new ApiError(
              400,
              ErrorCode.duplicateTooLarge,
              `Duplicating more than ${MAX_DUPLICATE} items at once is not allowed`,
              { max: MAX_DUPLICATE },
            );
          }
          if (res.items.length < SCAN_PAGE_SIZE || page * SCAN_PAGE_SIZE >= res.total) break;
        }
      }
      for (const type of new Set(items.map((item) => item.object_type)))
        await assertKnownType(type);

      const copies = planDuplicate(items, {
        parentId: request.parent_id,
        position: request.position,
        rotation: request.rotation,
      });
      const created: Item[] = [];
      try {
        for (const copy of copies) created.push(await client.create(copy));
      } catch (error) {
        throw new ApiError(
          502,
          ErrorCode.duplicatePartial,
          `Duplication stopped after ${created.length} of ${copies.length} items`,
          {
            created: created.map((item) => item.object_uuid),
            cause: error instanceof Error ? error.message : String(error),
          },
        );
      } finally {
        reads.clear();
      }
      return created;
    },

    /** Map of a celestial body: its children and the players they house (ADR 0018). */
    bodyMap(uuid: string): Promise<BodyMapResponse> {
      return read(`map:${uuid}`, async () => {
        const body = await getOrThrow(uuid);
        const [children, ...placedTotals] = await Promise.all([
          total({ parent_id: uuid }),
          ...PLACED_THROUGH_PARENT.map((type) => total({ object_type: type })),
        ]);
        const size = placedTotals.reduce((sum, n) => sum + n, children);
        if (size > MAX_MAP_POINTS) {
          throw new ApiError(
            400,
            ErrorCode.mapTooLarge,
            `A map of more than ${MAX_MAP_POINTS} items is not computed`,
            { max: MAX_MAP_POINTS, size },
          );
        }
        const [items, ...placed] = await Promise.all([
          listAll({ parent_id: uuid }),
          ...PLACED_THROUGH_PARENT.map((type) => listAll({ object_type: type })),
        ]);
        return buildBodyMap(body, items, placed.flat());
      });
    },

    /** `scenename` values in use, with their type and count, most used first. */
    async scenes(): Promise<SceneUsage[]> {
      return (await scenes.fetch('scenes')) ?? [];
    },

    /** Exact existence check (ADR 0004): direct lookups when few, one full scan otherwise. */
    async exists(uuids: string[]): Promise<string[]> {
      const wanted = [...new Set(uuids)];
      if (wanted.length <= EXISTS_DIRECT_LOOKUP_MAX) {
        const found = await Promise.all(
          wanted.map((uuid) => limit(async () => ((await client.get(uuid)) ? uuid : null))),
        );
        return found.filter((uuid): uuid is string => uuid !== null);
      }
      const known = new Set((await scanAll()).map((item) => item.object_uuid));
      return wanted.filter((uuid) => known.has(uuid));
    },

    /** Creates an item, refusing to overwrite an existing one (persistence POST is an upsert). */
    async create(item: CreateItem): Promise<Item> {
      await assertKnownType(item.object_type);
      if (await client.get(item.object_uuid)) {
        throw new ApiError(409, ErrorCode.alreadyExists, `Item ${item.object_uuid} already exists`);
      }
      const created = await client.create(item);
      reads.clear();
      return created;
    },

    /** Field-level merge on the latest version, then full replace (ADR 0009). */
    async update(uuid: string, objectType: string, edit: EditRequest): Promise<Item> {
      const latest = await client.get(uuid);
      if (!latest) throw notFound(`Item ${uuid} not found`);
      // An item whose type lost its definition stays editable as long as it keeps its type.
      if (objectType !== latest.object_type) await assertKnownType(objectType);
      const { data, conflicts } = mergeEdit(latest.object_data, edit);
      if (conflicts.length > 0) {
        throw new ApiError(
          409,
          ErrorCode.editConflict,
          'The item changed since editing started',
          EditConflictDetailsSchema.parse({ conflicts, latest }),
        );
      }
      const updated = await client.replace(uuid, { object_type: objectType, object_data: data });
      reads.clear();
      return updated;
    },

    async remove(uuid: string): Promise<void> {
      await client.remove(uuid);
      reads.clear();
    },
  };
}

export type ItemsService = ReturnType<typeof createItemsService>;
