import { http, HttpResponse } from 'msw';
import type {
  Event,
  LogLine,
  MiningVillage,
  Npc,
  Pattern,
  Place,
  Task,
  Workplace,
} from '@dyingstar-admin/contracts/npc';

/** Base URL used by tests for the mocked `npc` service (ADR 0026). */
export const NPC_URL = 'http://npc.test';

/**
 * Ids of the fixtures: NPCs are Keycloak users (their id is the JWT `sub` and the Horizon player
 * id); depots are persistence `cargo_depot` UUIDs.
 */
export const npcIds = {
  /** Storekeeper 1 of M0012, connected, stocking shelves (schedule). */
  alain: 'c0ffee00-0000-4000-8000-000000000001',
  /** Storekeeper 2 of M0012, running but off shift (not connected). */
  berthe: 'c0ffee00-0000-4000-8000-000000000002',
  /** Villager of M0012, connected, on a manual walk (task 3). */
  camille: 'c0ffee00-0000-4000-8000-000000000003',
  /** Not assigned yet, disabled. */
  denis: 'c0ffee00-0000-4000-8000-000000000004',
  /** Configured by hand, disabled, Keycloak in error. */
  elise: 'c0ffee00-0000-4000-8000-000000000005',
  /** Cargo depot of M0012 (its storekeepers' workplace). */
  m0012Depot: '0cde0000-0000-0000-0000-000000000121',
  /** Another cargo depot, for a workplace set by hand. */
  m0013Depot: '0cde0000-0000-0000-0000-000000000131',
} as const;

/** The actions of the catalogue (`ActionRegistry::catalogue`), stubs included. */
export const NPC_CATALOGUE = [
  'detect_player_and_greet',
  'go_to_point',
  'reception_players',
  'going_to_work',
  'depot_store_reception_to_temp_area',
  'depot_store_item',
  'depot_reception_coordinator',
  'go_home',
  'go_to_meal',
  'mandatory_activity',
  'take_a_walk',
  'drive_to_factory',
  'check_vehicle_components',
  'go_sell_object',
] as const;

/** Actions that cannot be run by hand (`manual.rs` › `NOT_MANUAL`). */
const NOT_MANUAL: readonly string[] = ['check_vehicle_components', 'go_sell_object'];
/** Actions an admin may run by hand (`manual_actions`). */
export const NPC_MANUAL_ACTIONS = NPC_CATALOGUE.filter((a) => !NOT_MANUAL.includes(a));

const LEGEND = [
  { letter: 'T', activity: 'work', label: 'travail' },
  { letter: 't', activity: 'transmission', label: 'transmission (relève)' },
  { letter: 'r', activity: 'meal', label: 'repas' },
  { letter: 'a', activity: 'mandatory', label: 'activités obligatoires' },
  { letter: '.', activity: 'off', label: 'repos (maison)' },
  { letter: 'l', activity: 'off', label: "loisir (pas encore d'action : comme repos)" },
] as const;
const ACTIVITY_OF: Record<string, string> = Object.fromEntries(
  LEGEND.map((l) => [l.letter, l.activity]),
);
const ACTIVITY_KEYS = ['work', 'transmission', 'meal', 'mandatory', 'off', 'always'];
const ROLES = ['unassigned', 'storekeeper', 'villager', 'custom'];
const LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
const MAX_S = 3600;

/** The schedules the service ships (`config/schedules.yaml`, first two patterns). */
export const SHIPPED_SCHEDULES = `schedules:
  magasinier_1:
    days:
      - "TTTTTaaratTTTTTaar......."   # jour 1
      - "....tTTTTTaaratTTTTT....."   # jour 2
      - "....tTTTTTaaratTTTTT....."   # jour 3
      - ".......r.tTTTTTaaratTTTTT"   # jour 4
      - "a........................"   # jour 5
  magasinier_2:
    days:
      - "....tTTTTTaaratTTTTTaar.."
      - "....tTTTTTaaratTTTTT....."
      - ".......r.tTTTTTaaratTTTTT"
      - "a.....................r.t"
      - "TTTTTaaratTTTTTaar......."
`;

export interface NpcDataset {
  settings: { npcsEnabled: boolean; updatedAt: string; updatedBy: string | null };
  npcs: Npc[];
  tasks: Task[];
  events: Event[];
  /** In-memory log lines per NPC id, oldest first. */
  logs: Map<string, LogLine[]>;
  patterns: Pattern[];
  activityActions: Record<string, string[]>;
  workplaces: Workplace[];
  /** Mining villages known from the world data (name, position, Factory). */
  mining: Pick<MiningVillage, 'name' | 'lon' | 'lat' | 'factory'>[];
  factories: { name: string; lon: number; lat: number }[];
  /** Planetary time of every routine (`clock.now()`): rota day (absolute) and hour. */
  clock: { day: number; hour: number };
}

const MINUTE = 60_000;
const depotPlace = (position: [number, number, number]): Place => ({
  uuid: npcIds.m0012Depot,
  planet: 'tarsis_3',
  position: { x: position[0], y: position[1], z: position[2] },
});

/** One NPC row, with the defaults the service gives a new one. */
function npcRow(
  now: number,
  id: string,
  firstName: string,
  lastName: string,
  extra: Partial<Npc>,
): Npc {
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString();
  return {
    id,
    login: `npc-${id.replace(/-/g, '').slice(-8)}`,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    enabled: false,
    role: 'unassigned',
    roleLocked: false,
    villageCode: null,
    storekeeperSlot: null,
    schedulePattern: null,
    actionProfile: [],
    placeWhereWork: null,
    home: null,
    mealPlace: null,
    mandatoryPlace: null,
    actionTiming: {},
    actionConfig: {},
    kcState: 'ready',
    kcError: null,
    firstSpawnAt: null,
    lastSeenAt: null,
    notes: null,
    createdBy: 'dev-admin',
    createdAt: at(600),
    updatedAt: at(60),
    live: {
      running: false,
      connected: false,
      status: null,
      currentAction: null,
      runningSince: null,
    },
    ...extra,
  };
}

