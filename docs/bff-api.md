# BFF API

The SPA's only backend: `apps/bff` ([ADR 0011](./adr/0011-bff-hono.md)). It holds the internal
URLs of the game services, signs people in ([ADR 0023](./adr/0023-keycloak-authentication.md))
and checks every call against their permissions. Request and response shapes are the Zod schemas
of `packages/schemas` (persistence, panel) and `packages/contracts` (game services); the routes
are in `apps/bff/src/app.ts` and `apps/bff/src/routes/`.

## Rules common to every route

- **Session**: every `/api/*` route needs the `ds_admin_session` cookie, set by `/auth/callback`.
  Without it: `401 UNAUTHENTICATED`; signed in without any panel role: `403 ACCESS_DENIED`.
- **Permission**: each route needs one panel permission (`packages/schemas/src/permissions.ts`),
  derived from the person's Keycloak roles; missing: `403 FORBIDDEN`. The SPA hides what the
  person may not do, the BFF refuses it.
- **Origin**: writes coming from another origin than the panel's (`PUBLIC_URL`, else the
  request's own) are refused: `403 FORBIDDEN_ORIGIN`.
- **A service not configured** (`PERSISTENCE_URL`, `SOCIAL_URL`, `ECONOMIE_URL`,
  `UNIVERSESIMULATOR_URL`, `NPC_URL`, `MISSION_URL` unset) has no
  routes: they answer `404 NOT_FOUND`, like any unknown `/api/*` path.
- **Errors** are `{ error, message, details? }`, `error` among `ErrorCode`
  (`packages/schemas/src/common.ts`): `VALIDATION_ERROR` (400, with the Zod issues),
  `NOT_FOUND`, `ALREADY_EXISTS`, `EDIT_CONFLICT`, `UNKNOWN_OBJECT_TYPE`, `UPSTREAM_REJECTED`
  (the service refused: its status and message are passed on), `UPSTREAM_ERROR`,
  `UPSTREAM_TIMEOUT`, `UPSTREAM_UNREACHABLE`, `SIMULATION_MISSION`…
- **Writes to the game services** (`social`, `economie`, `universesimulator`, `npc`, `mission`) are each recorded as a JSON line on
  stdout, refused ones included: who, route, status (`lib/audit.ts`).

## Health and sign-in

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/health` | `{ status, version }`, no session (Docker, Kubernetes probes) |
| GET | `/auth/login` | Redirects to Keycloak (authorization code + PKCE); `?returnTo=` a panel path |
| GET | `/auth/callback` | Keycloak's return: opens the session, sets the cookie |
| POST | `/auth/logout` | Ends the session; answers `{ redirect }`, Keycloak's sign-out URL |

## Panel

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/me` | session | The person, their roles and permissions, `access` |
| GET | `/api/panel` | session | `environment`, `gameServerName`, `services` (`persistence`, `social`, `social-management`, `economie`, `economie-wallets`, `universesimulator`, `npc`, `mission`, `inventory`): the SPA shows the modules listed |
| GET | `/api/definitions` | session | Object type definitions (`*_def.json`, ADR 0006) |
| GET | `/api/definitions/:type` | session | One definition, 404 if unknown |

## Persistence (items)

