import type { z } from 'zod';
import { ApiErrorSchema, SERVER_HEADER, type ApiErrorBody } from '@dyingstar-admin/schemas';

/** Error raised for non-2xx BFF responses, carrying the HTTP status and parsed body. */
export class ApiError extends Error {
  /** Error code of the BFF body (`ALREADY_EXISTS`, `EDIT_CONFLICT`…), when it has one. */
  readonly code: string | null;
  readonly details: unknown;

  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const parsed = ApiErrorSchema.safeParse(body);
    super(parsed.success ? parsed.data.message : `BFF request failed with status ${status}`);
    this.code = parsed.success ? parsed.data.error : null;
    this.details = parsed.success ? parsed.data.details : undefined;
  }

  /** The BFF error body, when the response carried one. */
  get apiBody(): ApiErrorBody | null {
    const parsed = ApiErrorSchema.safeParse(this.body);
    return parsed.success ? parsed.data : null;
  }
}

export interface ApiOptions {
  /** Target game server, sent as `X-Server-Id` (required by item routes). */
  serverId?: string | null | undefined;
}

async function request(
  method: string,
  path: string,
  { serverId }: ApiOptions,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path, window.location.origin);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (serverId) headers[SERVER_HEADER] = serverId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

/** Fetches a BFF endpoint and validates the JSON response against a Zod schema. */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  options: ApiOptions = {},
): Promise<z.infer<T>> {
  return schema.parse(await request('GET', path, options));
}

/** Sends a write to the BFF; validates the response when a schema is given (none for 204). */
export async function apiSend<T extends z.ZodType>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  { body, schema, ...options }: ApiOptions & { body?: unknown; schema?: T },
): Promise<z.infer<T> | null> {
  const payload = await request(method, path, options, body);
  return schema ? schema.parse(payload) : null;
}
