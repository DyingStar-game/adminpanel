import { http, HttpResponse } from 'msw';
import { ids } from './fixtures';
import type {
  ActivityEntry,
  CorporationRef,
  PoliticalEntityRef,
  PresenceStatus,
  ModerationLogEntry,
  PlayerProfile,
  ReportView,
  ReputationEvent,
  Sanction,
} from '@dyingstar-admin/contracts/social';

/** Base URL used by tests for the mocked `social` service (ADR 0024). */
export const SOCIAL_URL = 'http://social.test';

/**
 * Player ids of the social fixtures. A player's Keycloak id is also their `player` item's UUID
 * in persistence (back team, 2026-10-08): the reporter is the persistence fixtures' player.
 */
export const socialIds = {
  moderator: '5b1d3c1e-0000-4000-8000-0000000000a1',
  griefer: '5b1d3c1e-0000-4000-8000-0000000000b2',
  reporter: ids.player,
} as const;

export interface SocialDataset {
  players: PlayerProfile[];
  reports: ReportView[];
  sanctions: Sanction[];
  log: ModerationLogEntry[];
  reputationEvents: ReputationEvent[];
  activity: ActivityEntry[];
  /** Public profile extras (`GET /api/profiles/{id}`), by player id; offline and none by default. */
  presence: Record<string, PresenceStatus>;
  memberships: Record<string, { corporations: CorporationRef[]; politics: PoliticalEntityRef[] }>;
}

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 9, 8, 10, 0) + minutes * 60_000).toISOString();

const player = (playerId: string, displayName: string, reputation: number): PlayerProfile => ({
  playerId,
  entityType: 'player',
  displayName,
  avatarUrl: null,
  faction: null,
  biography: null,
  role: null,
  reputation,
  playtimeSeconds: 3600,
  rpSheet: null,
  createdAt: at(0),
  updatedAt: at(0),
});

/** A small moderation picture: one griefer reported twice, warned, then muted. */
export function createSocialDataset(): SocialDataset {
  const { moderator, griefer, reporter } = socialIds;
  return {
    players: [
      player(moderator, 'dev-moderator', 0),
      {
        ...player(griefer, 'griefer42', -27),
        faction: 'Free miners',
        role: 'Pilot',
        biography: 'Hauls ore between SandBox and its moons.',
        rpSheet: {
          characterName: 'Grif',
          alignment: 'chaotic',
          story: 'Left the guild after a duel.',
        },
        updatedAt: at(20),
      },
      player(reporter, 'ddurieux', 3),
    ],
    presence: { [griefer]: 'online' },
    memberships: {
      [griefer]: {
        corporations: [
          { id: '7c0a7e1e-0000-4000-8000-0000000000d4', name: 'Deep Core Mining', ticker: 'DCM' },
        ],
        politics: [
          { id: '7c0a7e1e-0000-4000-8000-0000000000e5', type: 'commune', name: 'Port Gaea' },
        ],
      },
    },
    reports: [
      {
        id: 1,
        reporterId: reporter,
        targetType: 'player',
        targetPlayerId: griefer,
        targetCorporationId: null,
        reason: 'griefing',
        message: 'Blew up my truck at the spawn.',
        status: 'open',
        escalation: 'moderator',
        resolvedBy: null,
        resolutionNote: null,
        resolvedAt: null,
        createdAt: at(30),
        reporterName: 'ddurieux',
        targetName: 'griefer42',
      },
      {
        id: 2,
        reporterId: null,
        targetType: 'player',
        targetPlayerId: griefer,
        targetCorporationId: null,
        reason: 'reputation_threshold',
        message: null,
        status: 'reviewing',
        escalation: 'admin',
        resolvedBy: null,
        resolutionNote: null,
        resolvedAt: null,
        createdAt: at(40),
        reporterName: null,
        targetName: 'griefer42',
      },
      {
        id: 3,
        reporterId: griefer,
        targetType: 'player',
        targetPlayerId: reporter,
        targetCorporationId: null,
        reason: 'harassment',
        message: 'He keeps reporting me.',
        status: 'dismissed',
        escalation: 'moderator',
        resolvedBy: moderator,
        resolutionNote: 'Retaliation report.',
        resolvedAt: at(50),
        createdAt: at(45),
        reporterName: 'griefer42',
        targetName: 'ddurieux',
      },
    ],
    sanctions: [
      {
        id: 1,
        playerId: griefer,
        type: 'warning',
        reason: 'Griefing at the spawn',
        automatic: false,
        issuedBy: moderator,
        expiresAt: null,
        revokedAt: null,
        revokedBy: null,
        createdAt: at(35),
      },
      {
        id: 2,
        playerId: griefer,
        type: 'mute',
        reason: 'Reputation below -25',
        automatic: true,
        issuedBy: null,
        expiresAt: at(60 * 24 + 40),
        revokedAt: null,
        revokedBy: null,
        createdAt: at(40),
      },
    ],
    log: [
      {
        id: 1,
        actorId: moderator,
        action: 'sanction_issued',
        targetPlayerId: griefer,
        details: { type: 'warning' },
        createdAt: at(35),
      },
      {
        id: 2,
        actorId: moderator,
        action: 'report_dismissed',
        targetPlayerId: reporter,
        details: { reportId: 3 },
        createdAt: at(50),
      },
    ],
    reputationEvents: [
      {
        id: 1,
        playerId: griefer,
        delta: -25,
        balance: -27,
        source: 'report',
        reason: 'Upheld report',
        actorId: moderator,
        details: null,
        createdAt: at(36),
      },
    ],
    activity: [
      { id: 1, playerId: griefer, type: 'profile_created', details: null, createdAt: at(0) },
    ],
  };
}