Shown when `PERSISTENCE_URL` is set. Permissions by method: `GET` = `persistence.read`; the
checks (`POST /items/check`, `/items/import/check`, `/items/exists`) = `persistence.check`;
`DELETE` = `persistence.delete`; other writes = `persistence.write`. Identical reads arriving
together are coalesced for `READ_CACHE_TTL_MS` (ADR 0009).

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/api/items` | `parent_id` (roots: empty), `object_type` (a known type), `scenename`, `page`, `page_size` |
| GET | `/api/items/scenes` | Scenes in use (the create form's scene picker), kept 5 min |
| GET | `/api/items/:uuid` | 404 mapped from persistence |
| GET | `/api/items/:uuid/ancestors` | Walks `parent_id` up, depth guard (ADR 0005) |
| GET | `/api/items/:uuid/children-counts` | Count per known type (ADR 0005, 0008) |
| POST | `/api/items/check` | Coherence checks of one item before saving (ADR 0022) |
| POST | `/api/items/import/check` | Checks of an import's items (ADR 0019) |
| POST | `/api/items/exists` | `{ uuids[] }` → the existing ones (ADR 0004) |
| POST | `/api/items` | Create; **409 `ALREADY_EXISTS`** when the UUID exists (persistence would upsert); unknown types refused (ADR 0015) |
| POST | `/api/items/:uuid/duplicate` | With its children, next to a player or an item (ADR 0017); 201 with what was created |
| PUT | `/api/items/:uuid` | `{ object_type, base, changes, removed, force }`: re-read and field-level merge, **409 `EDIT_CONFLICT`** with the keys the game changed meanwhile (ADR 0009); 404 if unknown (no upsert) |
| DELETE | `/api/items/:uuid` | 204; persistence does not notify the game |
| GET | `/api/bodies/:uuid/map` | Everything placed on a celestial body (ADR 0018); `hide` (types counted, not loaded), `include` (one item loaded anyway) |

## `social`

Shown when `SOCIAL_URL` is set; every route needs `social.moderate` (`moderator`, `admin`,
`supervisor`) on top of its own. Reading and moderation call `social` **with the person's
token** (its Admin API, which checks the roles again and logs the actor); organisation
management calls its Interne API **as `svc-admin`**, listed as `social-management` when
`SVC_ADMIN_CLIENT_SECRET` is set (ADR 0023 › Social — management).

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/social/stats` | `social.moderate` | Moderation overview |
| GET | `/api/social/log` | same | Moderation log |
| GET | `/api/social/reports` · `/reports/:id` | same | Reports |
| PATCH | `/api/social/reports/:id` | the report's level¹ | `{ status, note? }`: claim (`reviewing`) first, then `resolved` or `dismissed`; 409 otherwise |
| POST | `/api/social/reports/:id/escalate` | the report's level¹ | One level up, back to `open` |
| GET | `/api/social/sanctions` | `social.moderate` | Sanctions |
| POST | `/api/social/players/:playerId/sanctions` | `social.moderate`; `social.sanctionSevere` for a suspension or ban | Warn, mute, suspend, ban |
| DELETE | `/api/social/sanctions/:id` | `social.moderate` | Lift |
| POST | `/api/social/players/:playerId/reputation` | `social.reputation` | `{ delta, reason }` |
| GET | `/api/social/players` · `/players/:playerId` · `/players/:playerId/profile` | `social.moderate` | Search, player sheet, profile |
| GET | `/api/social/corporations` · `/:corporationId` · `/:corporationId/members` · `/:corporationId/subsidiaries` | same | Corporations |
| GET | `/api/social/politics` · `/:entityId` · `/:entityId/members` · `/:entityId/children` | same | Political entities |
| POST · PATCH · DELETE | `/api/social/corporations`, `/corporations/:corporationId` | `social.corporationWrite` | Create, edit, disband (as `svc-admin`) |
| POST | `/api/social/corporations/:corporationId/transfer` | same | Transfer the CEO |
| PATCH · DELETE | `/api/social/corporations/:corporationId/members/:playerId` | same | Change a member's rank, remove them |
| POST · PATCH · DELETE | `/api/social/politics`, `/politics/:entityId` | `social.politicsWrite` | Create, edit, disband (as `svc-admin`) |
| POST | `/api/social/politics/:entityId/transfer` | same | Transfer the head office |