/**
 * NPCs of the mining village M0012 on SandBox (`tarsis_3`), the global switch on: two
 * storekeepers (one at work, one off shift), a villager on a manual walk, an NPC not assigned
 * yet and one configured by hand whose Keycloak account failed; the shipped shift patterns, the
 * default activity → actions mapping, tasks, events and log lines. Times are relative to `now`.
 */
export function createNpcDataset(now = Date.now()): NpcDataset {
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString();
  const work = [
    'going_to_work',
    'depot_store_reception_to_temp_area',
    'depot_store_item',
    'reception_players',
  ];
  const storekeeperProfile = [...work, 'detect_player_and_greet', 'depot_reception_coordinator'];
  const s = npcIds;
  const npcs: Npc[] = [
    npcRow(now, s.alain, 'Alain', 'Deloin', {
      enabled: true,
      role: 'storekeeper',
      villageCode: 'M0012',
      storekeeperSlot: 1,
      schedulePattern: 'magasinier_1',
      actionProfile: storekeeperProfile,
      placeWhereWork: depotPlace([12.5, 0, -4]),
      actionTiming: { depot_store_item: { cooldown_ms: 2000 } },
      firstSpawnAt: at(590),
      lastSeenAt: at(0),
      createdAt: at(600),
      live: {
        running: true,
        connected: true,
        status: 'at_work',
        currentAction: {
          name: 'depot_store_item',
          source: 'schedule',
          taskId: null,
          startedAt: at(2),
        },
        runningSince: at(120),
      },
    }),
    npcRow(now, s.berthe, 'Berthe', 'Morel', {
      enabled: true,
      role: 'storekeeper',
      villageCode: 'M0012',
      storekeeperSlot: 2,
      schedulePattern: 'magasinier_2',
      actionProfile: storekeeperProfile,
      placeWhereWork: depotPlace([14, 0, -4]),
      firstSpawnAt: at(580),
      lastSeenAt: at(90),
      createdAt: at(599),
      live: {
        running: true,
        connected: false,
        status: null,
        currentAction: null,
        runningSince: at(120),
      },
    }),
    npcRow(now, s.camille, 'Camille', 'Roux', {
      enabled: true,
      role: 'villager',
      villageCode: 'M0012',
      schedulePattern: 'magasinier_1',
      actionProfile: ['take_a_walk', 'go_home', 'go_to_meal', 'detect_player_and_greet'],
      actionConfig: { take_a_walk: { radius_m: 30 } },
      firstSpawnAt: at(500),
      lastSeenAt: at(0),
      createdAt: at(598),
      live: {
        running: true,
        connected: true,
        status: 'walking',
        currentAction: {
          name: 'manual:take_a_walk',
          source: 'manual',
          taskId: 3,
          startedAt: at(5),
        },
        runningSince: at(110),
      },
    }),
    npcRow(now, s.denis, 'Denis', 'Faure', { createdAt: at(300) }),
    npcRow(now, s.elise, 'Élise', 'Garnier', {
      role: 'custom',
      roleLocked: true,
      actionProfile: ['take_a_walk'],
      kcState: 'error',
      kcError: 'Keycloak error (409): User exists with same username',
      createdAt: at(200),
    }),
  ];
  const task = (
    id: number,
    npcId: string,
    kind: Task['kind'],
    params: Record<string, unknown>,
    status: Task['status'],
    minutes: number,
    extra: Partial<Task> = {},
  ): Task => ({
    id,
    npcId,
    kind,
    params,
    forceOnline: false,
    status,
    error: null,
    createdBy: 'dev-admin',
    createdAt: at(minutes),
    startedAt: status === 'pending' ? null : at(minutes - 1),
    finishedAt: ['pending', 'running'].includes(status) ? null : at(minutes - 2),
    ...extra,
  });
  const tasks: Task[] = [
    task(1, s.camille, 'wait', { seconds: 30 }, 'done', 60),
    task(2, s.camille, 'go_to_position', { position: { x: 1, y: 0, z: 2 } }, 'failed', 40, {
      error: 'timeout: not arrived after 300 s',
    }),
    task(3, s.camille, 'run_action', { action: 'take_a_walk', duration_s: 600 }, 'running', 6),
    task(4, s.camille, 'wait', { seconds: 120 }, 'pending', 5, { forceOnline: true }),
  ];
  let eventId = 0;
  const event = (
    npcId: string | null,
    kind: string,
    message: string,
    minutes: number,
    level: Event['level'] = 'info',
    data: Event['data'] = null,
  ): Event => ({ id: ++eventId, npcId, ts: at(minutes), kind, level, message, data });
  const events: Event[] = [
    event(s.alain, 'created', 'created by dev-admin', 600),
    event(s.berthe, 'created', 'created by dev-admin', 599),
    event(s.camille, 'created', 'created by dev-admin', 598),
    event(null, 'global_switch', 'NPCs enabled by dev-admin', 590, 'info', { npcsEnabled: true }),
    event(s.alain, 'role_assigned', 'storekeeper 1 of M0012', 589),
    event(s.alain, 'spawned', 'spawned', 120),
    event(s.alain, 'connected', 'connected to Horizon', 119),
    event(s.berthe, 'off_shift', 'off shift: disconnected', 90),
    event(s.camille, 'task_created', 'task 3 (run_action) queued by dev-admin', 6, 'info', {
      task_id: 3,
    }),
    event(s.camille, 'task_started', 'task 3 started', 5),
    event(s.elise, 'spawn_failed', 'Keycloak account missing', 100, 'error'),
    event(s.alain, 'action_started', 'depot_store_item', 2),
  ].sort((a, b) => a.id - b.id);
  let seq = 0;
  const line = (
    level: LogLine['level'],
    message: string,
    seconds: number,
    fields: Record<string, unknown> = {},
  ): LogLine => ({
    seq: ++seq,
    ts: new Date(now - seconds * 1000).toISOString(),
    level,
    target: 'npc::runtime',
    message,
    fields,
  });
  const logs = new Map<string, LogLine[]>([
    [
      s.alain,
      [
        line('INFO', 'connected', 7200, { session: 'h-41' }),
        line('DEBUG', 'tick', 130, { activity: 'work' }),
        line('INFO', 'action started', 120, { action: 'depot_store_item' }),
        line('WARN', 'shelf full, trying the next one', 60, { shelf: 'B2' }),
      ],
    ],
    [s.camille, [line('INFO', 'manual task started', 300, { task: 3 })]],
  ]);
  const pattern = (name: string, days: string[], description: string | null): Pattern => ({
    name,
    description,
    days,
    source: 'import',
    updatedAt: at(600),
    updatedBy: 'import',
  });
  return {
    settings: { npcsEnabled: true, updatedAt: at(590), updatedBy: 'dev-admin' },
    npcs,
    tasks,
    events,
    logs,
    patterns: [
      pattern(
        'magasinier_1',
        [
          'TTTTTaaratTTTTTaar.......',
          '....tTTTTTaaratTTTTT.....',
          '....tTTTTTaaratTTTTT.....',
          '.......r.tTTTTTaaratTTTTT',
          'a........................',
        ],
        'Depot storekeeper, crew 1',
      ),
      pattern(
        'magasinier_2',
        [
          '....tTTTTTaaratTTTTTaar..',
          '....tTTTTTaaratTTTTT.....',
          '.......r.tTTTTTaaratTTTTT',
          'a.....................r.t',
          'TTTTTaaratTTTTTaar.......',
        ],
        null,
      ),
    ],
    activityActions: {
      always: ['detect_player_and_greet', 'depot_reception_coordinator'],
      mandatory: ['mandatory_activity'],
      meal: ['go_to_meal'],
      off: ['go_home'],
      transmission: [...work],
      work: [...work],
    },
    workplaces: [
      {
        villageCode: 'M0012',
        warehouseId: s.m0012Depot,
        warehouseCode: 'M0012-D1',
        scenename: 'cargo_depot.tscn',
        source: 'usim',
        updatedAt: at(590),
        updatedBy: null,
      },
    ],
    mining: [
      {
        name: 'M0012',
        lon: 31.62,
        lat: 36.94,
        factory: { factory: 'F0003', road_cost_m: 15_420, configured: true },
      },
      { name: 'M0013', lon: 31.71, lat: 36.88, factory: null },
    ],
    factories: [{ name: 'F0003', lon: 31.9, lat: 36.7 }],
    // Day 7 of a 5-day rota is its day 3 (index 2); planetary hour 6: `T` in magasinier_1.
    clock: { day: 7, hour: 6 },
  };
}

