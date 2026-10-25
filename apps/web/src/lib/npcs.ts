import { z } from 'zod';
import {
  MAX_BULK,
  MAX_CREATE,
  MAX_PATTERN_DAYS,
  MAX_TASK_SECONDS,
  patternIssues,
  zRole,
  zTaskKind,
  type PanelBulk,
  type PanelCreateNpcs,
  type PanelNewTask,
  type PanelNpcPatch,
  type Place,
  type Routine,
  type zNpc,
  type zNpcDetail,
  type zTask,
} from '@dyingstar-admin/contracts/npc';
import { ApiError } from '@/lib/api';

/**
 * Helpers and forms of the NPCs section (ADR 0026): live state, the shift grids, the dialogs'
 * and the configuration's fields. Error messages of the forms are codes, translated under
 * `npcs.errors.*`; the rules are the service's (`contracts/npc/code.ts`).
 */

/** Error codes of the NPC forms. */
export type NpcFormError =
  | 'required'
  | 'number'
  | 'wholeNumber'
  | 'range'
  | 'json'
  | 'jsonObject'
  | 'patternName'
  | 'unevenDays'
  | 'tooLong'
  | 'uuid';

/** An NPC's page as the SPA reads it: its `int64` ids are `bigint` (`z.coerce.bigint()`). */
export type NpcDetail = z.infer<typeof zNpcDetail>;
export type Npc = z.infer<typeof zNpc>;
export type NpcTask = z.infer<typeof zTask>;

/** What an NPC is doing on the servers: connected to Horizon, running off shift, or stopped. */
export type LiveState = 'connected' | 'running' | 'stopped';
export const liveState = (live: { connected: boolean; running: boolean }): LiveState =>
  live.connected ? 'connected' : live.running ? 'running' : 'stopped';

/** The section's error message: refused to the account, or the service unreachable. */
export const npcErrorKey = (error: unknown) =>
  error instanceof ApiError && error.status === 403
    ? ('npcs.forbidden' as const)
    : ('npcs.unavailable' as const);

/** The message of a refused write: the service's wording when it gave one. */
export const writeError = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** A manual task's label, as the service names its current action (`manual:<kind|action>`). */
export const isManualAction = (name: string) => name.startsWith('manual:');
export const actionName = (name: string) => name.replace(/^manual:/, '');

// Shift grids: one string per rota-day, one letter per planetary hour.

/** Grid letters and the colour of their cells (design tokens of Tailwind's palette). */
export const LETTER_CLASSES: Record<string, string> = {
  T: 'bg-sky-500/70',
  t: 'bg-cyan-400/60',
  r: 'bg-amber-400/70',
  a: 'bg-violet-500/60',
  '.': 'bg-white/5',
  l: 'bg-emerald-500/50',
};
export const letterClass = (letter: string) => LETTER_CLASSES[letter] ?? 'bg-white/5';

/** A day off: every hour `.`. */
export const blankDay = (hours: number) => '.'.repeat(hours);

/** The grid with one cell set to `letter`. */
export function paintCell(days: readonly string[], day: number, hour: number, letter: string) {
  return days.map((row, i) =>
    i === day && hour < row.length ? row.slice(0, hour) + letter + row.slice(hour + 1) : row,
  );
}

/** The grid with a day added at its end (a copy of the last day, or a day off). */
export const addDay = (days: readonly string[], hours: number) =>
  days.length >= MAX_PATTERN_DAYS ? [...days] : [...days, days[days.length - 1] ?? blankDay(hours)];

/** The grid without one of its days (never the last one left). */
export const removeDay = (days: readonly string[], day: number) =>
  days.length <= 1 ? [...days] : days.filter((_, i) => i !== day);

/** The cell of the routine now: the rota day wraps over the pattern's days. */
export function currentCell(routine: Pick<Routine, 'day' | 'hour' | 'days'>) {
  const count = routine.days?.length ?? 0;
  return count ? { day: routine.day % count, hour: routine.hour } : null;
}

// Add NPCs: create new ones and / or spawn existing ones.

export const NEW_ROLES = ['unassigned', 'villager', 'custom'] as const;

