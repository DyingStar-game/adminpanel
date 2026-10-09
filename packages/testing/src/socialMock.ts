import { http, HttpResponse } from 'msw';
import { ids } from './fixtures';
import type {
  ActivityEntry,
  Corporation,
  CorporationRank,
  CorporationRef,
  PoliticalEntity,
  PoliticalEntityRef,
  PoliticalOffice,
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
  /** Organisations (ADR 0024 step 2): corporations and their ranks, members by rank. */
  corporations: Corporation[];
  ranks: CorporationRank[];
  corporationMembers: {
    corporationId: string;
    playerId: string;
    rankId: number;
    joinedAt: string;
  }[];
  /** Political entities and their offices, members by office. */
  politics: PoliticalEntity[];
  offices: PoliticalOffice[];
  politicalMembers: { entityId: string; playerId: string; officeId: number; joinedAt: string }[];
}

/** Organisation ids of the social fixtures. */
export const organisationIds = {
  /** A holding company, its political home the commune below. */
  mining: '7c0a7e1e-0000-4000-8000-0000000000d4',
  /** Its subsidiary. */
  logistics: '7c0a7e1e-0000-4000-8000-0000000000d6',
  /** A commune of the country below. */
  commune: '7c0a7e1e-0000-4000-8000-0000000000e5',
  country: '7c0a7e1e-0000-4000-8000-0000000000e7',
} as const;

/** A player's corporations and political entities, as their public profile lists them. */
export function membershipsOf(
  data: SocialDataset,
  playerId: string,
): { corporations: CorporationRef[]; politics: PoliticalEntityRef[] } {
  const corporations = data.corporationMembers
    .filter((m) => m.playerId === playerId)
    .flatMap((m) => data.corporations.filter((c) => c.id === m.corporationId))
    .map(({ id, name, ticker }) => ({ id, name, ticker }));
  const politics = data.politicalMembers
    .filter((m) => m.playerId === playerId)
    .flatMap((m) => data.politics.filter((p) => p.id === m.entityId))
    .map(({ id, type, name }) => ({ id, type, name }));
  return { corporations, politics };
}

/**
 * Ends far enough away to stay in force whatever day the tests run (the mute ended on
 * 2026-10-09 10:40 before, and every test reading it failed from then on).
 */
const MUTE_END_MINUTES = 60 * 24 * 365 * 10;

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

const rank = (
  id: number,
  corporationId: string,
  name: string,
  priority: number,
  flags: { isCeo?: boolean; isDefault?: boolean; permissions?: string[] } = {},
): CorporationRank => ({
  id,
  corporationId,
  name,
  priority,
  permissions: flags.permissions ?? [],
  isCeo: flags.isCeo ?? false,
  isDefault: flags.isDefault ?? false,
});

const office = (
  id: number,
  entityId: string,
  name: string,
  priority: number,
  flags: { isHead?: boolean; isDefault?: boolean; permissions?: string[] } = {},
): PoliticalOffice => ({
  id,
  entityId,
  name,
  priority,
  permissions: flags.permissions ?? [],
  isHead: flags.isHead ?? false,
  isDefault: flags.isDefault ?? false,
});

/**
 * Two corporations (a holding and its subsidiary) and two political entities (a commune of a
 * country), with the default ranks and offices `social` creates (`createCorporation`,
 * `createPoliticalEntity`).
 */
