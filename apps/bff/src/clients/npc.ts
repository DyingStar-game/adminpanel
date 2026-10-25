import { z } from 'zod';
import {
  zBulkNpcsResponse,
  zCancelNpcTaskResponse,
  zCreateNpcTaskResponse,
  zCreateNpcsResponse,
  zCreatePatternResponse,
  zDeleteNpcResponse,
  zDeletePatternResponse,
  zDeleteVillageWorkplaceResponse,
  zDespawnNpcResponse,
  zGetActivityActionsResponse,
  zGetNpcEventsResponse,
  zGetNpcLogsResponse,
  zGetNpcResponse,
  zGetPatternResponse,
  zGetScheduleLegendResponse,
  zGetSettingsResponse,
  zGetTaskKindsResponse,
  zImportSchedulesResponse,
  zListEventsResponse,
  zListNpcTasksResponse,
  zListNpcsResponse,
  zListPatternsResponse,
  zListVillagesResponse,
  zPatchNpcResponse,
  zPutActivityActionsResponse,
  zPutSettingsResponse,
  zReassignNpcResponse,
  zResetNpcCredentialsResponse,
  zSetVillageWorkplaceResponse,
  zSpawnNpcResponse,
  zUpdatePatternResponse,
  type PanelActivityActions,
  type PanelBulk,
  type PanelCreateNpcs,
  type PanelCreatePattern,
  type PanelImportSchedules,
  type PanelNewTask,
  type PanelNpcPatch,
  type PanelSettings,
  type PanelUpdatePattern,
  type PanelWorkplace,
} from '@dyingstar-admin/contracts/npc';
import { createUpstream, type Query } from './upstream';

export interface NpcClientOptions {
  /** The `npc` service's base URL, without `/api` (e.g. `http://service-npc:9400`). */
  baseUrl: string;
  timeoutMs: number;
}

/** An events page: by kind, older than `before` (an event id, `int64`), at most `limit`. */
export interface EventsQuery {
  kind?: string | undefined;
  before?: bigint | undefined;
  limit?: number | undefined;
}

/** `int64` ids travel as text in a query string. */
const eventsQuery = ({ before, ...query }: EventsQuery): Query => ({
  ...query,
  before: before?.toString(),
});

/**
 * HTTP client for the `npc` service (contract pinned in `@dyingstar-admin/contracts/npc`, ADR
 * 0026). The panel uses its Admin API only (`/api/admin/*`), always with the person's token: the
 * service checks the moderation role itself (reads `moderator`+, writes `admin` or
 * `supervisor`), as `universesimulator` does. NPCs are Keycloak users of group `npcs`; the
 * service connects the enabled ones to Horizon while its global switch is on.
 */