const countOf = (max: number) =>
  z
    .number({ error: 'wholeNumber' })
    .int({ error: 'wholeNumber' })
    .min(1, { error: 'range' })
    .max(max, { error: 'range' });
const optionalCount = (max: number) => z.union([z.nan(), countOf(max)]);

/** The "Add NPCs" dialog: N new ones, N existing ones to spawn, or both (one at least). */
export const AddFormSchema = z
  .object({
    create: optionalCount(MAX_CREATE),
    role: z.enum(NEW_ROLES),
    enabled: z.boolean(),
    spawn: optionalCount(MAX_BULK),
  })
  .refine((form) => !Number.isNaN(form.create) || !Number.isNaN(form.spawn), {
    error: 'required',
    path: ['create'],
  });
export type AddForm = z.infer<typeof AddFormSchema>;
export const ADD_FORM_DEFAULTS: AddForm = {
  create: Number.NaN,
  role: 'unassigned',
  enabled: true,
  spawn: Number.NaN,
};

/** The calls of the "Add NPCs" dialog: the creation first, then the spawn by count. */
export function addRequests(form: AddForm): { create?: PanelCreateNpcs; spawn?: PanelBulk } {
  return {
    ...(Number.isNaN(form.create)
      ? {}
      : { create: { count: form.create, role: form.role, enabled: form.enabled } }),
    ...(Number.isNaN(form.spawn) ? {} : { spawn: { action: 'spawn', count: form.spawn } }),
  };
}

/** The "Remove NPCs" dialog: despawn or delete, the selected rows or a count (in a village). */
export const RemoveFormSchema = z
  .object({
    action: z.enum(['despawn', 'delete']),
    scope: z.enum(['selected', 'count']),
    count: optionalCount(MAX_BULK),
    village: z.string().trim().max(16, { error: 'tooLong' }),
  })
  .refine((form) => form.scope === 'selected' || !Number.isNaN(form.count), {
    error: 'required',
    path: ['count'],
  });
export type RemoveForm = z.infer<typeof RemoveFormSchema>;

export function removeRequest(form: RemoveForm, selected: readonly string[]): PanelBulk {
  if (form.scope === 'selected') return { action: form.action, ids: [...selected] };
  const village = form.village.trim();
  return { action: form.action, count: form.count, ...(village ? { village } : {}) };
}

// A manual task.

const seconds = (min: number) =>
  z
    .number({ error: 'wholeNumber' })
    .int({ error: 'wholeNumber' })
    .min(min, { error: 'range' })
    .max(MAX_TASK_SECONDS, { error: 'range' });
const optionalSeconds = (min: number) => z.union([z.nan(), seconds(min)]);
const coordinate = z.union([z.nan(), z.number({ error: 'number' })]);

/** A JSON object typed in a text field: empty, or an object. */
export function parseJsonObject(text: string): Record<string, unknown> | null | 'invalid' {
  if (!text.trim()) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : 'invalid';
  } catch {
    return 'invalid';
  }
}

const jsonObjectText = z.string().refine((text) => parseJsonObject(text) !== 'invalid', {
  error: 'jsonObject',
});

/** The "New task" dialog, its fields for every kind; those of the chosen kind are checked. */
export const TaskFormSchema = z
  .object({
    kind: zTaskKind,
    x: coordinate,
    y: coordinate,
    z: coordinate,
    uuid: z.string().trim(),
    holdS: optionalSeconds(0),
    timeoutS: optionalSeconds(1),
    action: z.string(),
    config: jsonObjectText,
    durationS: optionalSeconds(1),
    seconds: optionalSeconds(1),
    forceOnline: z.boolean(),
  })
  .superRefine((form, ctx) => {
    const required = (path: keyof typeof form, missing: boolean) => {
      if (missing) ctx.addIssue({ code: 'custom', path: [path], message: 'required' });
    };
    if (form.kind === 'go_to_position') {
      for (const axis of ['x', 'y', 'z'] as const) required(axis, Number.isNaN(form[axis]));
    }
    if (form.kind === 'run_action') required('action', !form.action);
    if (form.kind === 'wait') required('seconds', Number.isNaN(form.seconds));
  });