¹ `social.moderate` for a report at the `moderator` level, `social.reportsAdmin` at `admin`,
`social.reportsSupervisor` at `supervisor` (the panel's rule, ADR 0024 › Update).

## `economie`

Shown when `ECONOMIE_URL` is set. The dashboard calls its Admin API with the person's token;
everything else its Interne API **as `svc-admin`** (listed as `economie-wallets`), each route
opened by the capability role of `economie`'s README held by the person (ADR 0023 › Economie).
`:holder` is `players`, `npcs`, `corporations` or `politics`. Ledger ids (`int64`) are sent back
as strings.

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/economie/stats` | `economie.dashboard` | Money supply, volume, taxes, richest |
| GET | `/api/economie/wallets/:holder/:id` · `…/transactions` | `economie.walletRead`; `economie.politicsRead` for `politics` | A wallet or treasury, its ledger |
| POST | `/api/economie/wallets/:holder/:id/credit` · `…/debit` | `economie.walletCredit` / `economie.walletDebit`; `economie.politicsManage` for `politics` | `{ amount, type, reference, externalId }`; types split by direction (`code.ts` › `MOVEMENT_TYPES`) |
| POST | `/api/economie/politics/:id/mint` | `economie.moneyIssue` | Issue money into a country's or federation's treasury |
| GET · PUT | `/api/economie/politics/:id/settings` | `economie.politicsRead` / `economie.politicsManage` | Tax rates, minting policy and ceiling |
| POST | `/api/economie/politics/:id/taxes/assess` | `economie.politicsManage` | Book a tax assessment |
| GET · PUT | `/api/economie/corporations/:id/settings` | `economie.corporationRead` / `economie.corporationManage` | Internal tax on donations, donations allowed, fiscal home |
| PUT | `/api/economie/corporations/:id/affiliation` | `economie.corporationManage` | `{ politicalEntityId \| null }`: the fiscal home |

## `universesimulator` (Simulation)

Shown when `UNIVERSESIMULATOR_URL` is set ([ADR 0025](./adr/0025-universe-simulation-section.md)).
Every route calls its Admin API (`/api/admin/*`) **with the person's token**: `universesimulator`
checks the moderation role itself (reads `moderator`+, writes `admin` or `supervisor`); the panel
mirrors it with `simulation.view` (the whole section) and `simulation.manage` (the writes).
**Villages are the nodes** of the simulation (the service's ADR 0013): thresholds, flows, routes
and local prices are per village, a village's stock is the sum of its warehouses (cargo depots),
capacities are per warehouse. Inputs are validated with the pinned contract (and
`contracts/universesimulator/code.ts`) before any call (400 `VALIDATION_ERROR`); the service's
own refusals keep their status (403, 404, 409 `ORDER_CLOSED` / `TICK_RUNNING`; a 400 of its own,
such as a main warehouse of another village or `INVALID_REFERENCE` for an unknown id, comes back
as `400 UPSTREAM_REJECTED` with its message). Ids follow the contract's hex pattern (persistence
UUIDs have no RFC version bits). `?federation=` (optional) picks a federation; the first one by
default.

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/simulation/dashboard` | `simulation.view` | Tick state, treasury, open orders, missions on offer, villages below their threshold |
| GET | `/api/simulation/network?body=` | `simulation.view` | Villages (positions, summed stocks, their warehouses), routes and active legs between villages; plus `projection`, `projectionIssue`, `positions` (below) |
| GET | `/api/simulation/villages?entity` | `simulation.view` | Villages with their summed stocks and warehouse counts |
| GET | `/api/simulation/villages/:id` | `simulation.view` | A village: summed stocks, its warehouses with their own stocks (main marked), thresholds, flows, capacities, mineral sources, local prices, incoming legs |
| GET | `/api/simulation/warehouses/:id` | `simulation.view` | A warehouse: its village, stocks, capacities |
| GET | `/api/simulation/orders?status&kind&resource&village&limit&offset` | `simulation.view` | Supply orders with their legs, newest first; `village`: the path goes through it |
| GET | `/api/simulation/orders/:id` | `simulation.view` | One order |
| GET | `/api/simulation/prices` | `simulation.view` | Federation price index |
| GET | `/api/simulation/price-history?resource&from` | `simulation.view` | Index of a resource since `from` (24 h by default) |
| GET | `/api/simulation/local-prices?resource` | `simulation.view` | Buy / sell per village, largest spread first |
| GET | `/api/simulation/stock-history?village\|warehouse&resource&from` | `simulation.view` | Snapshots of a village (its warehouses summed, with its threshold and target) or of one warehouse; one of the two required |
| GET | `/api/simulation/incoming?village` | `simulation.view` | Active legs heading to a village |
| GET | `/api/simulation/mint-events?limit` | `simulation.view` | Money issued into the treasury |
| GET | `/api/simulation/resources` · `/entities` · `/simulation` | `simulation.view` | Catalogue, political entities, tick settings |
| GET | `/api/simulation/village-policies?village` · `/warehouse-capacities?village\|warehouse` | `simulation.view` | Thresholds per village, capacities per warehouse |
| POST | `/api/simulation/simulation/pause` · `/resume` · `/tick` | `simulation.manage` | Pause, resume, run a tick now |
| POST | `/api/simulation/orders/:id/cancel` | `simulation.manage` | 204; cancels its mission and releases its hold |
| PUT | `/api/simulation/villages/:id` | `simulation.manage` | `{ mainWarehouseId?, active? }`, at least one; the main warehouse must be one of the village's |
| PUT | `/api/simulation/village-policies` | `simulation.manage` | Upsert `{ villageId, resourceId, minThreshold, targetLevel }`: whole numbers, `0 ≤ minThreshold ≤ targetLevel` (`code.ts` › `zPanelVillagePolicy`) |
| DELETE | `/api/simulation/village-policies/:village/:resource` | `simulation.manage` | 204 |
| PUT | `/api/simulation/warehouse-capacities` | `simulation.manage` | Upsert `{ warehouseId, resourceId, capacity }`: whole units ≥ 0, or `null` for no limit (required) |
| DELETE | `/api/simulation/warehouse-capacities/:warehouse/:resource` | `simulation.manage` | 204 |
| POST | `/api/simulation/flows` | `simulation.manage` | 201; `{ villageId, resourceId, ratePerHour, source?, label? }`, negative rate = consumption, source `population` · `industry` · `manual` (default), label trimmed, 1–128 characters |
| PUT | `/api/simulation/flows/:id` | `simulation.manage` | `{ ratePerHour?, label? }`, at least one; `label: null` clears it |
| DELETE | `/api/simulation/flows/:id` | `simulation.manage` | 204 |

**Positions on the map.** `?body=<planet persistence UUID>` places each village's and each of
its warehouses' cached position (`x`, `y`, `z`, relative to the planet centre like any POI
standing on it) in the frame of that planet's map (`/api/bodies/:uuid/map`, ADR 0018):
`positions[]` holds `{ id, kind: village | warehouse, lat, lon, altitude, x, y }`, so a marker
lands where `/map/$uuid` draws the POI; `projection` names the body, its reference radius and
centre. The frame is the one the BFF keeps for that body (computed on its first map, by building
it if needed). Nothing is projected — `projection: null`, `positions: []`, the raw positions
left in `villages` — and `projectionIssue` says why: `noBody` (no `body` given),
`noPersistence` (`PERSISTENCE_URL` unset), `bodyNotFound`, `unreachable` (persistence failed),
`noFrame` (no positioned item on the body). One without a cached position is left out of
`positions`. The SPA passes the planet from the URL, or the persistence parent of the villages'
POIs when the person may read persistence.

## `npc` (NPCs)

Shown when `NPC_URL` is set ([ADR 0031](./adr/0031-npc-section.md)). Every route calls the
service's Admin API (`/api/admin/*`) **with the person's token**: the service checks the
moderation role itself (reads `moderator`+, writes `admin` or `supervisor`); the panel mirrors it
with `npc.view` (the whole section) and `npc.manage` (the writes). Inputs are validated with the
pinned contract (and `contracts/npc/code.ts`) before any call (400 `VALIDATION_ERROR`); the
service's own refusals keep their status (403, 404, 409 — a pattern in use, a task no longer open,
a name taken —, 502 when Keycloak fails; a 400 of its own comes back as `400 UPSTREAM_REJECTED`
with its message). Task, event and current-action ids are `int64`: sent as numbers.

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/npc/settings` | `npc.view` | Global switch (`npcsEnabled`, who changed it) and counts: total, enabled, running, connected |
| PUT | `/api/npc/settings` | `npc.manage` | `{ npcsEnabled }`: connects or disconnects every enabled NPC |
| GET | `/api/npc/npcs?village&role&enabled&online&q&limit&offset` | `npc.view` | The roster with live status, oldest first; `total` counts the matches before `online` |
| POST | `/api/npc/npcs` | `npc.manage` | 201; `{ count 1–50, role unassigned·villager·custom, enabled, schedulePattern?, actionProfile?, firstName?/lastName? (count 1) }`; `{ created, errors }` |
| POST | `/api/npc/npcs/bulk` | `npc.manage` | `{ action spawn·despawn·delete, ids \| count 1–1000, village?, role? }`, ids or count; by count, spawn picks the oldest disabled, despawn and delete the most recent enabled (storekeepers last); `{ affected, errors }` |
| GET | `/api/npc/npcs/:id` | `npc.view` | The NPC, its routine (pattern grid, planetary day and hour, activity, allowed actions), recent tasks, FSM state, workplace |
| PATCH | `/api/npc/npcs/:id` | `npc.manage` | The contract's fields only, one at least; `null` clears a nullable field |
| DELETE | `/api/npc/npcs/:id` | `npc.manage` | 204; its runtime, Keycloak user and row |
| POST | `/api/npc/npcs/:id/spawn` · `/despawn` · `/reassign` | `npc.manage` | Enable, disable, back to the automatic assignment |
| POST | `/api/npc/npcs/:id/reset-credentials` | `npc.manage` | 204; a new random Keycloak password |
| GET | `/api/npc/npcs/:id/logs?since&level` | `npc.view` | Log lines after `since` (in the service's memory), at `level` or above; `lastSeq` to poll on |
| GET | `/api/npc/npcs/:id/events?kind&before&limit` · `/api/npc/events?…` | `npc.view` | Key events, newest first (an NPC's, or every one's and the service-wide ones); `before` an event id |
| GET | `/api/npc/npcs/:id/tasks` | `npc.view` | Open tasks first, then the most recent |
| POST | `/api/npc/npcs/:id/tasks` | `npc.manage` | 201; `go_to_position {position, uuid?, hold_s?, timeout_s?}`, `run_action {action, config?, duration_s?}`, `wait {seconds}` (seconds ≤ 3600), `forceOnline?` |
| DELETE | `/api/npc/npcs/:id/tasks/:taskId` | `npc.manage` | Cancels an open task; 409 once finished |
| GET | `/api/npc/task-kinds` | `npc.view` | Task kinds and their parameters, the actions run by hand, their config fields |
| GET · POST | `/api/npc/schedule/patterns` | `npc.view` / `npc.manage` | Shift patterns; create `{ name [a-z0-9_]{1,64}, description?, days 1–14 of the same width, letters T t r a . l }` (201, 409 when it exists) |
| GET · PUT · DELETE | `/api/npc/schedule/patterns/:name` | `npc.view` / `npc.manage` | One pattern; PUT `{ description?, days }`; DELETE 204, 409 while NPCs follow it |
| POST | `/api/npc/schedule/import` | `npc.manage` | `{ mode missing·overwrite, yaml? }` (absent: the service's `config/schedules.yaml`); `{ report: created, updated, skipped, errors }` |
| GET · PUT | `/api/npc/schedule/activity-actions` | `npc.view` / `npc.manage` | Activity → actions (`work`, `transmission`, `meal`, `mandatory`, `off`, `always`); PUT replaces the activities given |
| GET | `/api/npc/schedule/legend` | `npc.view` | Hours per day and the meaning of each grid letter |
| GET | `/api/npc/villages` | `npc.view` | Mining villages (NPCs, storekeepers / slots, workplace, Factory) and Factory villages |
| PUT · DELETE | `/api/npc/villages/:code/workplace` | `npc.manage` | Set by hand `{ warehouseId, warehouseCode?, scenename? }`; DELETE 204 (resolved again at the next assignment) |

The service's debug routes (`/debug/world`, `/debug/routes/…`) and its Keycloak consistency
report (`/health/keycloak`) are not used by the panel.

## `mission`

Shown when `MISSION_URL` and `svc-admin`'s secret are set (listed as `mission`): its README has
no Admin section, so its catalogue is read through its Interne API **as `svc-admin`**, for the
capability role of its README held by the person (ADR 0023 › Mission). One write: cancelling a
mission (ADR 0028).

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/mission/missions` | `mission.read` | Every mission, any status, newest first: `status`, `category`, `kind`, `limit` (1–100), `offset` → `{ missions, total, limit, offset }` |
| GET | `/api/mission/missions/:id` | `mission.read` | One mission whatever its visibility → `{ mission, objectives, assignments, players, group, chain, summary, places? }`; 404 if unknown. `places`: its objectives' POIs from `inventory` by id (`null`: unknown to `inventory`), for `inventory.read` (ADR 0026); left out without it, when `INVENTORY_URL` is unset or when `inventory` does not answer |
| POST | `/api/mission/missions/:id/cancel` | `mission.write` | Cancels a mission and its active assignments, its escrow refunded → the mission; 404 if unknown, 409 (passed on) when completed. **409 `SIMULATION_MISSION`** for a mission of `universesimulator` (`scriptId` `usim:leg:…`), cancelled through its order (`POST /api/simulation/orders/:id/cancel`), never here |