function organisations() {
  const { moderator, griefer, reporter } = socialIds;
  const { mining, logistics, commune, country } = organisationIds;
  const corporation = (
    id: string,
    name: string,
    ticker: string,
    ceoId: string,
    links: { parentId?: string; politicalEntityId?: string } = {},
  ): Corporation => ({
    id,
    name,
    ticker,
    logoUrl: null,
    description: null,
    recruitment: 'apply',
    parentId: links.parentId ?? null,
    politicalEntityId: links.politicalEntityId ?? null,
    ceoId,
    createdAt: at(5),
    updatedAt: at(5),
  });
  const entity = (
    id: string,
    type: PoliticalEntity['type'],
    name: string,
    headId: string,
    parentId: string | null = null,
  ): PoliticalEntity => ({
    id,
    type,
    name,
    description: null,
    bannerUrl: null,
    parentId,
    headId,
    createdAt: at(2),
    updatedAt: at(2),
  });
  return {
    corporations: [
      {
        ...corporation(mining, 'Deep Core Mining', 'DCM', griefer, { politicalEntityId: commune }),
        description: 'Ore from the deep shafts of SandBox.',
      },
      corporation(logistics, 'DCM Logistics', 'DCML', moderator, { parentId: mining }),
    ],
    ranks: [
      rank(1, mining, 'CEO', 100, { isCeo: true }),
      rank(2, mining, 'Director', 50, { permissions: ['invite', 'recruit', 'manage_members'] }),
      rank(3, mining, 'Member', 0, { isDefault: true }),
      rank(4, logistics, 'CEO', 100, { isCeo: true }),
      rank(5, logistics, 'Member', 0, { isDefault: true }),
    ],
    corporationMembers: [
      { corporationId: mining, playerId: griefer, rankId: 1, joinedAt: at(5) },
      { corporationId: logistics, playerId: moderator, rankId: 4, joinedAt: at(6) },
    ],
    politics: [
      entity(country, 'country', 'Tarsis Union', moderator),
      entity(commune, 'commune', 'Port Gaea', griefer, country),
    ],
    offices: [
      office(1, country, 'Head of State', 100, { isHead: true }),
      office(2, country, 'Citizen', 0, { isDefault: true }),
      office(3, commune, 'Mayor', 100, { isHead: true }),
      office(4, commune, 'Councilor', 20, { permissions: ['manage_members'] }),
      office(5, commune, 'Citizen', 0, { isDefault: true }),
    ],
    politicalMembers: [
      { entityId: country, playerId: moderator, officeId: 1, joinedAt: at(2) },
      { entityId: commune, playerId: griefer, officeId: 3, joinedAt: at(3) },
      { entityId: commune, playerId: reporter, officeId: 5, joinedAt: at(4) },
    ],
  };
}

/** Ranks `social` gives a new corporation (`createCorporation`), its CEO's first. */
const DEFAULT_RANKS = [
  { name: 'CEO', priority: 100, permissions: [] as string[], isCeo: true, isDefault: false },
  {
    name: 'Director',
    priority: 50,
    permissions: ['invite', 'recruit', 'manage_members'],
    isCeo: false,
    isDefault: false,
  },
  { name: 'Member', priority: 0, permissions: [], isCeo: false, isDefault: true },
];

