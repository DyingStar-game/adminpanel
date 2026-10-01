import type { z } from 'zod';

/** Error raised for non-2xx BFF responses, carrying the HTTP status and parsed body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`BFF request failed with status ${status}`);
  }
}

/** Fetches a BFF endpoint and validates the JSON response against a Zod schema. */
export async function apiGet<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const url = new URL(path, window.location.origin);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return schema.parse(body);
}
