import { z } from 'zod';
import {
  ErrorCode,
  ItemSchema,
  PaginatedItemsSchema,
  PersistenceErrorSchema,
  type CreateItem,
  type Item,
  type ListItemsQuery,
  type PaginatedItems,
  type ReplaceItem,
} from '@dyingstar-admin/schemas';
import { ApiError } from '../lib/errors';

export interface PersistenceClientOptions {
  baseUrl: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

/** Turns a non-2xx persistence response into an `ApiError`, keeping the service message. */
async function upstreamError(res: Response): Promise<ApiError> {
  const body = PersistenceErrorSchema.safeParse(await res.json().catch(() => null));
  const message = body.success ? body.data.error : `Persistence answered ${res.status}`;
  if (res.status === 400) return new ApiError(400, ErrorCode.upstreamRejected, message);
  if (res.status === 404) return new ApiError(404, ErrorCode.notFound, message);
  return new ApiError(502, ErrorCode.upstreamError, message);
}

/** HTTP client for one persistence service (contract: services/persistence/openapi.yaml). */
export function createPersistenceClient({
  baseUrl,
  timeoutMs,
  fetch: fetchImpl,
}: PersistenceClientOptions) {
  // Resolved per call so a fetch patched later (tests, instrumentation) is honoured.
  const doFetch: typeof fetch = (input, init) => (fetchImpl ?? globalThis.fetch)(input, init);
  const root = baseUrl.replace(/\/$/, '');

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await doFetch(`${root}${path}`, {
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError(
          504,
          ErrorCode.upstreamTimeout,
          `Persistence did not answer in ${timeoutMs} ms`,
        );
      }
      throw new ApiError(502, ErrorCode.upstreamUnreachable, 'Persistence is unreachable');
    }
  }

  async function json<T extends z.ZodType>(res: Response, schema: T): Promise<z.infer<T>> {
    if (!res.ok) throw await upstreamError(res);
    const parsed = schema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(
        502,
        ErrorCode.upstreamError,
        'Persistence returned an unexpected payload',
      );
    }
    return parsed.data;
  }

  return {
    async list(query: ListItemsQuery): Promise<PaginatedItems> {
      const params = new URLSearchParams({
        page: String(query.page),
        page_size: String(query.page_size),
      });
      if (query.object_type !== undefined) params.set('object_type', query.object_type);
      if (query.parent_id !== undefined) params.set('parent_id', query.parent_id);
      if (query.scenename !== undefined) params.set('scenename', query.scenename);
      return json(await call(`/items?${params}`), PaginatedItemsSchema);
    },

    /** Returns null when the item does not exist. */
    async get(uuid: string): Promise<Item | null> {
      const res = await call(`/items/${encodeURIComponent(uuid)}`);
      if (res.status === 404) return null;
      return json(res, ItemSchema);
    },

    /** Upsert on the service side: callers must check existence first (ADR 0004). */
    async create(item: CreateItem): Promise<Item> {
      return json(await call('/items', { method: 'POST', body: JSON.stringify(item) }), ItemSchema);
    },

    /** Full replace; also an upsert on the service side. */
    async replace(uuid: string, item: ReplaceItem): Promise<Item> {
      const res = await call(`/items/${encodeURIComponent(uuid)}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
      return json(res, ItemSchema);
    },

    /** Idempotent: the service answers 204 whether the item existed or not. */
    async remove(uuid: string): Promise<void> {
      const res = await call(`/items/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      if (!res.ok) throw await upstreamError(res);
    },
  };
}

export type PersistenceClient = ReturnType<typeof createPersistenceClient>;
