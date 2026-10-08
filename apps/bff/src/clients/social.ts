import type { z } from 'zod';
import { ErrorCode, Permission } from '@dyingstar-admin/schemas';
import {
  zAdjustReputationResponse,
  zError,
  zEscalateReportResponse,
  zGetCommunityStatsResponse,
  zInternalCreateCorporationResponse,
  zInternalCreatePoliticalEntityResponse,
  zInternalDisbandCorporationResponse,
  zInternalDisbandPoliticalEntityResponse,
  zInternalRemoveCorporationMemberResponse,
  zInternalSetCorporationMemberRankResponse,
  zInternalTransferCorporationCeoResponse,
  zInternalTransferPoliticalHeadResponse,
  zInternalUpdateCorporationResponse,
  zInternalUpdatePoliticalEntityResponse,
  zGetCorporationResponse,
  zGetMeResponse,
  zGetModerationLogResponse,
  zGetPlayerRecordResponse,
  zGetPoliticalEntityResponse,
  zGetProfileResponse,
  zGetReportResponse,
  zIssueSanctionResponse,
  zListCorporationMembersResponse,
  zListCorporationsResponse,
  zListPoliticalChildrenResponse,
  zListPoliticalEntitiesResponse,
  zListPoliticalMembersResponse,
  zListReportsResponse,
  zListSubsidiariesResponse,
  zListSanctionsResponse,
  zRevokeSanctionResponse,
  zSearchProfilesResponse,
  zUpdateReportStatusResponse,
  type AdjustReputationData,
  type InternalCreateCorporationData,
  type InternalCreatePoliticalEntityData,
  type InternalUpdateCorporationData,
  type InternalUpdatePoliticalEntityData,
  type IssueSanctionData,
  type UpdateReportStatusData,
} from '@dyingstar-admin/contracts/social';
import type { ServiceTokenSource } from '../auth/serviceToken';
import type { Session } from '../auth/auth';
import { ApiError } from '../lib/errors';

