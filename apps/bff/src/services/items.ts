import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import {
  checkImportFormat,
  isParentAlias,
  resolveParentAliases,
  UuidSchema,
  EditConflictDetailsSchema,
  ErrorCode,
  MAP_PLACED_THROUGH_PARENT,
  type AncestorsResponse,
  type BodyMapResponse,
  type ChildrenCountsResponse,
  type CreateItem,
  type DuplicateRequest,
  type ImportCheckResponse,
  type ImportFinding,
  type Item,
  type ItemCheckRequest,
  type ItemCheckResponse,
  type ListItemsQuery,
  type PaginatedItems,
  type SceneUsage,
} from '@dyingstar-admin/schemas';
import type { PersistenceClient } from '../clients/persistence';
import { ApiError, notFound } from '../lib/errors';
import type { DefinitionsService } from './definitions';
import { buildBodyMap, type BodyFrame } from './bodyMap';
import { planDuplicate } from './duplicate';
import { buildImportContext, checkImportCoherence, scenesFrom, uuidsIn } from './importCheck';
import { mergeEdit, type EditRequest } from './merge';

/** Depth guard when walking `parent_id` up (ADR 0005). */
export const MAX_ANCESTOR_DEPTH = 32;
/** Below this many UUIDs, existence is checked item by item instead of a full scan. */
const EXISTS_DIRECT_LOOKUP_MAX = 50;
const SCAN_PAGE_SIZE = 10_000;
/** Lifetime of the known scenes list (one full scan per refresh). */
const SCENES_TTL_MS = 5 * 60 * 1000;
/**
 * Lifetime of a type's items and their parents, read by the single-item check (ADR 0022): one
 * filtered scan per type, kept a few minutes and dropped on every write.
 */
const TYPE_SAMPLE_TTL_MS = 5 * 60 * 1000;
/**
 * Lifetime of counts (children per type, totals per type): each is a full scan on persistence
 * (1 to 10 s) and the game saves about every 60 s, so they are kept a minute and served stale
 * while refreshed in the background.
 */
export const COUNTS_TTL_MS = 60 * 1000;
/**
 * Lifetime of a body's listing for its map: the game saves an item about every 60 s, so 30 s
 * keeps the map within one save while sparing persistence.
 */
export const SNAPSHOT_TTL_MS = 30 * 1000;
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