/** Offices `social` gives a new political entity, by level (`defaultOfficesFor`), head first. */
const DEFAULT_OFFICES: Record<PoliticalEntity['type'], [string, number, string[]][]> = {
  commune: [
    ['Mayor', 100, []],
    ['Deputy', 50, ['manage_members']],
    ['Councilor', 20, []],
    ['Citizen', 0, []],
  ],
  agglomeration: [
    ['President', 100, []],
    ['Vice President', 50, ['manage_members']],
    ['Delegate', 20, []],
    ['Resident', 0, []],
  ],
  department: [
    ['President', 100, []],
    ['Vice President', 50, ['manage_members']],
    ['Departmental Councilor', 20, []],
    ['Resident', 0, []],
  ],
  region: [
    ['President', 100, []],
    ['Vice President', 50, ['manage_members']],
    ['Regional Councilor', 20, []],
    ['Resident', 0, []],
  ],
  country: [
    ['Head of State', 100, []],
    ['Minister', 50, ['manage_members']],
    ['Deputy', 20, []],
    ['Citizen', 0, []],
  ],
  federation: [
    ['President', 100, []],
    ['Representative', 50, ['manage_members']],
    ['Citizen', 0, []],
  ],
};

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
    ...organisations(),
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
        expiresAt: at(35),
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
        expiresAt: at(MUTE_END_MINUTES),
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
        details: { sanctionId: 1, type: 'warning', reason: 'Griefing at the spawn' },
        createdAt: at(35),
      },
      {
        id: 2,
        actorId: moderator,
        action: 'report_dismissed',
        targetPlayerId: reporter,
        details: { reportId: 3, note: 'Retaliation report.' },
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
      {
        id: 2,
        playerId: griefer,
        type: 'friend_added',
        details: { playerId: reporter },
        createdAt: at(10),
      },
      {
        id: 3,
        playerId: griefer,
        type: 'sanction_received',
        details: { sanctionId: 2, type: 'mute', expiresAt: at(MUTE_END_MINUTES) },
        createdAt: at(40),
      },
      {
        id: 4,
        playerId: griefer,
        type: 'corporation_rank_changed',
        details: { corporationId: '7c0a7e1e-0000-4000-8000-0000000000d4', rank: 'Pilot' },
        createdAt: at(42),
      },
      // A type the game records itself (internal route).
      {
        id: 5,
        playerId: griefer,
        type: 'mission_completed',
        details: { missionId: 'm-7' },
        createdAt: at(44),
      },
      // Report 3, as `social` records it for the reporter (`reports.service.ts`).
      {
        id: 6,
        playerId: griefer,
        type: 'report_filed',
        details: { reportId: 3, targetType: 'player', targetId: reporter },
        createdAt: at(46),
      },
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

/** `social`'s defaults (`REPUTATION_REPORT_PENALTY`, `REPUTATION_UPHELD_REPORT_PENALTY`). */
const REPORT_PENALTY = 2;
const UPHELD_REPORT_PENALTY = 10;
const OPEN_STATUSES = new Set<ReportView['status']>(['open', 'reviewing']);
const ESCALATION_LEVELS: ReportView['escalation'][] = ['moderator', 'admin', 'supervisor'];

const conflict = (message: string) =>
  HttpResponse.json({ error: 'CONFLICT', message, status: 409 }, { status: 409 });

const notFound = (message: string) =>
  HttpResponse.json({ error: 'NOT_FOUND', message, status: 404 }, { status: 404 });

/**
 * MSW handlers reproducing `social`'s moderation API (`/api/admin/*`: reading, sanctions,
 * reputation, report actions) and its
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
  const internal = `${baseUrl}/api/internal`;
  const forbidden = (message: string) =>
    HttpResponse.json({ error: 'FORBIDDEN', message, status: 403 }, { status: 403 });
  const players = `${baseUrl}/api/profiles`;
  const seen = (request: Request) => tokens.push(request.headers.get('Authorization'));
  const newestFirst = <T extends { createdAt: string }>(items: T[]) =>
    [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const presenceOf = (playerId: string) => ({
    status: data.presence[playerId] ?? 'offline',
    location: null,
  });
  const corporationSummary = (corporation: Corporation) => ({
    ...corporation,
    memberCount: data.corporationMembers.filter((m) => m.corporationId === corporation.id).length,
  });
  /** Members with their rank and presence, highest rank first (`listCorporationMembers`). */
  const corporationMembers = (corporationId: string) =>
    data.corporationMembers
      .filter((m) => m.corporationId === corporationId)
      .flatMap((m) => {
        const profile = data.players.find((p) => p.playerId === m.playerId);
        const memberRank = data.ranks.find((r) => r.id === m.rankId);
        return profile && memberRank
          ? [{ ...profile, joinedAt: m.joinedAt, rank: memberRank, ...presenceOf(m.playerId) }]
          : [];
      })
      .sort((a, b) => b.rank.priority - a.rank.priority);
  const politicalSummary = (entity: PoliticalEntity) => ({
    ...entity,
    memberCount: data.politicalMembers.filter((m) => m.entityId === entity.id).length,
  });
  /** Members with their office and presence, highest office first (`listPoliticalMembers`). */
  const politicalMembers = (entityId: string) =>
    data.politicalMembers
      .filter((m) => m.entityId === entityId)
      .flatMap((m) => {
        const profile = data.players.find((p) => p.playerId === m.playerId);
        const memberOffice = data.offices.find((o) => o.id === m.officeId);
        return profile && memberOffice
          ? [{ ...profile, joinedAt: m.joinedAt, office: memberOffice, ...presenceOf(m.playerId) }]
          : [];
      })
      .sort((a, b) => b.office.priority - a.office.priority);

  const handlers = [
    http.get(`${api}/stats`, ({ request }) => {
      seen(request);
      const active = data.sanctions.filter(
        (s) => !s.revokedAt && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now()),
      );
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
    // Organisations (ADR 0024 step 2), player routes: directories, pages, members, children.
    http.get(`${baseUrl}/api/corporations`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const items = data.corporations
        .filter((c) => `${c.name} ${c.ticker}`.toLowerCase().includes(search))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(corporationSummary);
      return HttpResponse.json(page(items, url));
    }),
    http.get(`${baseUrl}/api/corporations/:id`, ({ request, params }) => {
      seen(request);
      const corporation = data.corporations.find((c) => c.id === params.id);
      if (!corporation) return notFound(`Corporation ${String(params.id)} not found`);
      const parent = data.corporations.find((c) => c.id === corporation.parentId);
      const subsidiaries = data.corporations.filter((c) => c.parentId === corporation.id);
      const members = corporationMembers(corporation.id);
      return HttpResponse.json({
        ...corporationSummary(corporation),
        ranks: data.ranks
          .filter((r) => r.corporationId === corporation.id)
          .sort((a, b) => b.priority - a.priority),
        members: members.slice(0, 20),
        parent: parent ? { id: parent.id, name: parent.name, ticker: parent.ticker } : null,
        subsidiaries: subsidiaries.slice(0, 20).map(corporationSummary),
        subsidiaryCount: subsidiaries.length,
      });
    }),
    http.get(`${baseUrl}/api/corporations/:id/members`, ({ request, params }) => {
      seen(request);
      if (!data.corporations.some((c) => c.id === params.id)) {
        return notFound(`Corporation ${String(params.id)} not found`);
      }
      return HttpResponse.json(page(corporationMembers(String(params.id)), new URL(request.url)));
    }),
    http.get(`${baseUrl}/api/corporations/:id/subsidiaries`, ({ request, params }) => {
      seen(request);
      if (!data.corporations.some((c) => c.id === params.id)) {
        return notFound(`Corporation ${String(params.id)} not found`);
      }
      const items = data.corporations
        .filter((c) => c.parentId === params.id)
        .map(corporationSummary);
      return HttpResponse.json(page(items, new URL(request.url)));
    }),
    http.get(`${baseUrl}/api/politics`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const type = url.searchParams.get('type');
      const items = data.politics
        .filter((p) => p.name.toLowerCase().includes(search) && (!type || p.type === type))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(politicalSummary);
      return HttpResponse.json(page(items, url));
    }),
    http.get(`${baseUrl}/api/politics/:id`, ({ request, params }) => {
      seen(request);
      const entity = data.politics.find((p) => p.id === params.id);
      if (!entity) return notFound(`Political entity ${String(params.id)} not found`);
      const parent = data.politics.find((p) => p.id === entity.parentId);
      const children = data.politics.filter((p) => p.parentId === entity.id);
      return HttpResponse.json({
        ...politicalSummary(entity),
        offices: data.offices
          .filter((o) => o.entityId === entity.id)
          .sort((a, b) => b.priority - a.priority),
        members: politicalMembers(entity.id).slice(0, 20),
        parent: parent ? { id: parent.id, type: parent.type, name: parent.name } : null,
        children: children.slice(0, 20).map(politicalSummary),
        childCount: children.length,
      });
    }),
    http.get(`${baseUrl}/api/politics/:id/members`, ({ request, params }) => {
      seen(request);
      if (!data.politics.some((p) => p.id === params.id)) {
        return notFound(`Political entity ${String(params.id)} not found`);
      }
      return HttpResponse.json(page(politicalMembers(String(params.id)), new URL(request.url)));
    }),
    http.get(`${baseUrl}/api/politics/:id/children`, ({ request, params }) => {
      seen(request);
      if (!data.politics.some((p) => p.id === params.id)) {
        return notFound(`Political entity ${String(params.id)} not found`);
      }
      const items = data.politics.filter((p) => p.parentId === params.id).map(politicalSummary);
      return HttpResponse.json(page(items, new URL(request.url)));
    }),
    // Organisation management, internal API (ADR 0024 step N): `social` acts as the current CEO
    // or head, with its own rules (`internal.routes.ts`, `corporations.service.ts`,
    // `politics.service.ts`). Service roles are not checked here.
    http.post(`${internal}/corporations`, async ({ request }) => {
      seen(request);
      const body = (await request.json()) as Partial<Corporation> & {
        ceoId: string;
        name: string;
        ticker: string;
      };
      writes.push({ call: 'POST /internal/corporations', body });
      if (!data.players.some((p) => p.playerId === body.ceoId)) {
        return notFound(`Profile ${body.ceoId} not found`);
      }
      const ticker = body.ticker.toUpperCase();
      if (data.corporations.some((c) => c.name === body.name || c.ticker === ticker)) {
        return conflict('Corporation name or ticker already taken');
      }
      if (data.corporationMembers.some((m) => m.playerId === body.ceoId)) {
        return conflict('Already in a corporation');
      }
      const created: Corporation = {
        id: crypto.randomUUID(),
        name: body.name,
        ticker,
        logoUrl: body.logoUrl ?? null,
        description: body.description ?? null,
        recruitment: body.recruitment ?? 'apply',
        parentId: null,
        politicalEntityId: null,
        ceoId: body.ceoId,
        createdAt: now(),
        updatedAt: now(),
      };
      data.corporations.push(created);
      for (const rank of DEFAULT_RANKS) {
        data.ranks.push({ id: nextId(data.ranks), corporationId: created.id, ...rank });
      }
      const ceoRank = data.ranks.find((r) => r.corporationId === created.id && r.isCeo);
      data.corporationMembers.push({
        corporationId: created.id,
        playerId: body.ceoId,
        rankId: ceoRank?.id ?? 0,
        joinedAt: now(),
      });
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(`${internal}/corporations/:id`, async ({ request, params }) => {
      seen(request);
      const body = (await request.json()) as Partial<Corporation>;
      writes.push({ call: `PATCH /internal/corporations/${String(params.id)}`, body });
      const found = data.corporations.find((c) => c.id === params.id);
      if (!found) return notFound(`Corporation ${String(params.id)} not found`);
      const ticker = body.ticker?.toUpperCase();
      if (
        data.corporations.some(
          (c) => c.id !== found.id && (c.name === body.name || (ticker && c.ticker === ticker)),
        )
      ) {
        return conflict('Corporation name or ticker already taken');
      }
      Object.assign(found, body, ticker ? { ticker } : {}, { updatedAt: now() });
      return HttpResponse.json(found);
    }),
    http.delete(`${internal}/corporations/:id`, ({ request, params }) => {
      seen(request);
      writes.push({ call: `DELETE /internal/corporations/${String(params.id)}`, body: null });
      if (!data.corporations.some((c) => c.id === params.id)) {
        return notFound(`Corporation ${String(params.id)} not found`);
      }
      // As the database does: members and ranks go, subsidiaries become independent.
      data.corporations = data.corporations.filter((c) => c.id !== params.id);
      data.ranks = data.ranks.filter((r) => r.corporationId !== params.id);
      data.corporationMembers = data.corporationMembers.filter(
        (m) => m.corporationId !== params.id,
      );
      for (const c of data.corporations) if (c.parentId === params.id) c.parentId = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${internal}/corporations/:id/transfer`, async ({ request, params }) => {
      seen(request);
      const { playerId } = (await request.json()) as { playerId: string };
      writes.push({
        call: `POST /internal/corporations/${String(params.id)}/transfer`,
        body: { playerId },
      });
      const found = data.corporations.find((c) => c.id === params.id);
      if (!found) return notFound(`Corporation ${String(params.id)} not found`);
      if (playerId === found.ceoId) return badRequest('Already the CEO');
      const next = data.corporationMembers.find(
        (m) => m.corporationId === found.id && m.playerId === playerId,
      );
      const former = data.corporationMembers.find(
        (m) => m.corporationId === found.id && m.playerId === found.ceoId,
      );
      if (!next) return notFound(`Player ${playerId} is not a member`);
      const ranks = data.ranks
        .filter((r) => r.corporationId === found.id)
        .sort((a, b) => b.priority - a.priority);
      const ceoRank = ranks.find((r) => r.isCeo);
      // The former CEO takes the highest rank below.
      const below = ranks.find((r) => !r.isCeo);
      if (ceoRank) next.rankId = ceoRank.id;
      if (former && below) former.rankId = below.id;
      Object.assign(found, { ceoId: playerId, updatedAt: now() });
      return HttpResponse.json(found);
    }),
    http.patch(`${internal}/corporations/:id/members/:playerId`, async ({ request, params }) => {
      seen(request);
      const { rankId } = (await request.json()) as { rankId: number };
      const path = `${String(params.id)}/members/${String(params.playerId)}`;
      writes.push({ call: `PATCH /internal/corporations/${path}`, body: { rankId } });
      const found = data.corporations.find((c) => c.id === params.id);
      if (!found) return notFound(`Corporation ${String(params.id)} not found`);
      if (params.playerId === found.ceoId) return forbidden('The CEO rank changes by transfer');
      const rank = data.ranks.find((r) => r.id === rankId && r.corporationId === found.id);
      if (!rank) return notFound(`Rank ${rankId} not found`);
      if (rank.isCeo) return forbidden('The CEO rank changes by transfer');
      const member = data.corporationMembers.find(
        (m) => m.corporationId === found.id && m.playerId === params.playerId,
      );
      if (!member) return notFound(`Player ${String(params.playerId)} is not a member`);
      member.rankId = rank.id;
      const view = corporationMembers(found.id).find((m) => m.playerId === params.playerId);
      return HttpResponse.json(view);
    }),
    http.delete(`${internal}/corporations/:id/members/:playerId`, ({ request, params }) => {
      seen(request);
      const path = `${String(params.id)}/members/${String(params.playerId)}`;
      writes.push({ call: `DELETE /internal/corporations/${path}`, body: null });
      const found = data.corporations.find((c) => c.id === params.id);
      if (!found) return notFound(`Corporation ${String(params.id)} not found`);
      if (params.playerId === found.ceoId) return forbidden('The CEO must transfer first');
      const before = data.corporationMembers.length;
      data.corporationMembers = data.corporationMembers.filter(
        (m) => !(m.corporationId === found.id && m.playerId === params.playerId),
      );
      if (data.corporationMembers.length === before) {
        return notFound(`Player ${String(params.playerId)} is not a member`);
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${internal}/politics`, async ({ request }) => {
      seen(request);
      const body = (await request.json()) as Partial<PoliticalEntity> & {
        headId: string;
        type: PoliticalEntity['type'];
        name: string;
      };
      writes.push({ call: 'POST /internal/politics', body });
      if (!data.players.some((p) => p.playerId === body.headId)) {
        return notFound(`Profile ${body.headId} not found`);
      }
      if (data.politics.some((p) => p.name === body.name)) return conflict('Name already taken');
      const created: PoliticalEntity = {
        id: crypto.randomUUID(),
        type: body.type,
        name: body.name,
        description: body.description ?? null,
        bannerUrl: body.bannerUrl ?? null,
        parentId: null,
        headId: body.headId,
        createdAt: now(),
        updatedAt: now(),
      };
      data.politics.push(created);
      DEFAULT_OFFICES[body.type].forEach(([name, priority, permissions], i, all) => {
        data.offices.push({
          id: nextId(data.offices),
          entityId: created.id,
          name,
          priority,
          permissions,
          isHead: i === 0,
          isDefault: i === all.length - 1,
        });
      });
      const head = data.offices.find((o) => o.entityId === created.id && o.isHead);
      data.politicalMembers.push({
        entityId: created.id,
        playerId: body.headId,
        officeId: head?.id ?? 0,
        joinedAt: now(),
      });
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(`${internal}/politics/:id`, async ({ request, params }) => {
      seen(request);
      const body = (await request.json()) as Partial<PoliticalEntity>;
      writes.push({ call: `PATCH /internal/politics/${String(params.id)}`, body });
      const found = data.politics.find((p) => p.id === params.id);
      if (!found) return notFound(`Political entity ${String(params.id)} not found`);
      if (data.politics.some((p) => p.id !== found.id && p.name === body.name)) {
        return conflict('Name already taken');
      }
      Object.assign(found, body, { updatedAt: now() });
      return HttpResponse.json(found);
    }),
    http.delete(`${internal}/politics/:id`, ({ request, params }) => {
      seen(request);
      writes.push({ call: `DELETE /internal/politics/${String(params.id)}`, body: null });
      if (!data.politics.some((p) => p.id === params.id)) {
        return notFound(`Political entity ${String(params.id)} not found`);
      }
      // As the database does: lower levels and attached corporations become independent.
      data.politics = data.politics.filter((p) => p.id !== params.id);
      data.offices = data.offices.filter((o) => o.entityId !== params.id);
      data.politicalMembers = data.politicalMembers.filter((m) => m.entityId !== params.id);
      for (const p of data.politics) if (p.parentId === params.id) p.parentId = null;
      for (const c of data.corporations) {
        if (c.politicalEntityId === params.id) c.politicalEntityId = null;
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${internal}/politics/:id/transfer`, async ({ request, params }) => {
      seen(request);
      const { playerId } = (await request.json()) as { playerId: string };
      writes.push({
        call: `POST /internal/politics/${String(params.id)}/transfer`,
        body: { playerId },
      });
      const found = data.politics.find((p) => p.id === params.id);
      if (!found) return notFound(`Political entity ${String(params.id)} not found`);
      if (playerId === found.headId) return badRequest('Already the head');
      const next = data.politicalMembers.find(
        (m) => m.entityId === found.id && m.playerId === playerId,
      );
      const former = data.politicalMembers.find(
        (m) => m.entityId === found.id && m.playerId === found.headId,
      );
      if (!next) return notFound(`Player ${playerId} is not a member`);
      const offices = data.offices
        .filter((o) => o.entityId === found.id)
        .sort((a, b) => b.priority - a.priority);
      const head = offices.find((o) => o.isHead);
      const below = offices.find((o) => !o.isHead);
      if (head) next.officeId = head.id;
      if (former && below) former.officeId = below.id;
      Object.assign(found, { headId: playerId, updatedAt: now() });
      return HttpResponse.json(found);
    }),
    // Player route: the caller's own profile, created on the first call (`getMe`). The mock does
    // not read tokens: the caller is the fixtures' moderator, as for the writes.
    http.get(`${baseUrl}/api/me`, ({ request }) => {
      seen(request);
      let profile = data.players.find((p) => p.playerId === actor);
      if (!profile) {
        profile = { ...player(actor, 'dev-moderator', 0), createdAt: now(), updatedAt: now() };
        data.players.push(profile);
      }
      return HttpResponse.json({
        ...profile,
        presence: { status: data.presence[actor] ?? 'offline', location: null, updatedAt: now() },
        ...membershipsOf(data, actor),
        group: null,
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
        ...membershipsOf(data, id),
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
        // As `social` does: a warning is a record, never in force (it expires at once).
        expiresAt:
          body.type === 'warning'
            ? now()
            : body.durationHours
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
        details: { sanctionId: sanction.id, type: body.type, reason: body.reason },
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
    // Report actions (`updateReportStatus`, `escalateReport`), as `reports.service.ts` does them.
    http.patch(`${api}/reports/:id`, async ({ request, params }) => {
      seen(request);
      const body = (await request.json()) as {
        status: 'reviewing' | 'resolved' | 'dismissed';
        note?: string;
      };
      writes.push({ call: `PATCH /reports/${String(params.id)}`, body });
      const report = data.reports.find((r) => r.id === Number(params.id));
      if (!report) return notFound(`Report ${String(params.id)} not found`);
      if (!OPEN_STATUSES.has(report.status)) return conflict(`Report is ${report.status}`);
      const closing = body.status !== 'reviewing';
      Object.assign(report, {
        status: body.status,
        resolvedBy: closing ? actor : null,
        resolutionNote: body.note ?? null,
        resolvedAt: closing ? now() : null,
      });
      data.log.push({
        id: nextId(data.log),
        actorId: actor,
        action: `report_${body.status}`,
        targetPlayerId: report.targetPlayerId,
        details: { reportId: report.id, note: body.note },
        createdAt: now(),
      });
      // Upheld: the target loses more; dismissed: the filing penalty is refunded.
      const delta =
        body.status === 'resolved'
          ? -UPHELD_REPORT_PENALTY
          : body.status === 'dismissed'
            ? REPORT_PENALTY
            : 0;
      const target = data.players.find((p) => p.playerId === report.targetPlayerId);
      if (target && report.reporterId && delta !== 0) {
        target.reputation += delta;
        data.reputationEvents.push({
          id: nextId(data.reputationEvents),
          playerId: target.playerId,
          delta,
          balance: target.reputation,
          source: 'moderation',
          reason:
            body.status === 'resolved' ? `Report upheld: ${report.reason}` : 'Report dismissed',
          actorId: actor,
          details: { reportId: report.id },
          createdAt: now(),
        });
      }
      if (report.reporterId && closing) {
        data.activity.push({
          id: nextId(data.activity),
          playerId: report.reporterId,
          type: `report_${body.status}`,
          details: { reportId: report.id },
          createdAt: now(),
        });
      }
      return HttpResponse.json(report);
    }),
    http.post(`${api}/reports/:id/escalate`, ({ request, params }) => {
      seen(request);
      writes.push({ call: `POST /reports/${String(params.id)}/escalate`, body: null });
      const report = data.reports.find((r) => r.id === Number(params.id));
      if (!report) return notFound(`Report ${String(params.id)} not found`);
      if (!OPEN_STATUSES.has(report.status)) return conflict(`Report is ${report.status}`);
      const level = ESCALATION_LEVELS.indexOf(report.escalation);
      // As `social` does (its OpenAPI lists a 409): the top level is a 403.
      const next = ESCALATION_LEVELS[level + 1];
      if (!next) {
        return HttpResponse.json(
          { error: 'FORBIDDEN', message: 'Report already at the highest level', status: 403 },
          { status: 403 },
        );
      }
      Object.assign(report, { escalation: next, status: 'open' });
      data.log.push({
        id: nextId(data.log),
        actorId: actor,
        action: 'report_escalated',
        targetPlayerId: report.targetPlayerId,
        details: { reportId: report.id, to: next },
        createdAt: now(),
      });
      return HttpResponse.json(report);
    }),
    http.get(`${api}/sanctions`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      const active = (url.searchParams.get('active') ?? 'true') === 'true';
      const items = data.sanctions.filter(
        (s) =>
          (!playerId || s.playerId === playerId) &&
          (active ? !s.revokedAt && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now()) : true),
      );
      return HttpResponse.json(page(newestFirst(items), url));
    }),
  ];

  return { handlers, data, tokens, writes };
}
