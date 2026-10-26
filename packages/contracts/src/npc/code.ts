import { z } from 'zod';
import {
  zBulkNpcsBody,
  zCreateNpcs,
  zImportSchedulesBody,
  zListNpcsQuery,
  zNpcPatch,
  zPatternBody,
  zPutSettingsBody,
  zSetVillageWorkplaceBody,
  zVec3,
} from './generated/zod.gen';

/**
 * What the panel sends to the `npc` service's Admin writes (ADR 0031), stricter than its OpenAPI
 * where its code is (`src/admin/npcs.rs`, `schedule.rs`, `misc.rs`, `actions/manual.rs`,
 * `schedule.rs` › `validate_pattern`, read 2026-10-25 from the back team's working copy).
 * Hand-written, kept apart from the generated files.
 */

/** Letters of a shift pattern's grid, one per planetary hour (`schedule.rs` › `PATTERN_LETTERS`). */
export const PATTERN_LETTERS = ['T', 't', 'r', 'a', '.', 'l'] as const;
export type PatternLetter = (typeof PATTERN_LETTERS)[number];

/** Activities of the activity → actions mapping; `always` = allowed in every activity. */
export const ACTIVITY_KEYS = [
  'work',
  'transmission',
  'meal',
  'mandatory',
  'off',
  'always',
] as const;
export type ActivityKey = (typeof ACTIVITY_KEYS)[number];

/** Most NPCs created in one call (`provision.rs` › `MAX_BATCH`). */
export const MAX_CREATE = 50;
/** Most NPCs picked by count in one bulk call. */
export const MAX_BULK = 1000;
/** Longest manual task, in seconds (`manual.rs` › `MAX_S`). */
export const MAX_TASK_SECONDS = 3600;
/** Most days of a shift pattern. */
export const MAX_PATTERN_DAYS = 14;

/**
 * `GET /npcs` from a query string: its booleans come as text (`?enabled=true`), the numbers are
 * made numbers by the BFF's `fromQuery`.
 */
export const zPanelListNpcsQuery = zListNpcsQuery.extend({
  enabled: z.stringbool().optional(),
  online: z.stringbool().optional(),
});
export type PanelListNpcsQuery = z.infer<typeof zPanelListNpcsQuery>;

/** The global switch (`PUT /settings`). */
export const zPanelSettings = zPutSettingsBody.strict();
export type PanelSettings = z.infer<typeof zPanelSettings>;

/** `POST /npcs`: 1 to 50 NPCs; imposed names only for one (`CreateRequest::validate`). */
export const zPanelCreateNpcs = zCreateNpcs
  .extend({
    firstName: z.string().trim().min(1).max(64).optional(),
    lastName: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
  .refine(
    (body) => (body.firstName === undefined && body.lastName === undefined) || body.count === 1,
    {
      message: 'Imposed names need count = 1',
      path: ['count'],
    },
  );
export type PanelCreateNpcs = z.input<typeof zPanelCreateNpcs>;

/**
 * `POST /npcs/bulk`: either the NPCs (`ids`, one at least) or how many to pick (`count`), not
 * both (`bulk` answers 400 otherwise); `village` / `role` narrow a pick by count.
 */
export const zPanelBulk = zBulkNpcsBody
  .extend({ ids: zBulkNpcsBody.shape.ids.unwrap().min(1).max(MAX_BULK).optional() })
  .strict()
  .refine((body) => (body.ids === undefined) !== (body.count === undefined), {
    message: 'Give either ids or count',
  });
export type PanelBulk = z.infer<typeof zPanelBulk>;

/**
 * `PATCH /npcs/{id}`: the contract's fields only (the service denies the others), one at least;
 * `null` clears a nullable field.
 */
export const zPanelNpcPatch = zNpcPatch
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'At least one field is required' });
export type PanelNpcPatch = z.infer<typeof zPanelNpcPatch>;

