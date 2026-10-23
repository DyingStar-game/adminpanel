import { http, HttpResponse } from 'msw';
import type {
  MissionAssignment,
  MissionAsServed,
  MissionObjective,
} from '@dyingstar-admin/contracts/mission';
import { poiIds } from './inventoryMock';
import { organisationIds, socialIds } from './socialMock';
import { simulationIds } from './universesimulatorMock';

/** Base URL used by tests for the mocked `mission` service (ADR 0024). */
export const MISSION_URL = 'http://mission.test';

export interface MissionDataset {
  missions: MissionAsServed[];
  objectives: MissionObjective[];
  assignments: MissionAssignment[];
  /** What `social` answers for an assignee: display names by player id (NPCs have none). */
  playerNames: Record<string, string>;
  /** `social`'s groups, names by id. */
  groups: Record<string, string>;
}

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 9, 10, 9, 0) + minutes * 60_000).toISOString();

/** Mission ids of the fixtures. */
export const missionIds = {
  /** The game's delivery, open to all, in one system. */
  delivery: '3a55105e-0000-4000-8000-000000000001',
  /** A corporation's transport, paid from its treasury, for its members. */
  transport: '3a55105e-0000-4000-8000-000000000002',
  /** A finished scenario. */
  scenario: '3a55105e-0000-4000-8000-000000000003',
  /** Shared with a group: only its members see it in game. */
  grouped: '3a55105e-0000-4000-8000-000000000004',
  /** A player's mission, cancelled and refunded. */
  cancelled: '3a55105e-0000-4000-8000-000000000005',
  /**
   * Published by `universesimulator` for the water order's second leg (its mock's
   * `waterMission`), escrowed on ARES's treasury: cancelled through its order (ADR 0028).
   */
  simulation: simulationIds.waterMission,
} as const;

/** The water order's second leg (`universesimulatorMock` › `leg`: order id's end, then seq). */
const waterLegId = 'a7e50000-0000-4000-8000-000000000b12';

/** A group of `social` none of the fixtures' staff belongs to. */
export const missionGroupId = '9e0a7e1e-0000-4000-8000-0000000000f1';

/** An NPC that took the delivery: `social` knows no name for it. */
export const missionNpcId = '7c0a7e1e-0000-4000-8000-0000000000c1';

/** A mission row with `mission`'s column defaults (`db/schema/missions.ts`). */
const mission = (
  fields: Partial<MissionAsServed> & Pick<MissionAsServed, 'id' | 'title' | 'createdAt'>,
): MissionAsServed => ({
  description: null,
  kind: 'dynamic',
  category: 'divers',
  issuerType: 'system',
  issuerId: null,
  status: 'available',
  rewards: null,
  prerequisites: [],
  visibility: 'public',
  groupId: null,
  groupClaimable: false,
  isEvent: false,
  zones: [],
  maxAssignees: 1,
  escrowStatus: 'none',
  escrowAmount: null,
  escrowCurrency: null,
  escrowPayerId: null,
  escrowPayerType: 'player',
  escrowItemStatus: 'none',
  escrowItemHoldIds: null,
  scriptId: null,
  expiresAt: null,
  autoComplete: true,
  allowPartial: false,
  requiresMissionIds: [],
  assignmentDeadlineHours: null,
  createdBy: 'svc-game',
  updatedAt: fields.createdAt,
  ...fields,
});

/** An objective row with its column defaults (`db/schema/missions.ts` › `missionObjectives`). */
const objective = (
  missionId: string,
  n: number,
  fields: Partial<MissionObjective> & Pick<MissionObjective, 'type' | 'title'>,
): MissionObjective => ({
  id: `${missionId.slice(0, -4)}b0${String(n).padStart(2, '0')}`,
  missionId,
  description: null,
  targetQuantity: 1,
  unit: null,
  locationFrom: null,
  locationTo: null,
  order: 0,
  weight: 1,
  isBonus: false,
  bonusReward: null,
  status: 'pending',
  currentProgress: 0,
  params: null,
  payload: null,
  state: null,
  createdAt: at(n),
  updatedAt: at(n),
  ...fields,
});

/** An assignment row with its column defaults (`db/schema/assignments.ts`). */
const assignment = (
  missionId: string,
  n: number,
  playerId: string,
  fields: Partial<MissionAssignment> & Pick<MissionAssignment, 'acceptedAt'>,
): MissionAssignment => ({
  id: `${missionId.slice(0, -4)}c0${String(n).padStart(2, '0')}`,
  missionId,
  playerId,
  holderType: 'player',
  status: 'active',
  deadlineAt: null,
  completedAt: null,
  rewardShares: null,
  rewardAmount: null,
  completionRatio: 0,
  rewardSettled: false,
  rewardSettledAt: null,
  createdAt: fields.acceptedAt,
  updatedAt: fields.acceptedAt,
  ...fields,
});