export interface NpcMock {
  handlers: ReturnType<typeof http.get>[];
  data: NpcDataset;
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
  /** Writes received (method, path and JSON body when there is one), oldest first. */
  writes: { call: string; body?: unknown }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRST_NAMES = ['Gaston', 'Hélène', 'Igor', 'Jeanne', 'Karim', 'Léa', 'Marius', 'Nina'];
const LAST_NAMES = ['Barbier', 'Collin', 'Dumas', 'Fabre', 'Giraud', 'Hamon', 'Joly', 'Lemaire'];

/** `validate_pattern`: the error message, or null when the grid is fine. */
function patternError(name: string, days: unknown): string | null {
  if (!/^[a-z0-9_]{1,64}$/.test(name)) return `pattern name '${name}' must match [a-z0-9_]{1,64}`;
  if (!Array.isArray(days) || days.some((d) => typeof d !== 'string')) {
    return `pattern '${name}': days must be strings`;
  }
  const rows = days as string[];
  if (rows.length === 0 || rows.length > 14) {
    return `pattern '${name}' must have 1 to 14 days, has ${rows.length}`;
  }
  const bad = rows.join('').match(/[^Ttra.l]/);
  if (bad) return `pattern '${name}' uses '${bad[0]}'; allowed letters: Ttra.l`;
  const width = rows[0]?.length ?? 0;
  if (width === 0) return `schedule '${name}' day 1 is empty`;
  const uneven = rows.findIndex((d) => d.length !== width);
  if (uneven >= 0) {
    return `schedule '${name}' day ${uneven + 1} has ${rows[uneven]?.length} chars, expected ${width} (all days must be the same length)`;
  }
  return null;
}

/**
 * The `schedules:` map of a schedules file (`ScheduleFile`), read line by line: enough for the
 * format of `config/schedules.yaml` (a name, an optional `description`, its `days`). Null when it
 * is not one.
 */
function parseSchedules(
  yaml: string,
): { name: string; description: string | null; days: string[] }[] | null {
  const lines = yaml.split('\n').map((l) => l.replace(/\s+#.*$/, '').replace(/\s+$/, ''));
  if (!lines.some((l) => l === 'schedules:')) return null;
  const out: { name: string; description: string | null; days: string[] }[] = [];
  let inSchedules = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^\S/.test(raw)) {
      inSchedules = raw === 'schedules:';
      continue;
    }
    if (!inSchedules) continue;
    const name = /^ {2}([^\s:]+):$/.exec(raw);
    if (name?.[1]) {
      out.push({ name: name[1], description: null, days: [] });
      continue;
    }
    const current = out[out.length - 1];
    if (!current) return null;
    const description = /^\s+description:\s*"?(.*?)"?$/.exec(raw);
    if (description) current.description = description[1] ?? null;
    const day = /^\s+-\s*"?([^"]*)"?$/.exec(raw);
    if (day) current.days.push(day[1] ?? '');
  }
  return out;
}

/**
 * MSW handlers reproducing the `npc` service's Admin API (`src/admin/npcs.rs`, `schedule.rs`,
 * `misc.rs`, `db/*.rs`, `actions/manual.rs`, `schedule_import.rs`): the roster ordered by
 * creation with its filters (`total` before `online`), creation (1 to 50, imposed names for
 * one), bulk spawn / despawn / delete by ids or by count (spawn picks the oldest disabled,
 * despawn and delete the most recent enabled, storekeepers last), the edit rules of
 * `apply_patch` (a role set by hand locks it unless `unassigned`, a storekeeper needs a village
 * and a slot, a slot is for storekeepers only, actions from the catalogue, known patterns, a
 * free display name), the global switch (running = switch on and enabled), manual tasks checked
 * as `manual::validate` does and cancelled while open (409 after), events newest first, log
 * lines after `since` at a minimum level, shift patterns (`validate_pattern`, 409 when used or
 * existing), the activity → actions mapping, the import of a schedules file (`missing` /
 * `overwrite`), villages and their workplace. Roles are not checked here.
 */
