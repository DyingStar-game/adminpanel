# 0031. NPCs section: the `npc` service in the panel

- **Status:** Proposed
- **Date:** 2026-10-25 (written as 0026; renumbered 0031 on 2026-10-26, 0026 being taken by
  the mission objective schematics)
- **Deciders:** maintainer, back team (`npc`)
- **Scope:** Game services (`npc`), Frontend
- **Builds on:** [ADR 0024](./0024-game-services-social-first.md) (the per-service pattern),
  [ADR 0023](./0023-keycloak-authentication.md) (permissions, calling the services),
  [ADR 0025](./0025-universe-simulation-section.md) (the same Admin API model),
  [ADR 0009](./0009-live-refresh-by-polling.md) (live refresh)

## Context

The back team wrote a new game service, **`npc`** (Rust, axum, PostgreSQL), which runs the
non-player characters of the game server: each NPC is a Keycloak user (group `npcs`, realm role
`npc`) that the service connects to Horizon and drives with a finite-state machine and a catalogue
of actions (storekeepers of a mining village's cargo depot, villagers walking, drivers going to
the Factory…). Its README, OpenAPI and code (`DyingStar-game/services` › `npc/`, read 2026-10-25
from the back team's working copy, branch `feature/NPC`: **not on GitHub `develop` yet**)
describe:

- **the roster** in PostgreSQL: names (generated, or imposed), `enabled`, a **role**
  (`unassigned` decided at the first spawn — storekeeper of its village for the first five,
  villager after —, `storekeeper` with a slot 1–5, `villager`, `custom` configured by hand), a
  village, a **shift pattern**, an **action profile**, four **places** (work, home, meal,
  mandatory activities: an object's UUID and a position local to it), per-action timing and
  config, the Keycloak account state;
- **a global switch**: an NPC runs (is connected to Horizon) when the switch is on and it is
  enabled, applied by a reconciler within a second or two; off shift, a running NPC is not
  connected;
- **shift patterns**: a grid of planetary hours (25 on Tarsis III) per rota-day, one letter per
  hour (`T` work, `t` handoff, `r` meal, `a` mandatory activities, `.` off, `l` leisure — read as
  off for now), and the **activity → actions** mapping (with `always`), imported from its
  `config/schedules.yaml` and editable;
- **manual tasks** that pre-empt the schedule: `go_to_position`, `run_action`, `wait`, optionally
  connecting the NPC off shift (`forceOnline`);
- **log lines** kept in memory per NPC (lost on restart) and **events** in the database;
- **villages**: the mining villages of its world data, their storekeepers and the cargo depot
  they work at (found by universesimulator, the world data, or set by hand).

Its **Admin API** (`/api/admin/*`) was written for this panel. It takes **the person's token
with a moderation role** (`src/auth/mod.rs` › `MODERATION`: `moderator`, `admin`,
`supervisor`, ported from universesimulator); **every write needs `admin` or `supervisor`**
(`Caller::require_admin`). Errors are `{ error, message }`. The service has no Traefik route: the
cluster's panel reaches it at `http://service-npc:9400` (`kubernetes` › `dyingstar-admin` ›
`services.npcUrl`).

The maintainer's request (translated): create NPCs, spawn them, give them tasks by hand from the
panel; change their routine and other settings; see the current routine and the logs of what
they do; a button to turn the NPCs on and off on the servers, then add N NPCs and remove N (or
pick which).

## Options considered

How the log lines reach the panel:

1. **Polling** `GET /npcs/{id}/logs?since=<lastSeq>` and appending — what the service offers,
   like every live view of the panel (ADR 0009).
2. **A stream** (SSE or WebSocket through the BFF) — fresher, but the service has none and the
   BFF holds no long-lived upstream connection today.

How the shift grid is edited:

- **A. A text field per day** (the YAML's strings) — trivial, error-prone (25 characters to
  count).
- **B. A painted grid**: days × hours, each cell coloured by its letter, painted with the letter
  picked in the legend (click or sweep).

## Decision

We will add `npc` to the services of ADR 0024, with **option 1** for the logs (every 3 s while
the tab is open) and **option B** for the grid, as a section **NPCs** in the sidebar's "Game
world" group.

### The per-service pattern, for `npc`

| Piece | `npc` |
|---|---|
| Configuration | `NPC_URL`, without `/api` (cluster: `http://service-npc:9400`; no Traefik route on minikube: a port-forward); unset, hidden |
| Contract | `packages/contracts/src/npc/openapi.yaml`, pinned **from the back team's working copy** (`source.json` › `commit: null` and the copy's sha256 until it is pushed to `develop`; the GitHub sync test skips it while GitHub answers 404, `make contracts-update` keeps the copy and records the commit once it is there); `code.ts` holds the panel's stricter input schemas, from the service's code |
| BFF | `clients/npc.ts` on `clients/upstream.ts`; curated routes `/api/npc/…` (`docs/bff-api.md`), **all with the person's token** on the Admin API; writes recorded by `auditWrites`; `int64` ids (tasks, events) sent as numbers (`jsonSafe`) |
| Permissions | `npc.view` (`moderator`, `admin`, `supervisor`) and `npc.manage` (`admin`, `supervisor`), mirroring the service's own checks (ADR 0023 › NPC) |
| Tests | `createNpcMock` in `packages/testing`, typed by the generated types and checked against the contract, following the service's code (`admin/npcs.rs`, `schedule.rs`, `misc.rs`, `db/*.rs`, `actions/manual.rs`, `schedule_import.rs`): five NPCs of M0012 (two storekeepers, a villager on a manual task, one not assigned, one whose Keycloak account failed), the shipped patterns, tasks, events and log lines |
| SPA | Routes `/npcs?tab=…` (roster, routines, activity, villages) and `/npcs/$npcId?tab=…` (overview, routine, tasks, logs, events, config), shown when the service is configured and `npc.view` is held |

