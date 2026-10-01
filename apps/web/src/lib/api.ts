import type { z } from 'zod';
import { SERVER_HEADER } from '@dyingstar-admin/schemas';

/** Error raised for non-2xx BFF responses, carrying the HTTP status and parsed body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`BFF request failed with status ${status}`);
  }
}

export interface ApiOptions {
  /** Target game server, sent as `X-Server-Id` (required by item routes). */
  serverId?: string | null | undefined;
}

/** Fetches a BFF endpoint and validates the JSON response against a Zod schema. */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  { serverId }: ApiOptions = {},
): Promise<z.infer<T>> {
  const url = new URL(path, window.location.origin);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (serverId) headers[SERVER_HEADER] = serverId;
  const res = await fetch(url, { headers });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return schema.parse(body);
}
