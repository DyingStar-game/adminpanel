import type { z } from 'zod';
import { ErrorCode } from '@dyingstar-admin/schemas';
import {
  zAdjustReputationResponse,
  zError,
  zGetCommunityStatsResponse,
  zGetModerationLogResponse,
  zGetPlayerRecordResponse,
  zGetProfileResponse,
  zGetReportResponse,
  zIssueSanctionResponse,
  zListReportsResponse,
  zListSanctionsResponse,
  zRevokeSanctionResponse,
  zSearchProfilesResponse,
  type AdjustReputationData,
  type IssueSanctionData,
} from '@dyingstar-admin/contracts/social';
import { ApiError } from '../lib/errors';

export interface SocialClientOptions {
  /** `social`'s base URL, without `/api` (e.g. `http://service-social:3000`). */
  baseUrl: string;
  timeoutMs: number;
}

type Query = Record<string, string | number | boolean | null | undefined>;

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
  if (res.status === 409) return new ApiError(409, ErrorCode.editConflict, message);
  if (res.status === 401) {
    return new ApiError(502, ErrorCode.upstreamRejected, `Social refused the session: ${message}`);
  }
  return new ApiError(502, ErrorCode.upstreamError, message);
}

/**
 * HTTP client for `social` (contract pinned in `@dyingstar-admin/contracts/social`): its
 * moderation API (`/api/admin/*`) and the player routes the panel reads (profiles). Every call
 * carries the signed-in user's token: `social` checks their role and records them as the actor.
 */
export function createSocialClient({ baseUrl, timeoutMs }: SocialClientOptions) {
  const root = `${baseUrl.replace(/\/$/, '')}/api`;

  /** One call to `social`: the user's token, a JSON body when given, the answer validated. */
  async function call<T extends z.ZodType>(
    method: 'GET' | 'POST' | 'DELETE',
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

  const get = <T extends z.ZodType>(
    token: string | undefined,
    path: string,
    schema: T,
    query: Query = {},
  ) => call('GET', token, path, schema, { query });

  return {
    stats: (token?: string) => get(token, '/admin/stats', zGetCommunityStatsResponse),
    log: (token: string | undefined, query: Query) =>
      get(token, '/admin/log', zGetModerationLogResponse, query),
    reports: (token: string | undefined, query: Query) =>
      get(token, '/admin/reports', zListReportsResponse, query),
    report: (token: string | undefined, id: number) =>
      get(token, `/admin/reports/${id}`, zGetReportResponse),
    player: (token: string | undefined, playerId: string) =>
      get(token, `/admin/players/${encodeURIComponent(playerId)}`, zGetPlayerRecordResponse),
    sanctions: (token: string | undefined, query: Query) =>
      get(token, '/admin/sanctions', zListSanctionsResponse, query),
    /** Public profile: presence, corporations, political entities (a player route). */
    profile: (token: string | undefined, playerId: string) =>
      get(token, `/profiles/${encodeURIComponent(playerId)}`, zGetProfileResponse),
    /** Sanctions a player; `social` checks the role (`suspension` / `ban`: `admin`). */
    issueSanction: (token: string | undefined, playerId: string, body: IssueSanctionData['body']) =>
      call(
        'POST',
        token,
        `/admin/players/${encodeURIComponent(playerId)}/sanctions`,
        zIssueSanctionResponse,
        {
          body,
        },
      ),
    /** Lifts a sanction; `social` answers 404 when it is already lifted (its OpenAPI says 409). */
    revokeSanction: (token: string | undefined, id: number) =>
      call('DELETE', token, `/admin/sanctions/${id}`, zRevokeSanctionResponse),
    /** Adds `delta` to a player's reputation (`admin`). */
    adjustReputation: (
      token: string | undefined,
      playerId: string,
      body: AdjustReputationData['body'],
    ) =>
      call(
        'POST',
        token,
        `/admin/players/${encodeURIComponent(playerId)}/reputation`,
        zAdjustReputationResponse,
        {
          body,
        },
      ),
    /** Profiles by display name (a player route: `social` has no admin listing, ADR 0024). */
    profiles: (token: string | undefined, query: Query) =>
      get(token, '/profiles', zSearchProfilesResponse, query),
  };
}

export type SocialClient = ReturnType<typeof createSocialClient>;