Out of scope: the service's debug routes (`/debug/world`, `/debug/routes/…`) and its Keycloak
consistency report (`/health/keycloak`).

### The views

- **Header** — the global switch with the counts (total, enabled, running, connected), polled
  every 5 s; turning it on or off is confirmed. **Add NPCs**: create N new ones (1–50, a role,
  spawned at once or not) and / or spawn N existing disabled ones (the oldest first). **Remove
  NPCs**: despawn or delete, the rows selected in the roster or a count picked by the service
  (the most recent enabled ones, storekeepers last), optionally in one village; a deletion needs
  the word "delete" typed.
- **Roster** — filtered by name or login, village, role, enabled, connected, 50 a page: role
  (and slot), village, enabled, live state (connected / running off shift / stopped), current
  action (a manual task marked), last seen; rows selected for the bulk actions (kept across
  pages), spawn or despawn per row. Polled every 5 s.
- **Routines** — the patterns, the one picked (URL state) in the grid editor (name for a new one,
  description, days × hours painted with a legend letter, days added or removed, 1–14), the
  activity → actions mapping (toggles among the actions the service runs by hand and those
  already mapped; only the activities changed are sent), and the import of `schedules.yaml`
  (the service's file or pasted YAML, `missing` or `overwrite`) with its report.
- **Activity** — the events of every NPC and the service-wide ones, newest first, by kind,
  older ones loaded on demand.
- **Villages** — the mining villages with their NPCs, storekeepers out of the slots, workplace
  (and its source) and Factory; `npc.manage` sets or clears a workplace by hand.
- **An NPC** (polled every 3 s) — overview (live and FSM status, current action, role, village,
  slot, workplace, Keycloak state, dates; spawn / despawn, reassign and reset the password
  confirmed, delete with the typed word); routine (the week grid with the cell of now outlined —
  the rota day wraps over the pattern's days —, the activity now and its allowed actions, the
  pattern changed or cleared, a link to the editor); tasks (status, why one failed, cancel an
  open one confirmed, a new one: position local to an object, an action with config overrides
  offered from the fields the service lists, or a wait; `forceOnline`); logs (appended every
  3 s, minimum level, auto-scroll, cleared view); events; configuration (every editable field,
  only the changed ones sent, places cleared, timing and config as JSON checked in the form, the
  service's refusals shown as it words them).

Write actions are hidden (or the controls disabled) without `npc.manage`. Forms are on React
Hook Form + Zod (ADR 0010); the rules of the service are checked before the call
(`contracts/npc/code.ts`): counts, a pattern's name and grid (letters, days of the same width),
task parameters (seconds ≤ 3600, unknown fields refused), the patch's fields, a bulk call with
either ids or a count.

## Consequences

- One more contract, client, route group, permission pair, mock and SPA section, following ADR
  0024's checklist; no new dependency. A new live rate, `npc` (3 s), for the NPC on screen and its
  logs (ADR 0009's lists stay at 5 s).
- The contract pin has no commit until the back team pushes `npc` to `develop`: the GitHub sync
  test skips it (404) and `make contracts-update` must be run again then.
- Logs are polled and kept in memory by the service: lines are lost when it restarts, and a
  viewer who changes the level reads them again from the start.
- The writes (switch, create, spawn, despawn, delete, tasks, patterns, mapping, workplaces) act on
  the live game server: confirmed in the SPA where they cannot be undone, recorded by the BFF
  (`audit: service-write`), checked by the service on the person's token.

### Open questions

1. The back team: push `npc` (and its OpenAPI) to `develop`, then re-pin.
2. Minikube: `npc` has no Traefik route (the cluster's panel calls it in-cluster); a route like
   `/npc` for local development, or a documented port-forward?
3. The realms: `admin` and `supervisor` still exist in our local realm only (ADR 0023): until the
   back team creates them, nobody can write on minikube or pre-production.
4. `delete` by count picks only enabled NPCs (the service's `pick_for_toggle`): deleting disabled
   ones needs them selected in the roster.