export interface SocialMock {
  handlers: ReturnType<typeof http.get>[];
  /** Writes received (sanctions, lifts, reputation), newest last: `METHOD path` and body. */
  writes: { call: string; body: unknown }[];
  data: SocialDataset;
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
}

const page = <T>(items: T[], url: URL) => {
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
};

const notFound = (message: string) =>
  HttpResponse.json({ error: 'NOT_FOUND', message, status: 404 }, { status: 404 });

/**
 * MSW handlers reproducing `social`'s moderation API (`/api/admin/*`, read routes) and its
 * profile search: filters,
 * limit / offset pages, `{ error, message, status }` bodies. Roles are not checked here.
 */
export function createSocialMock(
  data: SocialDataset = createSocialDataset(),
  baseUrl: string = SOCIAL_URL,
): SocialMock {
  const tokens: (string | null)[] = [];
  const writes: { call: string; body: unknown }[] = [];
  // Actor of the writes: the fixtures' moderator (the mock does not read tokens).
  const actor = socialIds.moderator;
  const now = () => new Date().toISOString();
  const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1;
  const badRequest = (message: string) =>
    HttpResponse.json({ error: 'VALIDATION_ERROR', message, status: 400 }, { status: 400 });
  const api = `${baseUrl}/api/admin`;
  const players = `${baseUrl}/api/profiles`;
  const seen = (request: Request) => tokens.push(request.headers.get('Authorization'));
  const newestFirst = <T extends { createdAt: string }>(items: T[]) =>
    [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handlers = [
    http.get(`${api}/stats`, ({ request }) => {
      seen(request);
      const active = data.sanctions.filter((s) => !s.revokedAt);
      const reports: Record<string, number> = {};
      for (const r of data.reports) reports[r.status] = (reports[r.status] ?? 0) + 1;
      return HttpResponse.json({
        players: { total: data.players.length, online: 0 },
        corporations: { total: 0, top: [] },
        reports,
        sanctions: { active: active.length },
        activityLast24h: data.activity.length,
        mostReported: [{ playerId: socialIds.griefer, reports: 2 }],
        lowestReputation: [...data.players]
          .sort((a, b) => a.reputation - b.reputation)
          .slice(0, 5)
          .map(({ playerId, displayName, reputation }) => ({ playerId, displayName, reputation })),
      });
    }),
    http.get(`${api}/log`, ({ request }) => {
      seen(request);
      return HttpResponse.json(page(newestFirst(data.log), new URL(request.url)));
    }),
    http.get(`${api}/reports`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const escalation = url.searchParams.get('escalation');
      const target = url.searchParams.get('targetPlayerId');
      const items = data.reports.filter(
        (r) =>
          (!status || r.status === status) &&
          (!escalation || r.escalation === escalation) &&
          (!target || r.targetPlayerId === target),
      );
      return HttpResponse.json(page(newestFirst(items), url));
    }),
    http.get(`${api}/reports/:id`, ({ request, params }) => {
      seen(request);
      const report = data.reports.find((r) => r.id === Number(params.id));
      return report ? HttpResponse.json(report) : notFound(`Report ${String(params.id)} not found`);
    }),
    http.get(`${api}/players/:playerId`, ({ request, params }) => {
      seen(request);
      const id = String(params.playerId);
      const profile = data.players.find((p) => p.playerId === id);
      if (!profile) return notFound(`Player ${id} not found`);
      return HttpResponse.json({
        ...profile,
        reputationEvents: data.reputationEvents.filter((e) => e.playerId === id),
        sanctions: data.sanctions.filter((s) => s.playerId === id),
        reports: data.reports.filter((r) => r.targetPlayerId === id),
        activity: data.activity.filter((a) => a.playerId === id),
      });
    }),
    // Player route: the public profile, with presence and memberships (`getProfile`).
    http.get(`${players}/:playerId`, ({ request, params }) => {
      seen(request);
      const id = String(params.playerId);
      const profile = data.players.find((p) => p.playerId === id);
      if (!profile) return notFound(`Profile ${id} not found`);
      return HttpResponse.json({
        ...profile,
        status: data.presence[id] ?? 'offline',
        corporations: data.memberships[id]?.corporations ?? [],
        politics: data.memberships[id]?.politics ?? [],
      });
    }),
    // Player route: profiles by display name, sorted by name (`searchProfiles`).
    http.get(players, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const kind = url.searchParams.get('entityType');
      const items = data.players
        .filter(
          (p) => p.displayName.toLowerCase().includes(search) && (!kind || p.entityType === kind),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      return HttpResponse.json(page(items, url));
    }),
    // Acting on players (`issueSanction`, `revokeSanction`, `adjustReputation`).
    http.post(`${api}/players/:playerId/sanctions`, async ({ request, params }) => {
      seen(request);
      const id = String(params.playerId);
      const body = (await request.json()) as {
        type: Sanction['type'];
        reason: string;
        durationHours?: number | null;
      };
      writes.push({ call: `POST /players/${id}/sanctions`, body });
      const profile = data.players.find((p) => p.playerId === id);
      if (!profile) return notFound(`Player ${id} not found`);
      if (profile.entityType === 'npc') return badRequest('NPCs cannot be sanctioned');
      const sanction: Sanction = {
        id: nextId(data.sanctions),
        playerId: id,
        type: body.type,
        reason: body.reason,
        automatic: false,
        issuedBy: actor,
        expiresAt: body.durationHours
          ? new Date(Date.now() + body.durationHours * 3_600_000).toISOString()
          : null,
        revokedAt: null,
        revokedBy: null,
        createdAt: now(),
      };
      data.sanctions.push(sanction);
      data.log.push({
        id: nextId(data.log),
        actorId: actor,
        action: 'sanction_issued',
        targetPlayerId: id,
        details: { type: body.type },
        createdAt: now(),
      });
      return HttpResponse.json(sanction, { status: 201 });
    }),
    http.delete(`${api}/sanctions/:id`, ({ request, params }) => {
      seen(request);
      writes.push({ call: `DELETE /sanctions/${String(params.id)}`, body: null });
      const sanction = data.sanctions.find((s) => s.id === Number(params.id));
      if (!sanction) return notFound(`Sanction ${String(params.id)} not found`);
      // As `social` does (its OpenAPI lists a 409): an already lifted sanction is not found.
      if (sanction.revokedAt) return notFound(`Sanction ${String(params.id)} not found`);
      sanction.revokedAt = now();
      sanction.revokedBy = actor;
      data.log.push({
        id: nextId(data.log),
        actorId: actor,
        action: 'sanction_revoked',
        targetPlayerId: sanction.playerId,
        details: { sanctionId: sanction.id, type: sanction.type },
        createdAt: now(),
      });
      return HttpResponse.json(sanction);
    }),
    http.post(`${api}/players/:playerId/reputation`, async ({ request, params }) => {
      seen(request);
      const id = String(params.playerId);
      const body = (await request.json()) as { delta: number; reason: string };
      writes.push({ call: `POST /players/${id}/reputation`, body });
      const profile = data.players.find((p) => p.playerId === id);
      if (!profile) return notFound(`Player ${id} not found`);
      profile.reputation += body.delta;
      data.reputationEvents.push({
        id: nextId(data.reputationEvents),
        playerId: id,
        delta: body.delta,
        balance: profile.reputation,
        source: 'moderation',
        reason: body.reason,
        actorId: actor,
        details: null,
        createdAt: now(),
      });
      return HttpResponse.json({ playerId: id, reputation: profile.reputation });
    }),
    http.get(`${api}/sanctions`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      const active = (url.searchParams.get('active') ?? 'true') === 'true';
      const items = data.sanctions.filter(
        (s) => (!playerId || s.playerId === playerId) && (active ? !s.revokedAt : true),
      );
      return HttpResponse.json(page(newestFirst(items), url));
    }),
  ];

  return { handlers, data, tokens, writes };
}