export function createNpcClient({ baseUrl, timeoutMs }: NpcClientOptions) {
  const { call, get } = createUpstream({ name: 'NPC service', baseUrl, timeoutMs });
  const admin = (path: string) => `/admin${path}`;
  const enc = (value: string) => encodeURIComponent(value);
  const npc = (id: string, rest = '') => admin(`/npcs/${enc(id)}${rest}`);
  type Token = string | undefined;
  const post = <T extends z.ZodType>(token: Token, path: string, schema: T, body?: unknown) =>
    call('POST', token, path, schema, body === undefined ? {} : { body });

  return {
    /** The global switch and the counts (total, enabled, running, connected). */
    settings: (token: Token) => get(token, admin('/settings'), zGetSettingsResponse),
    /** Turns every enabled NPC on or off. */
    saveSettings: (token: Token, body: PanelSettings) =>
      call('PUT', token, admin('/settings'), zPutSettingsResponse, { body }),
    /** The roster with live status; `total` counts the matches before `online`. */
    npcs: (token: Token, query: Query) => get(token, admin('/npcs'), zListNpcsResponse, query),
    /** Creates NPCs (generated names, Keycloak accounts); `errors` lists the failed ones. */
    createNpcs: (token: Token, body: PanelCreateNpcs) =>
      post(token, admin('/npcs'), zCreateNpcsResponse, body),
    /** Spawns, despawns or deletes several NPCs, by ids or by count. */
    bulk: (token: Token, body: PanelBulk) =>
      post(token, admin('/npcs/bulk'), zBulkNpcsResponse, body),
    /** One NPC with its routine, recent tasks, live state and workplace. */
    npc: (token: Token, id: string) => get(token, npc(id), zGetNpcResponse),
    /** Edits an NPC (hot-pushed to its runtime); `null` clears a nullable field. */
    patchNpc: (token: Token, id: string, body: PanelNpcPatch) =>
      call('PATCH', token, npc(id), zPatchNpcResponse, { body }),
    /** Deletes an NPC: its runtime, its Keycloak user, its row. */
    deleteNpc: (token: Token, id: string) => call('DELETE', token, npc(id), zDeleteNpcResponse),
    spawn: (token: Token, id: string) => post(token, npc(id, '/spawn'), zSpawnNpcResponse),
    despawn: (token: Token, id: string) => post(token, npc(id, '/despawn'), zDespawnNpcResponse),
    /** Forgets its role and workplace: the automatic assignment runs again. */
    reassign: (token: Token, id: string) => post(token, npc(id, '/reassign'), zReassignNpcResponse),
    /** A new random Keycloak password. */
    resetCredentials: (token: Token, id: string) =>
      post(token, npc(id, '/reset-credentials'), zResetNpcCredentialsResponse),
    /** Log lines after `since` (in memory, lost when the service restarts). */
    logs: (token: Token, id: string, query: Query) =>
      get(token, npc(id, '/logs'), zGetNpcLogsResponse, query),
    /** An NPC's key events, newest first. */
    npcEvents: (token: Token, id: string, query: EventsQuery) =>
      get(token, npc(id, '/events'), zGetNpcEventsResponse, eventsQuery(query)),
    /** Every NPC's key events and the service-wide ones, newest first. */
    events: (token: Token, query: EventsQuery) =>
      get(token, admin('/events'), zListEventsResponse, eventsQuery(query)),
    /** Open tasks first, then the most recent finished ones. */
    tasks: (token: Token, id: string) => get(token, npc(id, '/tasks'), zListNpcTasksResponse),
    /** Gives an NPC a task, which pre-empts its schedule. */
    createTask: (token: Token, id: string, body: PanelNewTask) =>
      post(token, npc(id, '/tasks'), zCreateNpcTaskResponse, body),
    /** Cancels an open task (aborted when running); 409 once finished. */
    cancelTask: (token: Token, id: string, taskId: bigint) =>
      call('DELETE', token, npc(id, `/tasks/${taskId}`), zCancelNpcTaskResponse),
    /** Task kinds and their parameters, the actions that can be run by hand and their config. */
    taskKinds: (token: Token) => get(token, admin('/task-kinds'), zGetTaskKindsResponse),
    // Shift schedules: patterns (a grid of planetary hours per rota-day), the activity → actions
    // mapping, the import of the service's `config/schedules.yaml`.
    patterns: (token: Token) => get(token, admin('/schedule/patterns'), zListPatternsResponse),
    pattern: (token: Token, name: string) =>
      get(token, admin(`/schedule/patterns/${enc(name)}`), zGetPatternResponse),
    createPattern: (token: Token, body: PanelCreatePattern) =>
      post(token, admin('/schedule/patterns'), zCreatePatternResponse, body),
    updatePattern: (token: Token, name: string, body: PanelUpdatePattern) =>
      call('PUT', token, admin(`/schedule/patterns/${enc(name)}`), zUpdatePatternResponse, {
        body,
      }),
    /** Refused (409) while NPCs use it. */
    deletePattern: (token: Token, name: string) =>
      call('DELETE', token, admin(`/schedule/patterns/${enc(name)}`), zDeletePatternResponse),
    importSchedules: (token: Token, body: PanelImportSchedules) =>
      post(token, admin('/schedule/import'), zImportSchedulesResponse, body),
    activityActions: (token: Token) =>
      get(token, admin('/schedule/activity-actions'), zGetActivityActionsResponse),
    /** Replaces the actions of the activities given; the others are unchanged. */
    saveActivityActions: (token: Token, body: PanelActivityActions) =>
      call('PUT', token, admin('/schedule/activity-actions'), zPutActivityActionsResponse, {
        body,
      }),
    /** What each grid letter means. */
    legend: (token: Token) => get(token, admin('/schedule/legend'), zGetScheduleLegendResponse),
    /** Mining villages (NPCs, storekeepers, workplace, Factory) and Factory villages. */
    villages: (token: Token) => get(token, admin('/villages'), zListVillagesResponse),
    /** Sets by hand the cargo depot a village's storekeepers work at. */
    setWorkplace: (token: Token, code: string, body: PanelWorkplace) =>
      call('PUT', token, admin(`/villages/${enc(code)}/workplace`), zSetVillageWorkplaceResponse, {
        body,
      }),
    /** Forgets it: resolved again at the next assignment. */
    deleteWorkplace: (token: Token, code: string) =>
      call(
        'DELETE',
        token,
        admin(`/villages/${enc(code)}/workplace`),
        zDeleteVillageWorkplaceResponse,
      ),
  };
}

export type NpcClient = ReturnType<typeof createNpcClient>;