/**
 * Missions of every kind and status the panel shows, issued by the social fixtures' players and
 * organisations (same ids), shaped as `mission`'s code stores them (`missions.service.ts`), with
 * their objectives and who took them.
 */
export function createMissionDataset(): MissionDataset {
  const { delivery, transport, scenario, grouped, cancelled, simulation } = missionIds;
  return {
    missions: [
      mission({
        id: delivery,
        title: 'Iron ore for New Haven',
        description: 'The foundry runs short: bring ore to its loading bay.',
        category: 'delivery',
        rewards: [
          { type: 'credits', currency: 'credits', amount: 1_500 },
          { type: 'standing', domain: 'delivery', amount: 5 },
        ],
        zones: [{ kind: 'system', system: 'tarsis' }],
        maxAssignees: 3,
        status: 'active',
        allowPartial: true,
        assignmentDeadlineHours: 48,
        requiresMissionIds: [scenario],
        expiresAt: at(7 * 24 * 60),
        createdAt: at(50),
      }),
      mission({
        id: transport,
        title: 'Escort the drill parts',
        kind: 'player',
        category: 'transport',
        issuerType: 'corporation',
        issuerId: organisationIds.mining,
        visibility: 'corporation',
        rewards: [
          { type: 'credits', currency: 'credits', amount: 4_000 },
          { type: 'item', itemId: 'drill_bit', quantity: 2 },
        ],
        prerequisites: [
          { kind: 'min_standing', params: { domain: 'transport', min: 20 } },
          { kind: 'min_reputation', params: { min: 10 } },
        ],
        escrowStatus: 'held',
        escrowAmount: 4_000,
        escrowCurrency: 'credits',
        escrowPayerId: organisationIds.mining,
        escrowPayerType: 'corporation',
        escrowItemStatus: 'held',
        escrowItemHoldIds: ['hold-1'],
        createdBy: socialIds.reporter,
        createdAt: at(40),
      }),
      mission({
        id: scenario,
        title: 'The first survey',
        kind: 'scenario',
        category: 'exploration',
        status: 'completed',
        scriptId: 'tutorial.survey',
        rewards: [{ type: 'credits', currency: 'credits', amount: 250 }],
        createdAt: at(10),
        updatedAt: at(30),
      }),
      mission({
        id: grouped,
        title: 'Clear the relay station',
        groupId: missionGroupId,
        groupClaimable: true,
        maxAssignees: 4,
        createdAt: at(30),
      }),
      // Created before PR #37 cut the categories to five: the row keeps `trading`.
      mission({
        id: cancelled,
        title: 'Buy my spare battery',
        kind: 'player',
        category: 'trading',
        issuerType: 'player',
        issuerId: socialIds.griefer,
        status: 'cancelled',
        rewards: [{ type: 'credits', currency: 'credits', amount: 300 }],
        escrowStatus: 'refunded',
        escrowAmount: 300,
        escrowCurrency: 'credits',
        escrowPayerId: socialIds.griefer,
        createdBy: socialIds.griefer,
        createdAt: at(20),
      }),
      // As `universesimulator`'s publisher builds it (`src/simulation/publisher.rs` ›
      // `build_mission`), second attempt of its leg; its objective in the shape `mission`'s
      // `transport` kind takes.
      mission({
        id: simulation,
        title: 'Transport 600 l Water → M0002',
        description: 'Supply order of ARES (auto_shortage).',
        category: 'transport',
        issuerType: 'politics',
        issuerId: simulationIds.ares,
        rewards: [{ type: 'credits', currency: 'credits', amount: 1_640 }],
        escrowStatus: 'held',
        escrowAmount: 1_640,
        escrowCurrency: 'credits',
        escrowPayerId: simulationIds.ares,
        escrowPayerType: 'politics',
        scriptId: `usim:leg:${waterLegId}:1`,
        createdBy: 'svc-universesimulator',
        createdAt: at(5),
      }),
    ],
    objectives: [
      objective(simulation, 1, {
        type: 'transport',
        title: 'Deliver 600 l of Water from F0001 to M0002',
        targetQuantity: 600,
        unit: 'l',
        params: {
          goodType: 'water',
          source: { kind: 'poi', poiId: poiIds.depot },
          zone: { kind: 'poi', poiId: poiIds.drillSite },
        },
        payload: {
          source: 'universesimulator',
          orderId: simulationIds.waterOrder,
          legId: waterLegId,
          seq: 2,
          resource: 'water',
        },
      }),
      objective(delivery, 1, {
        type: 'deliver_material',
        title: 'Deliver 10 t of iron ore',
        targetQuantity: 10,
        unit: 't',
        params: {
          goodType: 'iron_ore',
          zone: { kind: 'poi', poiId: poiIds.foundryBay },
          scope: 'all',
        },
        status: 'in_progress',
        currentProgress: 6,
      }),
      objective(delivery, 2, {
        type: 'visit',
        title: 'Report to the foreman',
        // A POI `inventory` no longer holds.
        params: { zone: { kind: 'poi', poiId: poiIds.missing } },
        isBonus: true,
        bonusReward: { type: 'credits', currency: 'credits', amount: 200 },
      }),
      objective(transport, 1, {
        type: 'transport',
        title: 'Bring the parts to the drill site',
        targetQuantity: 4,
        unit: 'crates',
        params: {
          goodType: 'drill_parts',
          source: { kind: 'poi', poiId: poiIds.depot },
          zone: { kind: 'poi', poiId: poiIds.drillSite },
        },
        status: 'in_progress',
        // Latched by `transport`'s first phase (`kinds/objectives/transport.ts`).
        state: { pickedUpAt: at(70) },
      }),
      objective(transport, 2, {
        type: 'owns_items',
        title: 'Keep a spare drill bit',
        order: 1,
        params: { itemId: 'drill_bit', scope: 'total' },
      }),
      objective(scenario, 1, {
        type: 'visit',
        title: 'Reach the crater rim',
        params: { zone: { kind: 'poi', poiId: poiIds.craterRim } },
        status: 'completed',
        currentProgress: 1,
      }),
      objective(scenario, 2, {
        type: 'manual',
        title: 'Report to the surveyor',
        order: 1,
        weight: 2,
        status: 'completed',
        currentProgress: 1,
      }),
      objective(grouped, 1, {
        type: 'visit',
        title: 'Enter the relay station',
        params: { zone: { kind: 'poi', poiId: poiIds.relayStation } },
      }),
      objective(grouped, 2, {
        type: 'transport_passenger',
        title: 'Bring the technician',
        order: 1,
        params: {
          passengerId: socialIds.reporter,
          zone: { kind: 'poi', poiId: poiIds.relayStation },
        },
      }),
      objective(cancelled, 1, { type: 'manual', title: 'Hand over a battery' }),
    ],
    assignments: [
      assignment(delivery, 1, socialIds.reporter, {
        acceptedAt: at(60),
        deadlineAt: at(60 + 48 * 60),
      }),
      assignment(delivery, 2, socialIds.griefer, {
        status: 'partially_completed',
        acceptedAt: at(55),
        deadlineAt: at(55 + 48 * 60),
        completedAt: at(90),
        completionRatio: 6000,
        rewardShares: [{ type: 'credits', currency: 'credits', amount: 900 }],
        rewardAmount: 900,
        rewardSettled: true,
        rewardSettledAt: at(91),
      }),
      assignment(delivery, 3, missionNpcId, {
        holderType: 'npc',
        status: 'abandoned',
        acceptedAt: at(52),
      }),
      assignment(scenario, 1, socialIds.reporter, {
        status: 'completed',
        acceptedAt: at(12),
        completedAt: at(30),
        completionRatio: 10_000,
        rewardShares: [{ type: 'credits', currency: 'credits', amount: 250 }],
        rewardAmount: 250,
        rewardSettled: true,
        rewardSettledAt: at(30),
      }),
    ],
    playerNames: { [socialIds.reporter]: 'ddurieux', [socialIds.griefer]: 'griefer42' },
    groups: { [missionGroupId]: 'Relay strike team' },
  };
}

