import { z } from 'zod';
import { Permission } from '@dyingstar-admin/schemas';
import {
  zAdjustReputationResponse,
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
  zInternalRecordActivityResponse,
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
  type InternalRecordActivityData,
  type InternalUpdateCorporationData,
  type InternalUpdatePoliticalEntityData,
  type IssueSanctionData,
  type UpdateReportStatusData,
} from '@dyingstar-admin/contracts/social';
import type { ServiceTokenSource } from '../auth/serviceToken';
import type { Session } from '../auth/auth';
import { createUpstream, type Query } from './upstream';

/**
 * `POST /api/internal/players/:playerId/notifications` (`social:notify:write`): in `social`'s
 * code (`routes/internal.routes.ts`, `routes/schemas.ts` › `notificationBody`,
 * `services/notifications.service.ts`, read 2026-10-31 at `develop` `7106778`) but neither in its
 * README nor its OpenAPI (`docs/back-team-questions.md`): written from the code, as ADR 0024
 * allows. A live push to the player's MQTT channel when they are online, nothing stored.
 */
export const zNotifyPlayerBody = z.object({
  type: z.string().trim().min(1).max(64),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(500).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type NotifyPlayerBody = z.infer<typeof zNotifyPlayerBody>;

/** Its answer: an offline player is not an error (`delivered: false, reason: 'offline'`). */
export const zNotifyPlayerResponse = z.object({
  delivered: z.boolean(),
  reason: z.string().optional(),
});
export type NotifyPlayerResponse = z.infer<typeof zNotifyPlayerResponse>;

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

/**
 * HTTP client for `social` (contract pinned in `@dyingstar-admin/contracts/social`): its
 * moderation API (`/api/admin/*`) and the player routes the panel reads (profiles). Every call
 * carries the signed-in user's token: `social` checks their role and records them as the actor.
 */
export function createSocialClient({ baseUrl, timeoutMs, serviceToken }: SocialClientOptions) {
  const {
    call,
    get,
    internal: internalCall,
    hasServiceToken,
  } = createUpstream({
    name: 'Social',
    baseUrl,
    timeoutMs,
    serviceToken,
  });

  const corporation = (id: string) => `/corporations/${encodeURIComponent(id)}`;
  const politics = (id: string) => `/politics/${encodeURIComponent(id)}`;

  /** One write to the internal API, as `svc-admin`. */
  const internal = <T extends z.ZodType>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    schema: T,
    body?: unknown,
  ) => internalCall(method, path, schema, body === undefined ? {} : { body });

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
    // A player told something by the panel (ADR 0032), as `svc-admin` too.
    /** Live, when they are online (`social:notify:write`). */
    notifyPlayer: (playerId: string, body: NotifyPlayerBody) =>
      internal(
        'POST',
        `/players/${encodeURIComponent(playerId)}/notifications`,
        zNotifyPlayerResponse,
        zNotifyPlayerBody.parse(body),
      ),
    /** In their activity history (`social:player:write`); `social` answers 204. */
    recordActivity: (playerId: string, body: InternalRecordActivityData['body']) =>
      internal(
        'POST',
        `/players/${encodeURIComponent(playerId)}/activity`,
        zInternalRecordActivityResponse,
        body,
      ),
    /** Whether organisation management is configured (`svc-admin`'s secret). */
    manages: hasServiceToken,
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