const seconds = (min: number) => z.int().gte(min).lte(MAX_TASK_SECONDS);

/** `go_to_position` params (`manual.rs` › `GoToPosition`, unknown fields refused). */
export const zGoToPositionParams = z
  .object({
    position: zVec3,
    uuid: z.string().min(1).optional(),
    hold_s: seconds(0).optional(),
    timeout_s: seconds(1).optional(),
  })
  .strict();

/** `run_action` params (`RunAction`): `config` overrides that action's config block. */
export const zRunActionParams = z
  .object({
    action: z.string().min(1),
    config: z.record(z.string(), z.unknown()).optional(),
    duration_s: seconds(1).optional(),
  })
  .strict();

/** `wait` params (`Wait`). */
export const zWaitParams = z.object({ seconds: seconds(1) }).strict();

/** `POST /npcs/{id}/tasks`: a task kind and its params, checked as `manual::validate` does. */
export const zPanelNewTask = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('go_to_position'),
      params: zGoToPositionParams,
      forceOnline: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('run_action'),
      params: zRunActionParams,
      forceOnline: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ kind: z.literal('wait'), params: zWaitParams, forceOnline: z.boolean().optional() })
    .strict(),
]);
export type PanelNewTask = z.infer<typeof zPanelNewTask>;

/** Why a pattern's grid is refused, by field (message codes the SPA translates). */
export const PATTERN_ISSUES = {
  unevenDays: 'unevenDays',
} as const;
export type PatternIssue = keyof typeof PATTERN_ISSUES;

/** `validate_pattern`: 1 to 14 days of the same width, only the grid letters. Empty when fine. */
export function patternIssues(days: readonly string[]): { path: ['days']; issue: PatternIssue }[] {
  const width = days[0]?.length ?? 0;
  return days.some((day) => day.length !== width) ? [{ path: ['days'], issue: 'unevenDays' }] : [];
}

const zPatternGrid = zPatternBody
  .extend({ description: z.string().trim().max(500).optional() })
  .strict()
  .superRefine((body, ctx) => {
    for (const { path, issue } of patternIssues(body.days)) {
      ctx.addIssue({ code: 'custom', path, message: PATTERN_ISSUES[issue] });
    }
  });

/** `POST /schedule/patterns`: a new pattern, named. */
export const zPanelCreatePattern = zPatternGrid.refine((body) => body.name !== undefined, {
  message: 'name is required',
  path: ['name'],
});
export type PanelCreatePattern = z.infer<typeof zPanelCreatePattern>;

/** `PUT /schedule/patterns/{name}`: its description and grid (the name is the path's). */
export const zPanelUpdatePattern = zPatternGrid.refine((body) => body.name === undefined, {
  message: 'The name is given by the path',
  path: ['name'],
});
export type PanelUpdatePattern = z.infer<typeof zPanelUpdatePattern>;

/** `PUT /schedule/activity-actions`: the activities given (one at least) and their actions. */
export const zPanelActivityActions = z
  .partialRecord(z.enum(ACTIVITY_KEYS), z.array(z.string().min(1)))
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one activity is required' });
export type PanelActivityActions = z.infer<typeof zPanelActivityActions>;

/** `POST /schedule/import`: the file shipped with the service, or the YAML given. */
export const zPanelImportSchedules = zImportSchedulesBody
  .extend({ yaml: z.string().trim().min(1).max(200_000).optional() })
  .strict();
export type PanelImportSchedules = z.input<typeof zPanelImportSchedules>;

/** `PUT /villages/{code}/workplace`: the cargo depot (persistence UUID) storekeepers work at. */
export const zPanelWorkplace = zSetVillageWorkplaceBody
  .extend({
    warehouseCode: z.string().trim().min(1).max(64).optional(),
    scenename: z.string().trim().min(1).max(256).optional(),
  })
  .strict();
export type PanelWorkplace = z.infer<typeof zPanelWorkplace>;