export interface MissionMock {
  handlers: ReturnType<typeof http.get>[];
  data: MissionDataset;
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
  /** Writes received (`POST /missions/:id/cancel`), oldest first. */
  writes: string[];
}

const STATUSES = ['available', 'active', 'completed', 'cancelled', 'expired'];
const KINDS = ['dynamic', 'scenario', 'player'];
const CATEGORIES = ['delivery', 'transport', 'mining', 'exploration', 'divers'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Weighted progress of the required objectives, in basis points (`requiredProgressBp`). */
function requiredProgressBp(objectives: MissionObjective[]): number {
  const required = objectives.filter((o) => !o.isBonus);
  const totalWeight = required.reduce((sum, o) => sum + Math.max(o.weight, 0), 0);
  if (totalWeight === 0) return 0;
  const done = required.reduce((sum, o) => {
    const progress = Math.min(Math.max(o.currentProgress, 0), o.targetQuantity);
    return sum + (Math.max(o.weight, 0) * progress) / o.targetQuantity;
  }, 0);
  return Math.min(10_000, Math.max(0, Math.round((done / totalWeight) * 10_000)));
}

/**
 * MSW handlers reproducing the part of `mission` the panel uses, from its code
 * (`internal.routes.ts`, `missions.service.ts`, `detail.service.ts`, `lib/pagination.ts`): the
 * internal catalogue, any status, newest first, `limit` 1–100; a mission's detail, whatever its
 * visibility, with names from `social`; a mission's cancel (`cancelMission`: refused once
 * completed, its active assignments abandoned, its escrow refunded). Tokens are recorded, not
 * checked.
 */
export function createMissionMock(
  data: MissionDataset = createMissionDataset(),
  baseUrl: string = MISSION_URL,
): MissionMock {
  const tokens: (string | null)[] = [];
  const writes: string[] = [];
  const failure = (status: number, error: string, message: string) =>
    HttpResponse.json({ error, message, status }, { status });
  /** Express's `validate(…, 'query')` with the route's zod schema. */
  const invalid = (query: URLSearchParams): string | null => {
    const limit = Number(query.get('limit') ?? 20);
    const offset = Number(query.get('offset') ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return 'limit: Invalid value';
    if (!Number.isInteger(offset) || offset < 0) return 'offset: Invalid value';
    const enums: [string, string[]][] = [
      ['status', STATUSES],
      ['kind', KINDS],
      ['category', CATEGORIES],
    ];
    for (const [key, values] of enums) {
      const value = query.get(key);
      if (value !== null && !values.includes(value)) return `${key}: Invalid option`;
    }
    return null;
  };

  const handlers = [
    http.get(`${baseUrl}/api/internal/missions`, ({ request }) => {
      tokens.push(request.headers.get('Authorization'));
      const query = new URL(request.url).searchParams;
      const error = invalid(query);
      if (error) return failure(400, 'VALIDATION_ERROR', error);
      const limit = Number(query.get('limit') ?? 20);
      const offset = Number(query.get('offset') ?? 0);
      const found = data.missions
        .filter((m) =>
          (['status', 'kind', 'category'] as const).every(
            (key) => query.get(key) === null || m[key] === query.get(key),
          ),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return HttpResponse.json({
        missions: found.slice(offset, offset + limit),
        total: found.length,
        limit,
        offset,
      });
    }),
    http.get(`${baseUrl}/api/internal/missions/:missionId`, ({ request, params }) => {
      tokens.push(request.headers.get('Authorization'));
      const id = String(params.missionId);
      if (!UUID.test(id)) return failure(400, 'VALIDATION_ERROR', 'missionId: Invalid UUID');
      const found = data.missions.find((m) => m.id === id);
      if (!found) return failure(404, 'NOT_FOUND', 'Mission not found');
      const objectives = data.objectives
        .filter((o) => o.missionId === id)
        .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
      const assignments = data.assignments.filter((a) => a.missionId === id);
      const count = (status: MissionAssignment['status']) =>
        assignments.filter((a) => a.status === status).length;
      return HttpResponse.json({
        mission: found,
        objectives,
        assignments,
        players: Object.fromEntries(
          assignments.flatMap((a) => {
            const name = data.playerNames[a.playerId];
            return name ? [[a.playerId, name]] : [];
          }),
        ),
        group:
          found.groupId && data.groups[found.groupId]
            ? { id: found.groupId, name: data.groups[found.groupId] }
            : null,
        chain: found.requiresMissionIds.map((required) => {
          const row = data.missions.find((m) => m.id === required);
          return { id: required, title: row?.title ?? '', status: row?.status ?? 'unknown' };
        }),
        summary: {
          assignments: assignments.length,
          active: count('active'),
          completed: count('completed'),
          partial: count('partially_completed'),
          abandoned: count('abandoned'),
          expired: count('expired'),
          progressBp: requiredProgressBp(objectives),
        },
      });
    }),
    http.post(`${baseUrl}/api/internal/missions/:missionId/cancel`, ({ request, params }) => {
      tokens.push(request.headers.get('Authorization'));
      const id = String(params.missionId);
      if (!UUID.test(id)) return failure(400, 'VALIDATION_ERROR', 'missionId: Invalid UUID');
      writes.push(`cancel ${id}`);
      const found = data.missions.find((m) => m.id === id);
      if (!found) return failure(404, 'NOT_FOUND', 'Mission not found');
      if (found.status === 'completed') {
        return failure(409, 'MISSION_COMPLETED', 'A completed mission cannot be cancelled');
      }
      const now = new Date().toISOString();
      Object.assign(found, { status: 'cancelled', updatedAt: now });
      for (const a of data.assignments) {
        if (a.missionId === id && a.status === 'active') {
          Object.assign(a, { status: 'abandoned', updatedAt: now });
        }
      }
      // `refundEscrow`: what is held goes back to its payer.
      if (found.escrowStatus === 'held') found.escrowStatus = 'refunded';
      if (found.escrowItemStatus === 'held') {
        Object.assign(found, { escrowItemStatus: 'released', escrowItemHoldIds: null });
      }
      return HttpResponse.json(found);
    }),
  ];

  return { handlers, data, tokens, writes };
}