export type TaskForm = z.infer<typeof TaskFormSchema>;
export const TASK_FORM_DEFAULTS: TaskForm = {
  kind: 'go_to_position',
  x: Number.NaN,
  y: Number.NaN,
  z: Number.NaN,
  uuid: '',
  holdS: Number.NaN,
  timeoutS: Number.NaN,
  action: '',
  config: '',
  durationS: Number.NaN,
  seconds: Number.NaN,
  forceOnline: false,
};

/** Only the numbers typed (an empty field keeps the service's default). */
const typed = (entries: Record<string, number>) =>
  Object.fromEntries(Object.entries(entries).filter(([, v]) => !Number.isNaN(v)));

/** The task to queue from the dialog's fields of its kind. */
export function taskToCreate(form: TaskForm): PanelNewTask {
  const forceOnline = form.forceOnline;
  if (form.kind === 'go_to_position') {
    return {
      kind: 'go_to_position',
      params: {
        position: { x: form.x, y: form.y, z: form.z },
        ...(form.uuid ? { uuid: form.uuid } : {}),
        ...typed({ hold_s: form.holdS, timeout_s: form.timeoutS }),
      },
      forceOnline,
    };
  }
  if (form.kind === 'run_action') {
    const config = parseJsonObject(form.config);
    return {
      kind: 'run_action',
      params: {
        action: form.action,
        ...(config && config !== 'invalid' ? { config } : {}),
        ...typed({ duration_s: form.durationS }),
      },
      forceOnline,
    };
  }
  return { kind: 'wait', params: { seconds: form.seconds }, forceOnline };
}

/** A config skeleton for an action, from the fields the service lists for it. */
export const configTemplate = (fields: Record<string, string> | undefined) =>
  fields
    ? JSON.stringify(Object.fromEntries(Object.keys(fields).map((k) => [k, null])), null, 2)
    : '';

// An NPC's configuration.

export const PLACE_FIELDS = ['placeWhereWork', 'home', 'mealPlace', 'mandatoryPlace'] as const;
export type PlaceField = (typeof PLACE_FIELDS)[number];

/** A place as typed: all empty (no place), or a UUID and its three coordinates. */
const PlaceFormSchema = z
  .object({
    uuid: z.string().trim(),
    planet: z.string().trim(),
    x: coordinate,
    y: coordinate,
    z: coordinate,
  })
  .superRefine((place, ctx) => {
    const set = place.uuid || ['x', 'y', 'z'].some((k) => !Number.isNaN(place[k as 'x']));
    if (!set) return;
    if (!place.uuid) ctx.addIssue({ code: 'custom', path: ['uuid'], message: 'required' });
    for (const axis of ['x', 'y', 'z'] as const) {
      if (Number.isNaN(place[axis])) {
        ctx.addIssue({ code: 'custom', path: [axis], message: 'required' });
      }
    }
  });
export type PlaceForm = z.infer<typeof PlaceFormSchema>;

const name = z.string().trim().min(1, { error: 'required' }).max(64, { error: 'tooLong' });

/** The configuration form of an NPC (`PATCH /npcs/{id}`). */
export const ConfigFormSchema = z.object({
  firstName: name,
  lastName: name,
  enabled: z.boolean(),
  role: zRole,
  roleLocked: z.boolean(),
  villageCode: z.string().trim().max(16, { error: 'tooLong' }),
  storekeeperSlot: z.union([
    z.nan(),
    z.number().int({ error: 'wholeNumber' }).min(1, { error: 'range' }).max(5, { error: 'range' }),
  ]),
  schedulePattern: z.string(),
  actionProfile: z.array(z.string()),
  placeWhereWork: PlaceFormSchema,
  home: PlaceFormSchema,
  mealPlace: PlaceFormSchema,
  mandatoryPlace: PlaceFormSchema,
  actionTiming: jsonObjectText,
  actionConfig: jsonObjectText,
  notes: z.string().max(2000, { error: 'tooLong' }),
});
export type ConfigForm = z.infer<typeof ConfigFormSchema>;

