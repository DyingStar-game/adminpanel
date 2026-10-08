import type { z } from 'zod';
import { ErrorCode } from '@dyingstar-admin/schemas';
import {
  zError,
  zGetCommunityStatsResponse,
  zGetModerationLogResponse,
  zGetPlayerRecordResponse,
  zGetReportResponse,
  zListReportsResponse,
  zListSanctionsResponse,
} from '@dyingstar-admin/contracts/social';
import { ApiError } from '../lib/errors';

export interface SocialClientOptions {
  /** `social`'s base URL, without `/api` (e.g. `http://service-social:3000`). */
  baseUrl: string;
  timeoutMs: number;
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * Turns a refusal of `social` into an `ApiError`, keeping its message. A 403 is its own role
 * check (ADR 0024): shown as such. A 401 means it did not accept a token the panel holds as valid
 * (misconfiguration), reported as an upstream error.
 */
async function upstreamError(res: Response): Promise<ApiError> {
  const body = zError.safeParse(await res.json().catch(() => null));
  const message = body.success ? body.data.message : `Social answered ${res.status}`;
  if (res.status === 400) return new ApiError(400, ErrorCode.upstreamRejected, message);
  if (res.status === 403) return new ApiError(403, ErrorCode.forbidden, message);
  if (res.status === 404) return new ApiError(404, ErrorCode.notFound, message);
  if (res.status === 401) {
    return new ApiError(502, ErrorCode.upstreamRejected, `Social refused the session: ${message}`);
  }
  return new ApiError(502, ErrorCode.upstreamError, message);
}

/**
 * HTTP client for `social`'s moderation API (`/api/admin/*`, contract pinned in
 * `@dyingstar-admin/contracts/social`). Every call carries the signed-in user's token: `social`
 * checks their moderation role and records them as the actor.
 */
export function createSocialClient({ baseUrl, timeoutMs }: SocialClientOptions) {
  const root = `${baseUrl.replace(/\/$/, '')}/api/admin`;

  async function get<T extends z.ZodType>(
    token: string | undefined,
    path: string,
    schema: T,
    query: Query = {},
  ): Promise<z.infer<T>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    let res: Response;
    try {
      res = await fetch(`${root}${path}${params.size ? `?${params}` : ''}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError(
          504,
          ErrorCode.upstreamTimeout,
          `Social did not answer in ${timeoutMs} ms`,
        );
      }
      throw new ApiError(502, ErrorCode.upstreamUnreachable, 'Social is unreachable');
    }
    if (!res.ok) throw await upstreamError(res);
    const parsed = schema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(502, ErrorCode.upstreamError, 'Social returned an unexpected payload');
    }
    return parsed.data;
  }

  return {
    stats: (token?: string) => get(token, '/stats', zGetCommunityStatsResponse),
    log: (token: string | undefined, query: Query) =>
      get(token, '/log', zGetModerationLogResponse, query),
    reports: (token: string | undefined, query: Query) =>
      get(token, '/reports', zListReportsResponse, query),
    report: (token: string | undefined, id: number) =>
      get(token, `/reports/${id}`, zGetReportResponse),
    player: (token: string | undefined, playerId: string) =>
      get(token, `/players/${encodeURIComponent(playerId)}`, zGetPlayerRecordResponse),
    sanctions: (token: string | undefined, query: Query) =>
      get(token, '/sanctions', zListSanctionsResponse, query),
  };
}

export type SocialClient = ReturnType<typeof createSocialClient>;