export function createNpcMock(
  data: NpcDataset = createNpcDataset(),
  baseUrl: string = NPC_URL,
): NpcMock {
  const tokens: (string | null)[] = [];
  const writes: { call: string; body?: unknown }[] = [];
  const admin = `${baseUrl}/api/admin`;
  let nextId = 100;
  let nextTask = Math.max(0, ...data.tasks.map((t) => t.id)) + 1;
  let nextEvent = Math.max(0, ...data.events.map((e) => e.id)) + 1;
  const seen = (request: Request) => tokens.push(request.headers.get('Authorization'));
  const wrote = (request: Request, body?: unknown) =>
    writes.push({
      call: `${request.method} ${new URL(request.url).pathname.replace(/^\/api\/admin/, '')}`,
      ...(body === undefined ? {} : { body }),
    });
  /** A write's JSON body, recorded; null when it is not a JSON object. */
  const bodyOf = async (request: Request): Promise<Record<string, unknown> | null> => {
    const body: unknown = await request.json().catch(() => null);
    wrote(request, body);
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  };
  const failure = (status: number, error: string, message: string) =>
    HttpResponse.json({ error, message }, { status });
  const badRequest = (message: string) => failure(400, 'BAD_REQUEST', message);
  const notFound = (what: string) => failure(404, 'NOT_FOUND', `${what} not found`);
  const conflict = (message: string) => failure(409, 'CONFLICT', message);
  const noContent = () => new HttpResponse(null, { status: 204 });
  const nowIso = () => new Date().toISOString();
  const isInt = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  const log = (npcId: string | null, kind: string, message: string, extra: Event['data'] = null) =>
    data.events.push({
      id: nextEvent++,
      npcId,
      ts: nowIso(),
      kind,
      level: 'info',
      message,
      data: extra,
    });
  const find = (id: unknown) => data.npcs.find((n) => n.id === id);
  /** Runtime state after a change: running while the switch is on and the NPC enabled. */
  const reconcile = () => {
    for (const npc of data.npcs) {
      const running = data.settings.npcsEnabled && npc.enabled;
      if (running && !npc.live.running) {
        npc.live = {
          running: true,
          connected: false,
          status: null,
          currentAction: null,
          runningSince: nowIso(),
        };
      } else if (!running) {
        npc.live = {
          running: false,
          connected: false,
          status: null,
          currentAction: null,
          runningSince: null,
        };
      }
    }
  };
  const counts = () => ({
    total: data.npcs.length,
    enabled: data.npcs.filter((n) => n.enabled).length,
    running: data.npcs.filter((n) => n.live.running).length,
    connected: data.npcs.filter((n) => n.live.connected).length,
  });
  const settings = () => HttpResponse.json({ settings: data.settings, counts: counts() });
  const workplaceOf = (code: string | null) =>
    (code && data.workplaces.find((w) => w.villageCode === code)) || null;
  const pattern = (name: unknown) => data.patterns.find((p) => p.name === name);
  /** `routine()`: the planetary time and what the NPC's pattern says of it. */
  const routine = (npc: Npc) => {
    const p = npc.schedulePattern ? pattern(npc.schedulePattern) : undefined;
    const days = p?.days ?? null;
    const row = days?.[data.clock.day % days.length];
    const letter = row?.[data.clock.hour % row.length];
    const activity = letter ? (ACTIVITY_OF[letter] ?? 'off') : null;
    const allowed = activity
      ? [
          ...new Set([
            ...(data.activityActions[activity] ?? []),
            ...(data.activityActions.always ?? []),
          ]),
        ].sort()
      : null;
    return {
      pattern: npc.schedulePattern,
      patternMissing: npc.schedulePattern !== null && !p,
      planet: 'tarsis_3',
      rotationH: 25,
      day: data.clock.day,
      hour: data.clock.hour,
      activity,
      allowedActions: allowed,
      days,
    };
  };
  /** Open tasks first, then the most recent (`db::tasks::list`). */
  const tasksOf = (npcId: string, limit: number) =>
    data.tasks
      .filter((t) => t.npcId === npcId)
      .sort((a, b) => {
        const open = (t: Task) => (['pending', 'running'].includes(t.status) ? 1 : 0);
        return open(b) - open(a) || b.id - a.id;
      })
      .slice(0, limit);
  /** Events newest first, by NPC, kind and `before` (`db::events::list`). */
  const eventsOf = (url: URL, npcId: string | null) => {
    const kind = url.searchParams.get('kind');
    const before = url.searchParams.get('before');
    const limit = Number(url.searchParams.get('limit') ?? 100);
    if (before !== null && !/^\d+$/.test(before)) return badRequest('before: invalid integer');
    return HttpResponse.json({
      items: data.events
        .filter(
          (e) =>
            (npcId === null || e.npcId === npcId) &&
            (!kind || e.kind === kind) &&
            (before === null || e.id < Number(before)),
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, Math.min(Math.max(limit, 1), 1000)),
    });
  };
  const isPlace = (v: unknown) => {
    if (v === null) return true;
    if (!v || typeof v !== 'object') return false;
    const p = v as Record<string, unknown>;
    const pos = p.position as Record<string, unknown> | undefined;
    return (
      typeof p.uuid === 'string' &&
      !!pos &&
      ['x', 'y', 'z'].every((k) => typeof pos[k] === 'number')
    );
  };
  /** `apply_patch` on a copy of `npc`: the edited row, or the reason it is refused. */
  const applyPatch = (npc: Npc, p: Record<string, unknown>): Npc | string => {
    const allowed = [
      'firstName',
      'lastName',
      'enabled',
      'role',
      'roleLocked',
      'villageCode',
      'storekeeperSlot',
      'schedulePattern',
      'actionProfile',
      'placeWhereWork',
      'home',
      'mealPlace',
      'mandatoryPlace',
      'actionTiming',
      'actionConfig',
      'notes',
    ];
    const unknown = Object.keys(p).find((k) => !allowed.includes(k));
    if (unknown) return `unknown field \`${unknown}\``;
    const row: Npc = structuredClone(npc);
    for (const field of ['firstName', 'lastName'] as const) {
      if (p[field] === undefined) continue;
      const v = typeof p[field] === 'string' ? p[field].trim() : '';
      if (!v || v.length > 64) return `${field} must be 1 to 64 characters`;
      row[field] = v;
    }
    row.displayName = `${row.firstName} ${row.lastName}`;
    if (typeof p.enabled === 'boolean') row.enabled = p.enabled;
    if (p.role !== undefined) {
      if (typeof p.role !== 'string' || !ROLES.includes(p.role)) {
        return `role must be one of ${JSON.stringify(ROLES)}`;
      }
      row.roleLocked = p.role !== 'unassigned';
      if (p.role !== 'storekeeper') row.storekeeperSlot = null;
      row.role = p.role as Npc['role'];
    }
    if (typeof p.roleLocked === 'boolean') row.roleLocked = p.roleLocked;
    if (p.villageCode !== undefined) {
      row.villageCode =
        typeof p.villageCode === 'string' && p.villageCode.trim() ? p.villageCode : null;
    }
    if (p.storekeeperSlot !== undefined) {
      if (p.storekeeperSlot !== null && !isInt(p.storekeeperSlot, 1, 5)) {
        return 'storekeeperSlot: 1 to 5';
      }
      row.storekeeperSlot = p.storekeeperSlot as number | null;
    }
    if (p.schedulePattern !== undefined) {
      row.schedulePattern =
        typeof p.schedulePattern === 'string' && p.schedulePattern ? p.schedulePattern : null;
    }
    if (p.actionProfile !== undefined) {
      if (!Array.isArray(p.actionProfile)) return 'actionProfile: expected a list';
      const bad = (p.actionProfile as unknown[]).find(
        (a) => !(NPC_CATALOGUE as readonly unknown[]).includes(a),
      );
      if (bad !== undefined) return `unknown action '${String(bad)}'`;
      row.actionProfile = p.actionProfile as string[];
    }
    for (const field of ['placeWhereWork', 'home', 'mealPlace', 'mandatoryPlace'] as const) {
      if (p[field] === undefined) continue;
      if (!isPlace(p[field])) return `invalid ${field}: expected {uuid, position: {x, y, z}}`;
      row[field] = p[field] as Place | null;
    }
    for (const field of ['actionTiming', 'actionConfig'] as const) {
      if (p[field] === undefined) continue;
      if (p[field] !== null && (typeof p[field] !== 'object' || Array.isArray(p[field]))) {
        return `${field}: expected an object`;
      }
      row[field] = (p[field] ?? {}) as Record<string, unknown>;
    }
    if (p.notes !== undefined) row.notes = typeof p.notes === 'string' ? p.notes : null;
    if (row.role === 'storekeeper' && (row.storekeeperSlot === null || row.villageCode === null)) {
      return 'a storekeeper needs villageCode and storekeeperSlot';
    }
    if (row.role !== 'storekeeper' && row.storekeeperSlot !== null) {
      return 'storekeeperSlot is only for storekeepers';
    }
    return row;
  };
  /** `manual::validate`: the reason a task is refused, or null. */
  const taskError = (kind: unknown, params: unknown): string | null => {
    const p = (params ?? {}) as Record<string, unknown>;
    if (typeof p !== 'object' || Array.isArray(p)) return `invalid ${String(kind)} params`;
    const only = (keys: string[]) => {
      const extra = Object.keys(p).find((k) => !keys.includes(k));
      return extra ? `invalid ${String(kind)} params: unknown field \`${extra}\`` : null;
    };
    if (kind === 'go_to_position') {
      const pos = p.position as Record<string, unknown> | undefined;
      if (!pos || !['x', 'y', 'z'].every((k) => typeof pos[k] === 'number')) {
        return 'invalid go_to_position params: missing field `position`';
      }
      const hold = p.hold_s ?? 60;
      const timeout = p.timeout_s ?? 300;
      if (!isInt(hold, 0, MAX_S) || !isInt(timeout, 1, MAX_S)) {
        return `hold_s and timeout_s must be within 0..${MAX_S}`;
      }
      return only(['position', 'uuid', 'hold_s', 'timeout_s']);
    }
    if (kind === 'run_action') {
      if (typeof p.action !== 'string') return 'invalid run_action params: missing field `action`';
      if (!(NPC_MANUAL_ACTIONS as readonly string[]).includes(p.action)) {
        return `unknown action '${p.action}'`;
      }
      if (!isInt(p.duration_s ?? 300, 1, MAX_S)) return `duration_s must be within 1..${MAX_S}`;
      return only(['action', 'config', 'duration_s']);
    }
    if (kind === 'wait') {
      if (!isInt(p.seconds, 1, MAX_S)) return `seconds must be within 1..${MAX_S}`;
      return only(['seconds']);
    }
    return `unknown task kind '${String(kind)}'`;
  };
  const deleteNpc = (id: string) => {
    data.npcs = data.npcs.filter((n) => n.id !== id);
    log(null, 'npc_deleted', `NPC ${id} deleted`);
  };
  const actionsKnown = (actions: unknown) =>
    Array.isArray(actions) &&
    actions.every((a) => (NPC_CATALOGUE as readonly unknown[]).includes(a));

  const handlers = [
    http.get(`${admin}/settings`, ({ request }) => {
      seen(request);
      return settings();
    }),
    http.put(`${admin}/settings`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (typeof body?.npcsEnabled !== 'boolean')
        return badRequest('npcsEnabled: expected a boolean');
      data.settings = {
        npcsEnabled: body.npcsEnabled,
        updatedAt: nowIso(),
        updatedBy: 'dev-admin',
      };
      log(null, 'global_switch', `NPCs ${body.npcsEnabled ? 'enabled' : 'disabled'}`, {
        npcsEnabled: body.npcsEnabled,
      });
      reconcile();
      return settings();
    }),
    http.get(`${admin}/npcs`, ({ request }) => {
      seen(request);
      const q = new URL(request.url).searchParams;
      const flag = (name: string) => {
        const v = q.get(name);
        return v === null ? undefined : v === 'true';
      };
      const role = q.get('role');
      if (role !== null && !ROLES.includes(role))
        return badRequest(`role: unknown variant '${role}'`);
      const search = q.get('q')?.toLowerCase();
      const enabled = flag('enabled');
      const online = flag('online');
      const matching = data.npcs
        .filter(
          (n) =>
            (!q.get('village') || n.villageCode === q.get('village')) &&
            (role === null || n.role === role) &&
            (enabled === undefined || n.enabled === enabled) &&
            (!search ||
              n.displayName.toLowerCase().includes(search) ||
              n.login.toLowerCase().includes(search)),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      const limit = Math.min(Math.max(Number(q.get('limit') ?? 100), 1), 1000);
      const offset = Math.max(Number(q.get('offset') ?? 0), 0);
      return HttpResponse.json({
        items: matching
          .slice(offset, offset + limit)
          .filter((n) => online === undefined || n.live.connected === online),
        total: matching.length,
      });
    }),
    http.post(`${admin}/npcs`, async ({ request }) => {
      seen(request);
      const body = (await bodyOf(request)) ?? {};
      const count = body.count ?? 1;
      if (!isInt(count, 1, 50)) return badRequest('count must be within 1..=50');
      const role = body.role ?? 'unassigned';
      if (typeof role !== 'string' || !['unassigned', 'villager', 'custom'].includes(role)) {
        return badRequest('role must be unassigned, villager or custom');
      }
      if ((body.firstName !== undefined || body.lastName !== undefined) && count !== 1) {
        return badRequest('imposed names need count = 1');
      }
      if (body.schedulePattern !== undefined && !pattern(body.schedulePattern)) {
        return badRequest(`unknown schedule pattern '${String(body.schedulePattern)}'`);
      }
      const created: Npc[] = [];
      const errors: string[] = [];
      for (let i = 0; i < (count as number); i++) {
        const n = nextId++;
        const id = `c0ffee00-0000-4000-8000-${String(n).padStart(12, '0')}`;
        const firstName =
          typeof body.firstName === 'string'
            ? body.firstName
            : (FIRST_NAMES[n % FIRST_NAMES.length] ?? 'Gaston');
        const lastName =
          typeof body.lastName === 'string'
            ? body.lastName
            : (LAST_NAMES[(n * 3) % LAST_NAMES.length] ?? 'Barbier');
        if (data.npcs.some((x) => x.displayName === `${firstName} ${lastName}`)) {
          errors.push(`an NPC is already named ${firstName} ${lastName}`);
          continue;
        }
        const npc = npcRow(Date.now(), id, firstName, lastName, {
          enabled: body.enabled === true,
          role: role as Npc['role'],
          roleLocked: role === 'custom',
          schedulePattern: typeof body.schedulePattern === 'string' ? body.schedulePattern : null,
          actionProfile: Array.isArray(body.actionProfile) ? (body.actionProfile as string[]) : [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        data.npcs.push(npc);
        log(id, 'created', 'created by dev-admin');
        created.push(npc);
      }
      if (created.length === 0) return conflict(errors.join('; '));
      reconcile();
      // Answered as created: not running yet (the reconciler starts them).
      return HttpResponse.json(
        {
          created: created.map((n) => ({
            ...n,
            live: {
              running: false,
              connected: false,
              status: null,
              currentAction: null,
              runningSince: null,
            },
          })),
          errors,
        },
        { status: 201 },
      );
    }),
    http.post(`${admin}/npcs/bulk`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (!body) return badRequest('body: expected an object');
      const action = body.action;
      let ids: string[];
      if (Array.isArray(body.ids) && body.count === undefined) {
        if (!body.ids.every((id) => typeof id === 'string' && UUID.test(id))) {
          return badRequest('ids: invalid UUID');
        }
        ids = body.ids as string[];
      } else if (body.ids === undefined && isInt(body.count, 1, 1000)) {
        const enable = action === 'spawn';
        ids = data.npcs
          .filter(
            (n) =>
              n.enabled === !enable &&
              (body.village === undefined || n.villageCode === body.village) &&
              (body.role === undefined || n.role === body.role),
          )
          .sort((a, b) =>
            enable
              ? a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
              : Number(a.role === 'storekeeper') - Number(b.role === 'storekeeper') ||
                b.createdAt.localeCompare(a.createdAt) ||
                b.id.localeCompare(a.id),
          )
          .slice(0, body.count as number)
          .map((n) => n.id);
      } else {
        return badRequest('give either ids or count (1..=1000)');
      }
      const errors: string[] = [];
      let affected: string[];
      if (action === 'spawn' || action === 'despawn') {
        const enabled = action === 'spawn';
        affected = data.npcs
          .filter((n) => ids.includes(n.id) && n.enabled !== enabled)
          .map((n) => {
            n.enabled = enabled;
            n.updatedAt = nowIso();
            return n.id;
          });
      } else if (action === 'delete') {
        affected = [];
        for (const id of ids) {
          if (find(id)) {
            deleteNpc(id);
            affected.push(id);
          } else {
            errors.push(`${id}: NPC ${id} not found`);
          }
        }
      } else {
        return badRequest('action must be spawn, despawn or delete');
      }
      log(null, 'bulk', `${String(action)} ${affected.length} NPC(s) by dev-admin`, {
        action: String(action),
        count: affected.length,
      });
      reconcile();
      return HttpResponse.json({ affected, errors });
    }),
    http.get(`${admin}/npcs/:id`, ({ request, params }) => {
      seen(request);
      const npc = find(params.id);
      if (!npc) return notFound(`NPC ${String(params.id)}`);
      return HttpResponse.json({
        npc,
        routine: routine(npc),
        tasks: tasksOf(npc.id, 20),
        state: npc.live.connected
          ? {
              state: { status: npc.live.status ?? 'idle', board: { shelf: 'B2' } },
              position: { x: 12.5, y: 0, z: -4 },
              parent: npc.placeWhereWork?.uuid ?? null,
            }
          : null,
        workplace: workplaceOf(npc.villageCode),
      });
    }),
    http.patch(`${admin}/npcs/:id`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const npc = find(params.id);
      if (!npc) return notFound(`NPC ${String(params.id)}`);
      if (!body) return badRequest('body: expected an object');
      const row = applyPatch(npc, body);
      if (typeof row === 'string') return badRequest(row);
      if (row.schedulePattern && !pattern(row.schedulePattern)) {
        return badRequest(`unknown schedule pattern '${row.schedulePattern}'`);
      }
      if (
        row.displayName !== npc.displayName &&
        data.npcs.some((n) => n.id !== npc.id && n.displayName === row.displayName)
      ) {
        return conflict(`an NPC is already named ${row.displayName}`);
      }
      Object.assign(npc, row, { updatedAt: nowIso() });
      log(npc.id, 'updated', 'configuration edited by dev-admin');
      reconcile();
      return HttpResponse.json({ npc });
    }),
    http.delete(`${admin}/npcs/:id`, ({ request, params }) => {
      seen(request);
      wrote(request);
      if (!find(params.id)) return notFound(`NPC ${String(params.id)}`);
      deleteNpc(String(params.id));
      return noContent();
    }),
    http.post(`${admin}/npcs/:id/:action`, ({ request, params }) => {
      const action = String(params.action);
      if (!['spawn', 'despawn', 'reassign', 'reset-credentials'].includes(action)) return undefined;
      seen(request);
      wrote(request);
      const npc = find(params.id);
      if (!npc) return notFound(`NPC ${String(params.id)}`);
      if (action === 'reset-credentials') {
        log(npc.id, 'credentials_rotated', 'password reset by dev-admin');
        return noContent();
      }
      if (action === 'reassign') {
        Object.assign(npc, {
          role: 'unassigned',
          roleLocked: false,
          villageCode: null,
          storekeeperSlot: null,
          schedulePattern: null,
          actionProfile: [],
          placeWhereWork: null,
          home: null,
          mealPlace: null,
          mandatoryPlace: null,
          actionConfig: {},
        } satisfies Partial<Npc>);
        log(npc.id, 'reassign', 'role reset by dev-admin');
      } else {
        npc.enabled = action === 'spawn';
      }
      npc.updatedAt = nowIso();
      reconcile();
      return HttpResponse.json({ npc });
    }),
    http.get(`${admin}/npcs/:id/logs`, ({ request, params }) => {
      seen(request);
      const q = new URL(request.url).searchParams;
      const since = Number(q.get('since') ?? 0);
      const level = q.get('level');
      if (level !== null && !LEVELS.includes(level.toUpperCase())) {
        return badRequest(`unknown level '${level}'`);
      }
      const max = level === null ? LEVELS.length - 1 : LEVELS.indexOf(level.toUpperCase());
      const items = (data.logs.get(String(params.id)) ?? []).filter(
        (l) => l.seq > since && LEVELS.indexOf(l.level) <= max,
      );
      return HttpResponse.json({ items, lastSeq: items[items.length - 1]?.seq ?? since });
    }),
    http.get(`${admin}/npcs/:id/events`, ({ request, params }) => {
      seen(request);
      return eventsOf(new URL(request.url), String(params.id));
    }),
    http.get(`${admin}/events`, ({ request }) => {
      seen(request);
      return eventsOf(new URL(request.url), null);
    }),
    http.get(`${admin}/npcs/:id/tasks`, ({ request, params }) => {
      seen(request);
      return HttpResponse.json({ items: tasksOf(String(params.id), 100) });
    }),
    http.post(`${admin}/npcs/:id/tasks`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const npc = find(params.id);
      if (!npc) return notFound(`NPC ${String(params.id)}`);
      if (!body) return badRequest('body: expected an object');
      const error = taskError(body.kind, body.params);
      if (error) return badRequest(error);
      const task: Task = {
        id: nextTask++,
        npcId: npc.id,
        kind: body.kind as Task['kind'],
        params: (body.params ?? {}) as Record<string, unknown>,
        forceOnline: body.forceOnline === true,
        status: 'pending',
        error: null,
        createdBy: 'dev-admin',
        createdAt: nowIso(),
        startedAt: null,
        finishedAt: null,
      };
      data.tasks.push(task);
      log(npc.id, 'task_created', `task ${task.id} (${task.kind}) queued by dev-admin`, {
        task_id: task.id,
      });
      return HttpResponse.json({ task }, { status: 201 });
    }),
    http.delete(`${admin}/npcs/:id/tasks/:taskId`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const task = data.tasks.find((t) => t.id === Number(params.taskId));
      if (!task) return notFound(`task ${String(params.taskId)}`);
      if (task.npcId !== params.id) {
        return notFound(`task ${String(params.taskId)} of NPC ${String(params.id)}`);
      }
      if (!['pending', 'running'].includes(task.status)) {
        return conflict(`task ${task.id} is not open`);
      }
      Object.assign(task, {
        status: 'cancelled',
        finishedAt: nowIso(),
        error: 'cancelled by an admin',
      } satisfies Partial<Task>);
      return HttpResponse.json({ task });
    }),
    http.get(`${admin}/task-kinds`, ({ request }) => {
      seen(request);
      return HttpResponse.json({
        kinds: [
          {
            kind: 'go_to_position',
            params: {
              position: '{x, y, z} (required)',
              uuid: "object the position is local to (empty = the NPC's own frame)",
              hold_s: 'seconds to stay once arrived (default 60)',
              timeout_s: 'give up after (default 300)',
            },
          },
          {
            kind: 'run_action',
            params: {
              action: 'one of `actions` (required)',
              config: "overrides of that action's config block",
              duration_s: 'focus on it for at most (default 300)',
            },
          },
          { kind: 'wait', params: { seconds: '1..3600 (required)' } },
        ],
        actions: NPC_MANUAL_ACTIONS,
        actionConfigs: {
          drive_to_factory: { destination: 'string (e.g. F0003)', max_speed_kmh: 'number' },
          take_a_walk: { radius_m: 'number', pause_s: 'integer', max_distance_m: 'number' },
        },
      });
    }),
    http.get(`${admin}/schedule/patterns`, ({ request }) => {
      seen(request);
      return HttpResponse.json({
        items: [...data.patterns].sort((a, b) => a.name.localeCompare(b.name)),
      });
    }),
    http.post(`${admin}/schedule/patterns`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (typeof body?.name !== 'string') return badRequest('name is required');
      const error = patternError(body.name, body.days);
      if (error) return badRequest(error);
      if (pattern(body.name)) return conflict(`pattern '${body.name}' already exists`);
      const created: Pattern = {
        name: body.name,
        description: typeof body.description === 'string' ? body.description : null,
        days: body.days as string[],
        source: 'panel',
        updatedAt: nowIso(),
        updatedBy: 'dev-admin',
      };
      data.patterns.push(created);
      log(null, 'pattern_created', `pattern ${created.name} created by dev-admin`);
      return HttpResponse.json({ pattern: created }, { status: 201 });
    }),
    http.get(`${admin}/schedule/patterns/:name`, ({ request, params }) => {
      seen(request);
      const found = pattern(params.name);
      return found
        ? HttpResponse.json({ pattern: found })
        : notFound(`pattern '${String(params.name)}'`);
    }),
    http.put(`${admin}/schedule/patterns/:name`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const name = String(params.name);
      const error = patternError(name, body?.days);
      if (error) return badRequest(error);
      const found = pattern(name);
      if (!found) return notFound(`pattern '${name}'`);
      Object.assign(found, {
        description: typeof body?.description === 'string' ? body.description : null,
        days: body?.days as string[],
        source: 'panel',
        updatedAt: nowIso(),
        updatedBy: 'dev-admin',
      } satisfies Partial<Pattern>);
      log(null, 'pattern_updated', `pattern ${name} edited by dev-admin`);
      return HttpResponse.json({ pattern: found });
    }),
    http.delete(`${admin}/schedule/patterns/:name`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const name = String(params.name);
      const users = data.npcs.filter((n) => n.schedulePattern === name).length;
      if (users > 0) return conflict(`pattern '${name}' is used by ${users} NPC(s)`);
      if (!pattern(name)) return notFound(`pattern '${name}'`);
      data.patterns = data.patterns.filter((p) => p.name !== name);
      log(null, 'pattern_deleted', `pattern ${name} deleted by dev-admin`);
      return noContent();
    }),
    http.post(`${admin}/schedule/import`, async ({ request }) => {
      seen(request);
      const body = (await bodyOf(request)) ?? {};
      const mode = body.mode ?? 'missing';
      if (mode !== 'missing' && mode !== 'overwrite') {
        return badRequest('JSON error: unknown variant, expected `missing` or `overwrite`');
      }
      const schedules = parseSchedules(
        typeof body.yaml === 'string' ? body.yaml : SHIPPED_SCHEDULES,
      );
      if (!schedules) return badRequest('YAML error: missing field `schedules`');
      const report = {
        created: [] as string[],
        updated: [] as string[],
        skipped: [] as string[],
        errors: [] as string[],
      };
      for (const { name, description, days } of schedules) {
        const error = patternError(name, days);
        if (error) {
          report.errors.push(error);
          continue;
        }
        const existing = pattern(name);
        if (existing && mode === 'missing') {
          report.skipped.push(name);
          continue;
        }
        const row: Pattern = {
          name,
          description,
          days,
          source: 'import',
          updatedAt: nowIso(),
          updatedBy: 'dev-admin',
        };
        if (existing) {
          Object.assign(existing, row);
          report.updated.push(name);
        } else {
          data.patterns.push(row);
          report.created.push(name);
        }
      }
      log(
        null,
        'schedules_imported',
        `schedules imported by dev-admin: ${report.created.length} created, ${report.updated.length} updated, ${report.errors.length} errors`,
        { mode },
      );
      return HttpResponse.json({ report });
    }),
    http.get(`${admin}/schedule/activity-actions`, ({ request }) => {
      seen(request);
      return HttpResponse.json({ items: data.activityActions });
    }),
    http.put(`${admin}/schedule/activity-actions`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (!body) return badRequest('body: expected an object');
      for (const [activity, actions] of Object.entries(body)) {
        if (!ACTIVITY_KEYS.includes(activity)) {
          return badRequest(
            `unknown activity '${activity}' (expected ${JSON.stringify(ACTIVITY_KEYS)})`,
          );
        }
        if (!actionsKnown(actions)) {
          const bad = Array.isArray(actions)
            ? actions.find((a) => !(NPC_CATALOGUE as readonly unknown[]).includes(a))
            : actions;
          return badRequest(`unknown action '${String(bad)}'`);
        }
      }
      Object.assign(data.activityActions, body);
      log(null, 'activity_actions_updated', 'activity mapping edited by dev-admin');
      return HttpResponse.json({ items: data.activityActions });
    }),
    http.get(`${admin}/schedule/legend`, ({ request }) => {
      seen(request);
      return HttpResponse.json({ hoursPerDay: 25, letters: LEGEND });
    }),
    http.get(`${admin}/villages`, ({ request }) => {
      seen(request);
      return HttpResponse.json({
        planet: 'tarsis_3',
        mining: data.mining.map((v) => ({
          ...v,
          npcs: data.npcs.filter((n) => n.villageCode === v.name).length,
          storekeepers: data.npcs.filter(
            (n) => n.villageCode === v.name && n.role === 'storekeeper',
          ).length,
          storekeeperSlots: 5,
          workplace: workplaceOf(v.name),
        })),
        factories: data.factories,
      });
    }),
    http.put(`${admin}/villages/:code/workplace`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const code = String(params.code);
      if (typeof body?.warehouseId !== 'string' || !UUID.test(body.warehouseId)) {
        return badRequest('warehouseId: invalid UUID');
      }
      const workplace: Workplace = {
        villageCode: code,
        warehouseId: body.warehouseId,
        warehouseCode: typeof body.warehouseCode === 'string' ? body.warehouseCode : null,
        scenename: typeof body.scenename === 'string' ? body.scenename : null,
        source: 'manual',
        updatedAt: nowIso(),
        updatedBy: 'dev-admin',
      };
      data.workplaces = [...data.workplaces.filter((w) => w.villageCode !== code), workplace];
      log(null, 'workplace_set', `workplace of ${code} set by dev-admin`);
      return HttpResponse.json({ workplace });
    }),
    http.delete(`${admin}/villages/:code/workplace`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const code = String(params.code);
      if (!workplaceOf(code)) return notFound(`workplace of ${code}`);
      data.workplaces = data.workplaces.filter((w) => w.villageCode !== code);
      return noContent();
    }),
  ];

  return { handlers, data, tokens, writes };
}