const placeForm = (place: Place | null): PlaceForm => ({
  uuid: place?.uuid ?? '',
  planet: place?.planet ?? '',
  x: place?.position.x ?? Number.NaN,
  y: place?.position.y ?? Number.NaN,
  z: place?.position.z ?? Number.NaN,
});

const jsonText = (value: Record<string, unknown>) =>
  Object.keys(value).length ? JSON.stringify(value, null, 2) : '';

/** The form's starting values: the NPC's configuration. */
export const configFormValues = (npc: Npc): ConfigForm => ({
  firstName: npc.firstName,
  lastName: npc.lastName,
  enabled: npc.enabled,
  role: npc.role,
  roleLocked: npc.roleLocked,
  villageCode: npc.villageCode ?? '',
  storekeeperSlot: npc.storekeeperSlot ?? Number.NaN,
  schedulePattern: npc.schedulePattern ?? '',
  actionProfile: [...npc.actionProfile],
  placeWhereWork: placeForm(npc.placeWhereWork),
  home: placeForm(npc.home),
  mealPlace: placeForm(npc.mealPlace),
  mandatoryPlace: placeForm(npc.mandatoryPlace),
  actionTiming: jsonText(npc.actionTiming),
  actionConfig: jsonText(npc.actionConfig),
  notes: npc.notes ?? '',
});

/** A place in one shape (keys in order, no empty planet), to compare and to send. */
const place = (uuid: string, planet: string | null | undefined, x: number, y: number, z: number) =>
  ({ uuid, ...(planet ? { planet } : {}), position: { x, y, z } }) satisfies Place;
const normalised = (p: Place | null) =>
  p ? place(p.uuid, p.planet, p.position.x, p.position.y, p.position.z) : null;

/** A typed place, or `null` when left empty. */
const placeOf = (form: PlaceForm): Place | null =>
  form.uuid ? place(form.uuid, form.planet, form.x, form.y, form.z) : null;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What changed in an NPC's configuration, field by field: emptied fields are `null` (cleared),
 * a JSON block left empty is `{}`. Fields left as they were are not sent.
 */
export function configPatch(npc: Npc, form: ConfigForm): PanelNpcPatch {
  const patch: PanelNpcPatch = {};
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  if (firstName !== npc.firstName) patch.firstName = firstName;
  if (lastName !== npc.lastName) patch.lastName = lastName;
  if (form.enabled !== npc.enabled) patch.enabled = form.enabled;
  if (form.role !== npc.role) patch.role = form.role;
  if (form.roleLocked !== npc.roleLocked) patch.roleLocked = form.roleLocked;
  const village = form.villageCode.trim() || null;
  if (village !== npc.villageCode) patch.villageCode = village;
  const slot = Number.isNaN(form.storekeeperSlot) ? null : form.storekeeperSlot;
  if (slot !== npc.storekeeperSlot) patch.storekeeperSlot = slot;
  const pattern = form.schedulePattern || null;
  if (pattern !== npc.schedulePattern) patch.schedulePattern = pattern;
  if (!same([...form.actionProfile].sort(), [...npc.actionProfile].sort())) {
    patch.actionProfile = form.actionProfile;
  }
  for (const field of PLACE_FIELDS) {
    const typedPlace = placeOf(form[field]);
    if (!same(typedPlace, normalised(npc[field]))) patch[field] = typedPlace;
  }
  for (const field of ['actionTiming', 'actionConfig'] as const) {
    const value = parseJsonObject(form[field]);
    const next = value === 'invalid' ? npc[field] : (value ?? {});
    if (!same(next, npc[field])) patch[field] = next;
  }
  const notes = form.notes.trim() || null;
  if (notes !== npc.notes) patch.notes = notes;
  return patch;
}

// Shift patterns.

/** A pattern as edited: its name (new ones), description and grid. */
export const PatternFormSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9_]{1,64}$/, { error: 'patternName' }),
    description: z.string().max(500, { error: 'tooLong' }),
    days: z.array(z.string()).min(1).max(MAX_PATTERN_DAYS),
  })
  .superRefine((form, ctx) => {
    for (const { path, issue } of patternIssues(form.days)) {
      ctx.addIssue({ code: 'custom', path, message: issue });
    }
  });
export type PatternForm = z.infer<typeof PatternFormSchema>;