/** Items per type, most numerous first. */
const countByType = (items: Item[]) => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.object_type, (counts.get(item.object_type) ?? 0) + 1);
  return [...counts]
    .map(([object_type, total]) => ({ object_type, total }))
    .sort((a, b) => b.total - a.total);
};

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

  // Counts: slow, slow-changing; a stale value answers at once while the new one is computed.
  const countCache = new LRUCache<string, { value: unknown }, () => Promise<unknown>>({
    max: 500,
    ttl: COUNTS_TTL_MS,
    allowStale: true,
    noDeleteOnStaleGet: true,
    fetchMethod: async (_key, _stale, { context }) => ({ value: await context() }),
  });

  // Map frame per body, kept while the BFF runs: points stay put between refreshes.
  const frames = new LRUCache<string, BodyFrame>({ max: 100 });

  // Listings of a body for its map: slow, kept a while and refreshed in the background.
  const snapshots = new LRUCache<string, { value: unknown }, () => Promise<unknown>>({
    max: 50,
    ttl: SNAPSHOT_TTL_MS,
    allowStale: true,
    noDeleteOnStaleGet: true,
    fetchMethod: async (_key, _stale, { context }) => ({ value: await context() }),
  });

  async function snapshot<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (readCacheTtlMs === 0) return load();
    const boxed = await snapshots.fetch(key, { context: load });
    return boxed?.value as T;
  }

  async function counted<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (readCacheTtlMs === 0) return load();
    const boxed = await countCache.fetch(key, { context: load });
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

  // Items of a type and their parents, for the single-item check (ADR 0022).
  const typeSamples = new LRUCache<string, { value: Item[] }, () => Promise<Item[]>>({
    max: 50,
    ttl: TYPE_SAMPLE_TTL_MS,
    fetchMethod: async (_key, _stale, { context }) => ({ value: await context() }),
  });

  async function loadTypeSample(objectType: string): Promise<Item[]> {
    const items = await listAll({ object_type: objectType });
    const own = new Set(items.map((item) => item.object_uuid));
    const parentIds = [
      ...new Set(items.map((item) => item.object_data.parent_id ?? '').filter(Boolean)),
    ].filter((uuid) => !own.has(uuid));
    const parents = await Promise.all(parentIds.map((uuid) => limit(() => get(uuid))));
    return [...items, ...parents.filter((p): p is Item => p !== null)];
  }

  async function typeSample(objectType: string): Promise<Item[]> {
    if (readCacheTtlMs === 0) return loadTypeSample(objectType);
    const boxed = await typeSamples.fetch(objectType, {
      context: () => loadTypeSample(objectType),
    });
    return boxed?.value ?? [];
  }

  /** Whether `uuid` is among the ancestors of `parentId` (or is it), walking up. */
  async function isAncestorOf(uuid: string, parentId: string): Promise<boolean> {
    const seen = new Set<string>();
    let current: string | undefined = parentId;
    while (current && !seen.has(current) && seen.size < MAX_ANCESTOR_DEPTH) {
      if (current === uuid) return true;
      seen.add(current);
      current = (await get(current))?.object_data.parent_id ?? undefined;
    }
    return false;
  }

  /** Children count, overall and per known object type. */
  function countChildren(uuid: string): Promise<ChildrenCountsResponse> {
    return counted(`children:${uuid}`, () => scanChildrenCounts(uuid));
  }

  async function scanChildrenCounts(uuid: string): Promise<ChildrenCountsResponse> {
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
  }

  /**
   * Items of a level whose name or UUID contains `q`, case-insensitive, a page of them and
   * their total. The persistence API cannot filter on a piece of name yet (ADR 0021, item 4):
   * the level is read whole, kept `SNAPSHOT_TTL_MS` like the map's listings (the same entry for
   * a body's children), and filtered here. Once persistence filters by name, only this function
   * changes: its contract stays.
   */
  async function searchLevel(
    { page, page_size, ...level }: ListItemsQuery,
    q: string,
  ): Promise<PaginatedItems> {
    const items = await snapshot(
      level.parent_id && !level.object_type && !level.scenename
        ? `children:${level.parent_id}`
        : `level:${JSON.stringify(level)}`,
      () => listAll(level),
    );
    const needle = q.toLowerCase();
    const matches = items.filter((item) => {
      const name = item.object_data.name;
      return (
        item.object_uuid.toLowerCase().includes(needle) ||
        (typeof name === 'string' && name.toLowerCase().includes(needle))
      );
    });
    return {
      items: matches.slice((page - 1) * page_size, page * page_size),
      total: matches.length,
      page,
      page_size,
    };
  }

  async function getOrThrow(uuid: string): Promise<Item> {
    const item = await get(uuid);
    if (!item) throw notFound(`Item ${uuid} not found`);
    return item;
  }

  return {
    /** A page of a level, or of the matches of a search in it (`q`). */
    list({ q, ...query }: ListItemsQuery & { q?: string | undefined }): Promise<PaginatedItems> {
      return q ? searchLevel(query, q) : list(query);
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
    childrenCounts: countChildren,

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
        countCache.clear();
        snapshots.clear();
        typeSamples.clear();
      }
      return created;
    },

    /**
     * Map of a celestial body: its children and the players they house (ADR 0018). Types are
     * loaded within `MAX_MAP_POINTS`: the shown ones first, then the hidden ones, smallest first;
     * a type that does not fit is `omitted` (not drawn) instead of failing the whole map.
     * Counts cover every type, loaded or not.
     */
    /**
     * Map of a body (ADR 0018): one listing of all its children (a few pages, no type filter)
     * and of the items placed through them (players), kept `SNAPSHOT_TTL_MS` and refreshed in
     * the background. Each filtered query is a full scan on persistence: one plain listing
     * costs about as much as four of them, where per-type counts and lists made some forty.
     * Every type is counted; the shown ones are drawn within the point budget (smallest
     * first); `include` keeps one item of a hidden type (the selected one).
     */
    bodyMap(uuid: string, hidden: string[] = [], include?: string): Promise<BodyMapResponse> {
      const hide = [...new Set(hidden)].sort();
      return read(`map:${uuid}:${hide.join(',')}:${include ?? ''}`, async () => {
        const body = await getOrThrow(uuid);
        const [children, placed] = await Promise.all([
          snapshot(`children:${uuid}`, () => listAll({ parent_id: uuid })),
          Promise.all(
            MAP_PLACED_THROUGH_PARENT.map((type) =>
              snapshot(`all:${type}`, () => listAll({ object_type: type })),
            ),
          ),
        ]);
        const counts = countByType(children);
        const placedTypes = MAP_PLACED_THROUGH_PARENT.filter((type) => !hide.includes(type));
        let budget = MAP_PLACED_THROUGH_PARENT.reduce(
          (left, type, i) => left - (placedTypes.includes(type) ? (placed[i]?.length ?? 0) : 0),
          MAX_MAP_POINTS,
        );
        const loaded = new Set<string>();
        const omitted: string[] = [];
        for (const { object_type, total: size } of counts
          .filter((c) => !hide.includes(c.object_type))
          .sort((a, b) => a.total - b.total)) {
          if (size <= budget) {
            loaded.add(object_type);
            budget -= size;
          } else omitted.push(object_type);
        }
        const own = children.filter(
          (item) => loaded.has(item.object_type) || item.object_uuid === include,
        );
        const around = MAP_PLACED_THROUGH_PARENT.flatMap((type, i) =>
          (placed[i] ?? []).filter(
            (item) => placedTypes.includes(type) || item.object_uuid === include,
          ),
        );
        // Every child may place a player, its building drawn or not.
        const { frame, ...map } = buildBodyMap(body, own, around, frames.get(uuid), children);
        if (frame && !frames.has(uuid)) frames.set(uuid, frame);
        // Items placed through a parent (players) are counted where they are placed; hidden,
        // their parents are still known, so they are counted the same way.
        const parents = new Set(children.map((c) => c.object_uuid));
        const placedCounts = MAP_PLACED_THROUGH_PARENT.map((type, i) => ({
          object_type: type,
          total: (placed[i] ?? []).filter((item) => parents.has(item.object_data.parent_id ?? ''))
            .length,
        })).filter((c) => c.total > 0);
        return { ...map, counts: [...counts, ...placedCounts], omitted: omitted.sort() };
      });
    },

    /**
     * Checks an import without writing anything (ADR 0019): format, then coherence with every
     * item on the server (one full scan) and the type definitions.
     */
    async importCheck(items: unknown[]): Promise<ImportCheckResponse> {
      const [{ definitions: defs }, all] = await Promise.all([definitions.list(), scanAll()]);
      const types = defs.map((d) => d.type);
      // Parent aliases (`_planet_SandBox`) designate an item of the server or of the import.
      const own = items.flatMap((item) => {
        const i = item as { object_uuid?: unknown; object_type?: unknown; object_data?: unknown };
        return typeof i?.object_uuid === 'string' &&
          typeof i.object_type === 'string' &&
          i.object_data &&
          typeof i.object_data === 'object'
          ? [
              {
                object_uuid: i.object_uuid,
                object_type: i.object_type,
                object_data: i.object_data as Record<string, unknown>,
              },
            ]
          : [];
      });
      const candidates = [...all, ...own];
      const aliases = resolveParentAliases(items, candidates, types);
      const rows = checkImportCoherence(
        aliases.items,
        checkImportFormat(aliases.items, types),
        buildImportContext(all, defs),
      ).map((row) => {
        const extra = aliases.findings.get(row.index) ?? [];
        const blocking = extra.some((f) => f.severity === 'error');
        return {
          ...row,
          status: blocking ? ('invalid' as const) : row.status,
          findings: [...extra, ...row.findings],
        };
      });
      return { rows, items: aliases.items };
    },

    /**
     * Checks one item of a create or edit form without writing anything (ADR 0022): the
     * import's checks, fed with the item's type, its parent and the items it references
     * instead of a full scan.
     */
    async check({ item, mode, changed }: ItemCheckRequest): Promise<ItemCheckResponse> {
      const [{ definitions: defs }, usage, sample] = await Promise.all([
        definitions.list(),
        scenes.fetch('scenes').then((value) => value ?? []),
        item.object_type ? typeSample(item.object_type) : Promise.resolve([]),
      ]);
      const data = item.object_data;
      const known = new Set(sample.map((i) => i.object_uuid));
      // The parent and every UUID the item holds: references, and UUIDs outside them.
      const wanted = new Set(
        Object.entries(data)
          .filter(([key]) => key !== 'uuid')
          .flatMap(([key, value]) => uuidsIn(value, key).map((ref) => ref.uuid))
          .filter((uuid) => uuid !== item.object_uuid && !known.has(uuid)),
      );
      const others = await Promise.all([...wanted].map((uuid) => limit(() => get(uuid))));
      const context = buildImportContext(
        [...sample, ...others.filter((o): o is Item => o !== null)],
        defs,
      );
      // Partial items: scenes come from the known scenes of the whole server.
      context.scenes = scenesFrom(usage);

      const types = defs.map((d) => d.type);
      const [row] = checkImportCoherence(
        [item],
        checkImportFormat([item], types),
        context,
        mode === 'edit' ? { changed } : {},
      );
      // An edit only reports what it changes: an old dangling reference is not its doing.
      const touched = (f: ImportFinding) => {
        const key = f.path?.match(/^object_data\.([^.[]+)/)?.[1];
        return mode !== 'edit' || !changed || !key || changed.includes(key);
      };
      const findings: ImportFinding[] = (row?.findings ?? []).filter(touched);
      const parent = data.parent_id;
      // Aliases (`_planet_SandBox`) belong to the import: a form gives the parent's UUID.
      if (isParentAlias(parent)) {
        findings.push({ code: 'parentInvalid', severity: 'error', path: 'object_data.parent_id' });
      } else if (
        mode === 'edit' &&
        typeof parent === 'string' &&
        parent !== item.object_uuid &&
        UuidSchema.safeParse(parent).success &&
        (await isAncestorOf(item.object_uuid, parent))
      ) {
        findings.push({
          code: 'parentDescendant',
          severity: 'error',
          path: 'object_data.parent_id',
        });
      }
      return { findings };
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
      countCache.clear();
      snapshots.clear();
      typeSamples.clear();
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
      countCache.clear();
      snapshots.clear();
      typeSamples.clear();
      return updated;
    },

    async remove(uuid: string): Promise<void> {
      await client.remove(uuid);
      reads.clear();
      countCache.clear();
      snapshots.clear();
      typeSamples.clear();
    },
  };
}

export type ItemsService = ReturnType<typeof createItemsService>;