export interface SocialClientOptions {
  /** `social`'s base URL, without `/api` (e.g. `http://service-social:3000`). */
  baseUrl: string;
  timeoutMs: number;
  /**
   * Tokens of `svc-admin`, for the internal API (`/api/internal/*`), which takes service
   * accounts only (ADR 0023 › Social — management). Unset, organisation management is off.
   */
  serviceToken?: ServiceTokenSource | undefined;
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
export function createSocialClient({ baseUrl, timeoutMs, serviceToken }: SocialClientOptions) {
  const root = `${baseUrl.replace(/\/$/, '')}/api`;

  /** One call to `social`: the user's token, a JSON body when given, the answer validated. */
  async function call<T extends z.ZodType>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
    const payload = res.status === 204 ? undefined : await res.json().catch(() => null);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(502, ErrorCode.upstreamError, 'Social returned an unexpected payload');
    }
    return parsed.data;
  }

  const corporation = (id: string) => `/corporations/${encodeURIComponent(id)}`;
  const politics = (id: string) => `/politics/${encodeURIComponent(id)}`;

  /** One call to the internal API, with a `svc-admin` token instead of the user's. */
  async function internal<T extends z.ZodType>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    schema: T,
    body?: unknown,
  ): Promise<z.infer<T>> {
    if (!serviceToken) {
      throw new ApiError(404, ErrorCode.notFound, 'Organisation management is not configured');
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
    return call(method, token, `/internal${path}`, schema, body === undefined ? {} : { body });
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
    /**
     * Moves an open report on (`reviewing`, `resolved`, `dismissed`) with an optional note;
     * `social` answers 409 once it is closed.
     */
    updateReportStatus: (
      token: string | undefined,
      id: number,
      body: UpdateReportStatusData['body'],
    ) => call('PATCH', token, `/admin/reports/${id}`, zUpdateReportStatusResponse, { body }),
    /**
     * Escalates an open report one level (moderator → admin → supervisor), back to `open`;
     * `social` answers 403 at the top level (its OpenAPI says 409), 409 once it is closed.
     */
    escalateReport: (token: string | undefined, id: number) =>
      call('POST', token, `/admin/reports/${id}/escalate`, zEscalateReportResponse),
    /** The user's own profile, which `social` creates on the first call (a player route). */
    me: (token: string | undefined) => get(token, '/me', zGetMeResponse),
    // Organisations (ADR 0024 step 2): player routes any signed-in player may read; the panel's
    // `social.moderate` is what restricts them. Their activity is for members only: not read.
    corporations: (token: string | undefined, query: Query) =>
      get(token, '/corporations', zListCorporationsResponse, query),
    /** A corporation with its ranks, first members, parent and first subsidiaries. */
    corporation: (token: string | undefined, id: string) =>
      get(token, `/corporations/${encodeURIComponent(id)}`, zGetCorporationResponse),
    corporationMembers: (token: string | undefined, id: string, query: Query) =>
      get(
        token,
        `/corporations/${encodeURIComponent(id)}/members`,
        zListCorporationMembersResponse,
        query,
      ),
    subsidiaries: (token: string | undefined, id: string, query: Query) =>
      get(
        token,
        `/corporations/${encodeURIComponent(id)}/subsidiaries`,
        zListSubsidiariesResponse,
        query,
      ),
    politics: (token: string | undefined, query: Query) =>
      get(token, '/politics', zListPoliticalEntitiesResponse, query),
    /** A political entity with its offices, first members, parent and first children. */
    politicalEntity: (token: string | undefined, id: string) =>
      get(token, `/politics/${encodeURIComponent(id)}`, zGetPoliticalEntityResponse),
    politicalMembers: (token: string | undefined, id: string, query: Query) =>
      get(
        token,
        `/politics/${encodeURIComponent(id)}/members`,
        zListPoliticalMembersResponse,
        query,
      ),
    politicalChildren: (token: string | undefined, id: string, query: Query) =>
      get(
        token,
        `/politics/${encodeURIComponent(id)}/children`,
        zListPoliticalChildrenResponse,
        query,
      ),
    /** Profiles by display name (a player route: `social` has no admin listing, ADR 0024). */
    profiles: (token: string | undefined, query: Query) =>
      get(token, '/profiles', zSearchProfilesResponse, query),

    // Organisation management (ADR 0024 step N): the internal API, as `svc-admin`. `social`
    // acts as the current CEO or head, with their rules; the panel checks who may ask.
    createCorporation: (body: InternalCreateCorporationData['body']) =>
      internal('POST', '/corporations', zInternalCreateCorporationResponse, body),
    updateCorporation: (id: string, body: InternalUpdateCorporationData['body']) =>
      internal('PATCH', corporation(id), zInternalUpdateCorporationResponse, body),
    disbandCorporation: (id: string) =>
      internal('DELETE', corporation(id), zInternalDisbandCorporationResponse),
    /** Gives the CEO to a member; the former CEO takes the highest rank below. */
    transferCorporation: (id: string, playerId: string) =>
      internal('POST', `${corporation(id)}/transfer`, zInternalTransferCorporationCeoResponse, {
        playerId,
      }),
    setMemberRank: (id: string, playerId: string, rankId: number) =>
      internal(
        'PATCH',
        `${corporation(id)}/members/${encodeURIComponent(playerId)}`,
        zInternalSetCorporationMemberRankResponse,
        { rankId },
      ),
    removeMember: (id: string, playerId: string) =>
      internal(
        'DELETE',
        `${corporation(id)}/members/${encodeURIComponent(playerId)}`,
        zInternalRemoveCorporationMemberResponse,
      ),
    createPoliticalEntity: (body: InternalCreatePoliticalEntityData['body']) =>
      internal('POST', '/politics', zInternalCreatePoliticalEntityResponse, body),
    updatePoliticalEntity: (id: string, body: InternalUpdatePoliticalEntityData['body']) =>
      internal('PATCH', politics(id), zInternalUpdatePoliticalEntityResponse, body),
    disbandPoliticalEntity: (id: string) =>
      internal('DELETE', politics(id), zInternalDisbandPoliticalEntityResponse),
    /** Gives the head office to a member. */
    transferPoliticalEntity: (id: string, playerId: string) =>
      internal('POST', `${politics(id)}/transfer`, zInternalTransferPoliticalHeadResponse, {
        playerId,
      }),
    /** Whether organisation management is configured (`svc-admin`'s secret). */
    manages: serviceToken !== undefined,
  };
}

export type SocialClient = ReturnType<typeof createSocialClient>;

/**
 * Sign-in hook registering staff accounts in `social` (ADR 0024 › Update 2026-10-08): it refuses
 * the reputation changes of an author without a profile, and creates the profile on the
 * account's first `GET /api/me` only.
 */
export const registerStaffInSocial = (social: SocialClient) => async (session: Session) => {
  if (session.permissions.includes(Permission.socialModerate)) {
    await social.me(session.tokens.accessToken);
  }
};
