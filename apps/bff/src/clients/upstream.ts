import { z } from 'zod';
import { ErrorCode } from '@dyingstar-admin/schemas';
import type { ServiceTokenSource } from '../auth/serviceToken';
import { ApiError } from '../lib/errors';

export type Query = Record<string, string | number | boolean | null | undefined>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UpstreamOptions {
  /** The service's name in messages, e.g. `Social`. */
  name: string;
  /** Its base URL, without `/api`. */
  baseUrl: string;
  timeoutMs: number;
  /**
   * Tokens of `svc-admin`, for its internal API (`/api/internal/*`), which takes service accounts
   * only (ADR 0023). Unset, internal calls answer 404.
   */
  serviceToken?: ServiceTokenSource | undefined;
}

/** The error body the game services share: `{ error, message, status }`. */
const ErrorBodySchema = z.object({ message: z.string() });

/**
 * The calls every game service client shares (ADR 0024): timeouts, the service's refusals
 * turned into `ApiError` (a 403 is its own role check, shown as such; a 401 means it did not
 * accept a token the panel holds as valid), answers validated with the pinned contract.
 */
export function createUpstream({ name, baseUrl, timeoutMs, serviceToken }: UpstreamOptions) {
  const root = `${baseUrl.replace(/\/$/, '')}/api`;

  async function upstreamError(res: Response): Promise<ApiError> {
    const body = ErrorBodySchema.safeParse(await res.json().catch(() => null));
    const message = body.success ? body.data.message : `${name} answered ${res.status}`;
    if (res.status === 400) return new ApiError(400, ErrorCode.upstreamRejected, message);
    if (res.status === 403) return new ApiError(403, ErrorCode.forbidden, message);
    if (res.status === 404) return new ApiError(404, ErrorCode.notFound, message);
    if (res.status === 409) return new ApiError(409, ErrorCode.editConflict, message);
    if (res.status === 401) {
      return new ApiError(
        502,
        ErrorCode.upstreamRejected,
        `${name} refused the session: ${message}`,
      );
    }
    return new ApiError(502, ErrorCode.upstreamError, message);
  }

  /** One call: the given token, a JSON body when given, the answer validated. */
  async function call<T extends z.ZodType>(
    method: Method,
    token: string | undefined,
    path: string,
    schema: T,
    { query = {}, body }: { query?: Query; body?: unknown } = {},
  ): Promise<z.infer<T>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
    let res: Response;
    try {
      res = await fetch(`${root}${path}${params.size ? `?${params}` : ''}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError(
          504,
          ErrorCode.upstreamTimeout,
          `${name} did not answer in ${timeoutMs} ms`,
        );
      }
      throw new ApiError(502, ErrorCode.upstreamUnreachable, `${name} is unreachable`);
    }
    if (!res.ok) throw await upstreamError(res);
    const payload = res.status === 204 ? undefined : await res.json().catch(() => null);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(502, ErrorCode.upstreamError, `${name} returned an unexpected payload`);
    }
    return parsed.data;
  }

  /** A GET with the user's token. */
  const get = <T extends z.ZodType>(
    token: string | undefined,
    path: string,
    schema: T,
    query: Query = {},
  ) => call('GET', token, path, schema, { query });

  /** One call to the internal API, with a `svc-admin` token instead of the user's. */
  async function internal<T extends z.ZodType>(
    method: Method,
    path: string,
    schema: T,
    { query, body }: { query?: Query; body?: unknown } = {},
  ): Promise<z.infer<T>> {
    if (!serviceToken) {
      throw new ApiError(404, ErrorCode.notFound, `${name}'s internal API is not configured`);
    }
    let token: string;
    try {
      token = await serviceToken();
    } catch (error) {
      console.error('svc-admin token:', error);
      throw new ApiError(
        502,
        ErrorCode.upstreamUnreachable,
        'Keycloak refused the svc-admin token',
      );
    }
    return call(method, token, `/internal${path}`, schema, {
      ...(query ? { query } : {}),
      ...(body === undefined ? {} : { body }),
    });
  }

  return { call, get, internal, hasServiceToken: serviceToken !== undefined };
}
