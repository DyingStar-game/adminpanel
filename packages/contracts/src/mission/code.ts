import { z } from 'zod';
import { zPoi } from '../inventory/code';
import {
  zAssigneeHolderType,
  zAssignmentStatus,
  zCreateMission,
  zCreateObjective,
  zEscrowStatus,
  zGetApiInternalMissionsQuery,
  zIssuerType,
  zMission,
  zMissionKind,
  zMissionStatus,
  zMissionVisibility,
  zMissionZone,
  zObjectiveStatus,
  zPrerequisite,
  zRewardComponent,
} from './generated/zod.gen';

/**
 * Where `mission`'s code differs from its OpenAPI (`db/schema/`, `routes/`, `services/`, read
 * 2026-10-23 at `develop`, `5725d56` merged by PR #37): the panel follows the code (ADR 0024). Hand-written,
 * kept apart from the generated files.
 *
 * Its OpenAPI lists no `required` fields: the generated schemas make every field optional. The
 * rows are served as the database holds them, every column present.
 */

/** Ids owned by other services (`social`'s organisations and groups, players): any UUID. */
const zOpaqueId = z.guid();
const zTimestamp = z.iso.datetime({ offset: true });
const zJsonObject = z.record(z.string(), z.unknown());

/** A mission row (`db/schema/missions.ts` › `missions`), as the catalogue and detail serve it. */
export const zMissionAsServed = zMission.extend({
  id: z.guid(),
  title: z.string(),
  description: z.string().nullable(),
  kind: zMissionKind,
  /**
   * A text column checked against the categories at creation only: PR #37 cut them to five
   * (`divers` replaces `generic`) without migrating the rows, which keep the old ones.
   */
  category: z.string(),
  issuerType: zIssuerType,
  issuerId: zOpaqueId.nullable(),
  status: zMissionStatus,
  rewards: z.array(zRewardComponent).nullable(),
  prerequisites: z.array(zPrerequisite),
  visibility: zMissionVisibility,
  groupId: zOpaqueId.nullable(),
  groupClaimable: z.boolean(),
  isEvent: z.boolean(),
  zones: z.array(zMissionZone),
  maxAssignees: z.int(),
  escrowStatus: zEscrowStatus,
  escrowAmount: z.int().nullable(),
  escrowCurrency: z.string().nullable(),
  escrowPayerId: zOpaqueId.nullable(),
  escrowPayerType: z.enum(['player', 'corporation', 'politics']),
  escrowItemStatus: z.enum(['none', 'held', 'claimed', 'released']),
  escrowItemHoldIds: z.array(z.string()).nullable(),
  scriptId: z.string().nullable(),
  expiresAt: zTimestamp.nullable(),
  autoComplete: z.boolean(),
  allowPartial: z.boolean(),
  requiresMissionIds: z.array(zOpaqueId),
  assignmentDeadlineHours: z.int().nullable(),
  /** The creating service's Keycloak client id, or the player's id. */
  createdBy: z.string().nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type MissionAsServed = z.infer<typeof zMissionAsServed>;
export type MissionReward = z.infer<typeof zRewardComponent>;

/** The internal catalogue's page (`GET /api/internal/missions`), every status. */
export const zMissionCatalogue = z.object({
  missions: z.array(zMissionAsServed),
  total: z.int().gte(0),
  limit: z.int(),
  offset: z.int(),
});
export type MissionCatalogue = z.infer<typeof zMissionCatalogue>;

/**
 * The catalogue's filters the panel offers, and its page. `mission`'s code takes more
 * (`groupId`, `groupClaimable`, `isEvent`) than its OpenAPI lists.
 */
export const zMissionCatalogueQuery = zGetApiInternalMissionsQuery.pick({
  status: true,
  kind: true,
  category: true,
  limit: true,
  offset: true,
});
export type MissionCatalogueQuery = z.infer<typeof zMissionCatalogueQuery>;

/** An objective row (`db/schema/missions.ts` › `missionObjectives`). */
export const zMissionObjective = z.object({
  id: z.guid(),
  missionId: z.guid(),
  /** A kind of `mission`'s registry (`deliver_material`, `visit`, `manual`…). */
  type: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  targetQuantity: z.int(),
  unit: z.string().nullable(),
  locationFrom: zJsonObject.nullable(),
  locationTo: zJsonObject.nullable(),
  order: z.int(),
  weight: z.int(),
  isBonus: z.boolean(),
  /** Null for a bonus without its own payout (and for every required objective). */
  bonusReward: zRewardComponent.nullable(),
  status: zObjectiveStatus,
  currentProgress: z.int(),
  params: zJsonObject.nullable(),
  payload: zJsonObject.nullable(),
  state: zJsonObject.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type MissionObjective = z.infer<typeof zMissionObjective>;

/** An assignment row (`db/schema/assignments.ts` › `missionAssignments`): who took it. */
export const zMissionAssignment = z.object({
  id: z.guid(),
  missionId: z.guid(),
  /** A player's id, or an NPC's (`holderType`). */
  playerId: zOpaqueId,
  holderType: zAssigneeHolderType,
  status: zAssignmentStatus,
  acceptedAt: zTimestamp,
  deadlineAt: zTimestamp.nullable(),
  completedAt: zTimestamp.nullable(),
  /** Each reward component's share, frozen at completion. */
  rewardShares: z.array(zRewardComponent).nullable(),
  rewardAmount: z.int().nullable(),
  /** Required objectives done at hand-in, in basis points (10000 = all); 0 while active. */
  completionRatio: z.int(),
  rewardSettled: z.boolean(),
  rewardSettledAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type MissionAssignment = z.infer<typeof zMissionAssignment>;

/** A mission's assignments by status, and its required objectives' weighted progress. */
export const zMissionSummaryAsServed = z.object({
  assignments: z.int(),
  active: z.int(),
  completed: z.int(),
  partial: z.int(),
  abandoned: z.int(),
  expired: z.int(),
  /** Basis points, 10000 = every required objective done. */
  progressBp: z.int(),
});

/**
 * A mission as `GET /api/internal/missions/:missionId` serves it (`services/detail.service.ts`):
 * every assignment whatever the visibility, assignees' names and the group from `social` (best
 * effort: missing when `social` does not answer), the missions to finish first.
 */
export const zMissionDetailAsServed = z.object({
  mission: zMissionAsServed,
  objectives: z.array(zMissionObjective),
  assignments: z.array(zMissionAssignment),
  /** Assignee id → display name, for the ids `social` resolved. */
  players: z.record(z.string(), z.string()),
  group: z.object({ id: zOpaqueId, name: z.string() }).nullable(),
  chain: z.array(
    z.object({
      id: zOpaqueId,
      /** Empty, with status `unknown`, when the required mission no longer exists. */
      title: z.string(),
      status: z.string(),
    }),
  ),
  summary: zMissionSummaryAsServed,
});
export type MissionDetailAsServed = z.infer<typeof zMissionDetailAsServed>;

/**
 * A mission's page as the panel's BFF serves it (`GET /api/mission/missions/:id`, ADR 0026): the
 * detail, and the POIs its objectives point at, read from `inventory` (`null`: `inventory` has
 * no such POI). Without `places`, the POIs were not read (no `inventory:read`, `inventory` not
 * configured or not answering): the objectives show their ids.
 */
export const zMissionPage = zMissionDetailAsServed.extend({
  places: z.record(z.guid(), zPoi.nullable()).optional(),
});
export type MissionPage = z.infer<typeof zMissionPage>;

/**
 * A mission's creation as `routes/schemas.ts` › `createMissionBody` takes it (the seed's
 * missions): its OpenAPI lacks the weights and bonuses of the objectives, the partial hand-in,
 * the completion, the chain and the time to finish. Each objective's `params` is checked against
 * its kind (`kinds/objectives/`).
 */
export const zCreateMissionAsAccepted = zCreateMission.extend({
  objectives: z
    .array(
      zCreateObjective.extend({
        /** Its share of the partial-completion ratio (1 = equal share). */
        weight: z.int().gte(1).lte(1_000).optional(),
        /** Left out of the completion gate, the order and the ratio. */
        isBonus: z.boolean().optional(),
        /** Paid when this bonus objective is done; only on a bonus. */
        bonusReward: zRewardComponent.optional(),
      }),
    )
    .min(1)
    .max(100),
  allowPartial: z.boolean().optional(),
  autoComplete: z.boolean().optional(),
  /** Missions to complete before this one can be taken. */
  requiresMissionIds: z.array(z.guid()).max(10).optional(),
  assignmentDeadlineHours: z.int().gte(1).lte(8_760).nullish(),
});
export type CreateMissionAsAccepted = z.input<typeof zCreateMissionAsAccepted>;

/**
 * Prefix of the `scriptId` of a mission published by `universesimulator` for a leg of a supply
 * order (`src/simulation/publisher.rs` › `script_id`: `usim:leg:<leg id>:<attempt>`). Such a
 * mission is cancelled through its order, never directly: the simulation would publish it
 * again (ADR 0028).
 */
export const SIMULATION_SCRIPT_PREFIX = 'usim:leg:';

/** Whether `universesimulator` published this mission (ADR 0028, its `scriptId`). */
export const isSimulationMission = (mission: Pick<MissionAsServed, 'scriptId'>): boolean =>
  mission.scriptId?.startsWith(SIMULATION_SCRIPT_PREFIX) ?? false;

/** What `universesimulator` writes in the `payload` of each objective it publishes. */
const zSimulationPayload = z.object({
  source: z.literal('universesimulator'),
  orderId: z.guid(),
  legId: z.guid(),
});

/** The supply order and leg a simulation mission carries, from its objectives' `payload`. */
export function simulationLegOf(
  objectives: readonly Pick<MissionObjective, 'payload'>[],
): { orderId: string; legId: string } | undefined {
  for (const objective of objectives) {
    const payload = zSimulationPayload.safeParse(objective.payload);
    if (payload.success) return { orderId: payload.data.orderId, legId: payload.data.legId };
  }
  return undefined;
}
