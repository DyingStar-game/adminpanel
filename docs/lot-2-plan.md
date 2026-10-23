# Lot 2 — Sign-in and the game services (social first): implementation plan

Scope and decisions: [ADR 0023](./adr/0023-keycloak-authentication.md) (Keycloak sign-in,
permissions, one panel per environment) and [ADR 0024](./adr/0024-game-services-social-first.md)
(game services, `social` first). This plan only orders the work and keeps where we are; when a
step needs a new decision, it goes into an ADR before coding. **Read this file first when
starting a session on lot 2.**

## Status (2026-10-23, O.5 a mission's page checked live on minikube)

| Step | Status | Commit |
|------|--------|--------|
| A. Keycloak sign-in (BFF as OIDC client, session, refresh, logout, sign-in / access denied pages) | **Done** | `a6e2eef` |
| B. Interim permissions (persistence roles, BFF 403 per route, SPA hides actions) | **Done** | `a6e2eef` |
| C. One panel per environment, one game server per environment (selector removed, environment badge) | **Done** | `a6e2eef` |
| D. Local Keycloaks: compose (default) and the back team's minikube (`make up K8S=1`) | **Done** | `a6e2eef` |
| E. Service contracts: `packages/contracts` (pinned OpenAPI, generated Zod, GitHub sync test) | **Done** | `ae3dce8` |
| F. Social reading: moderation overview, reports, sanctions, player sheet | **Done** | `ae3dce8` |
| G. Players: search, fuller sheet (sanction banner, presence, identity, RP, organisations) | **Done** | `b1e7166` |
| H. Player sheet → persistence item and map (same id everywhere) | **Done** | `cd404bc` |
| I. Acting on players: sanction (warn, mute; suspend, ban for `admin`+), lift, reputation | **Done** | `c1c3a05` |
| J. Report actions: claim, then confirm, dismiss or escalate (rules of ADR 0024 › Update) | **Done** (to try live) | `bcb6bb2` |
| K. Organisations, reading: corporations, political entities | **Done** (to try live) | `3f577f6` |
| L. Replace `SERVERS` / `X-Server-Id` by the panel's own settings (`GAME_SERVER_NAME`, `PERSISTENCE_URL`, `SOCIAL_URL`) | **Done** | `cd2a70d` |
| M. Final roles × actions matrix (ADR 0023): `social` and `economie` decided (their READMEs' roles); persistence's 🟡 cells left | Persistence: the maintainer's call | — |
| N. Organisation management (`/api/internal/*` through `svc-admin`; rights decided, ADR 0023) | **Done** on minikube (to try live); pre-production waits for `svc-admin` | `96506c7` |
| O. Next services, one by one with the ADR 0024 pattern: `economie` first (1. reading, 2. settings, 3. money movements), then `mission` (4. catalogue, 5. a mission's page), `inventory`, `market` | **O.1** (`ca9b4b0`), **O.2** (`64ffd9e`), **O.3 done** (to try live); **O.4**, **O.5 done** (not committed; both checked live on minikube); then `inventory` | — |

Order agreed with the maintainer on 2026-10-08: I (acting on players) before K (organisations),
since the player sheet is where moderators look first.

### Parked (maintainer, 2026-10-23): `mission` and `inventory` from pre-production

Instead of minikube's test data, the local panel could read pre-production's `mission` and
`inventory`, as it reads pre-production's persistence: both are called as `svc-admin` only (a
`client_credentials` token, no redirect, so the "no localhost redirect" rule does not stop it),
the person still signing in locally. Needed: their public URLs, pre-production's `svc-admin`
secret (ADR 0023, open question), a BFF setting taking `svc-admin`'s token from
`auth-preprod…` while sign-in stays local (one issuer for both today), and a guard so the seed
never runs against pre-production. `social`, `economie` and `universesimulator`'s Admin routes
take the person's token: they cannot follow. Gain: the real missions published by
pre-production's simulation. E.g. `make up PREPROD_SERVICES=1`. Not started: waiting for the
maintainer.

- **Known (2026-10-23)**: `https://services-preprod.dyingstar-game.space/mission` and `…/inventory`
  (maintainer), reachable from a developer's machine; `/api/health` answers 200 without a token,
  `/api/internal/*` 401 without one; both serve the very `openapi.yaml` pinned from `develop`
  (`mission` with PR #37's detail route). Pre-production's `dyingstar-admin` only redirects to
  `https://admin-preprod.dyingstar-game.space/auth/callback` (`kubernetes` › `keycloak-managed/
  preprod/04-realm-import.yaml`): signing the local panel in there needs a `localhost` redirect
  the back team refused on 2026-10-08.
- **Still to get from the back team**: either that `localhost` redirect (or a dev client) with its
  secret and the maintainer's roles there — then the whole local panel can run on
  pre-production —, or only a read-only service account (`mission:read`, `inventory:read`,
  audiences `mission-api`, `inventory-api`) and its secret, `client_credentials` allowed from
  outside; and whether pre-production's `universesimulator` publishes missions.

### 2026-10-23 — ADR 0028, cancelling a mission, where to resume

- **ADR 0028 accepted** (maintainer, 2026-10-23): a mission of `universesimulator` (`scriptId`
  `usim:leg:…`) is cancelled **through its supply order** (`simulation.manage`): cancelled alone,
  the simulation publishes it again (up to `SIM_LEG_MAX_ATTEMPTS`, then fails the order). Any
  other open mission is cancelled in `mission` as `svc-admin` for `mission:write` (README ›
  Interne, develop `0c14db4`), its escrow refunded; the BFF refuses a simulation mission there
  (`409 SIMULATION_MISSION`). The order is found from the objectives' `payload` (`orderId`,
  `legId`, written by `universesimulator`'s publisher), the latest 100 orders as a fallback. The
  catalogue names the simulation as issuer; the transits tab shows a published leg's mission by
  its title and status.
- **Built**: `POST /api/mission/missions/:id/cancel` (audited), `MissionCancel` in a mission's
  page actions, `LegMission` in the orders' timeline, `mission.write` (opening `mission.read`
  too), `mission:write` in both local realms and ADR 0023 › Mission; the mock gains the water
  leg's mission and `cancelMission`. `make check` passes: the definitions snapshot updated to
  `horizonserver` `3f54dc1` (types `food` and `tool`, new properties, none removed) and
  `social`'s contract re-pinned to `7106778` (standing routes, political entities without a head,
  `standing` on every profile, added to its mock).
- **Checked by the maintainer** (2026-10-23): cancelling a mission works, and the crate views
  (ADR 0029). A simulation mission's cancel still waits for one to exist (minikube's
  `universesimulator` has no world imported; its publisher is refused by `mission`, below).
- **`universesimulator` re-pinned** from `develop` (`a863c00`, same file as the working copy):
  ADR 0025's open question 1 closed.
- **For the back team**: pre-production's `svc-admin` needs `mission:write` (the maintainer
  asks); `universesimulator`'s publisher (`build_mission`, develop `0c14db4`) sends `transport`
  objectives with `params: { itemId }`, refused by `mission`'s strict `transport` kind
  (`goodType`, `source`, `zone`), and mining legs as `deliver_items`, a kind `mission` no longer
  has: no simulation mission can be published against today's `mission`; `mission`'s README
  still lists both `…/objectives/:objectiveId/progress` routes its code dropped.

### 2026-10-23 — ADR 0027, a mission's places on a map, where to resume

- **Branch `feature/missions`** (on `origin/develop`, with the simulation section of PR #2; the
  maintainer allowed commits on it, PR once satisfied). The work of lot 2 step O was carried
  over from `develop`'s working tree; ADR 0025 is the simulation's, the objective schematics are
  ADR 0026.
- **ADR 0027, accepted** (maintainer, 2026-10-23: the strip of pins "not usable visually", "an
  equivalent of the network map"): a "Places" map on a mission's page, in `MetricMap` like the
  network map, every objective's POIs as discs by role (load, deliver, reach) with their names,
  zones as circles, a `transport` as a line (dashed until loaded) with its head; a frame of the
  places themselves (no persistence read: a planet cannot be found from a POI's scene, two items
  share `tarsis_3.tscn`); places in open space or unknown listed under it; objective and places
  chosen from either side. The objective cards list their places as text.
- **Checked live on minikube** (GET only, as `ynotna`): the transport's two places 196 km apart,
  the foundry's 40 m zone, the relay station listed in open space.
- **Update, landmarks** (maintainer, same day): the planet's fixed objects around the places,
  shown or hidden by type as on the persistence map (ADR 0027 › Update), in the planet map's
  frame for `persistence:read`. **Seed on real data**: its POIs stand on SandBox's objects read
  from persistence (GET only): M0066's cargo depot and clinic, its mining depot → the nearest
  mining zone (132 km), survey sites near M0051 (1,640 km), F0015's main square, the station
  Palaka-Pital; mission titles name them. `make reset-mission` run again for it (2026-10-23);
  the eight previous POIs deleted by the seed. Checked in a browser: the transport among 780
  landmarks, by type.
- **Card rearranged, steps from 1, simulation links** (ADR 0026 › Update): places in a column
  joined by a dotted line, details on a click; a leg's mission opens from the Simulation's
  orders, a mission's page shows its supply order (latest 100 orders). Ids copyable everywhere
  (`IdLabel`, `EntityLink`). minikube's `universesimulator` has no federation yet (2026-10-23):
  the links were checked against its mock only.

### 2026-10-23 — ADR 0026, objective schematics

- **ADR 0026 accepted** (maintainer, 2026-10-23): a declarative schematic per objective kind
  (`lib/objectiveSchematics/`), its "what to do" sentence in `en` / `fr`, the POIs named from
  `inventory` for `inventory:read` (ids only without it), no carrier position.
- **Built**: a mission's page shows one card per objective (`MissionObjectives`, replacing the
  table): the sentence filled with the goods, quantity and places, the route (`ObjectiveRoute`:
  load → deliver, the distance along the surface, where the goods are for a `transport`), each
  place's name, body, latitude / longitude, altitude and zone, the progress as its kind reads
  it, the parameters folded. BFF: `inventory`'s client (`INVENTORY_URL`, `svc-admin`, a minute's
  cache), `places` added to `GET /api/mission/missions/:id` for `inventory.read`, left out when
  `inventory` is silent. Contract: `inventory` pinned, not generated (question 21). Rights:
  `inventory:read` in ADR 0023 › Inventory and both local realms. Seed: eight real POIs in
  `inventory` (`system` owner, found again by name), used by the missions' objectives.
- **Checked live** (GET only): the eight POIs `make seed-social` created parse with `zPoiView`; an
  unknown POI answers 404.
- **Live on minikube** (2026-10-23, at the maintainer's request): the client role
  `inventory:read` created on minikube's `dyingstar-admin` and given to `ynotna` and `dev-admin`
  (admin API; the partial import would skip existing users); `mission`'s database emptied and
  seeded again (`make reset-mission`, new: `docker/minikube/service-reset.sql`, shared with
  `reset-social`): every seed body accepted (bonus, partial hand-in, chain, transport's two POIs,
  item reward). Checked in a browser as `ynotna` (GET only): every mission's page names its
  places (e.g. Vance depot → Drill site 7, 196 km along the surface).

### 2026-10-23 — `fix-mission` merged and live

- **`fix-mission` is merged** into `mission`'s `develop` (PR #37, `0c14db4`, 2026-10-22; the
  branch is gone) and minikube's `mission` runs it (pod restarted 2026-10-22). Its OpenAPI is the
  one pinned from `fix-mission`: `SOURCE_REFS` is back to `develop`, `make contracts-update
  SERVICE=mission` changed nothing but `source.json`'s `ref`.
- **Checked live** (GET only, `svc-admin`): `GET /api/internal/missions/:id` answers 200 for
  every mission, and the catalogue's and the details' bodies all parse with `zMissionCatalogue` /
  `zMissionDetailAsServed`. The columns `autoComplete`, `allowPartial`, `requiresMissionIds`,
  `assignmentDeadlineHours` are now required in `zMissionAsServed` (`MissionTerms` always shows
  them).
- **Seed's missions reworked** (`seed-social.ts`): each objective's `params` follows its kind
  (`deliver_material` / `transport`: `goodType` and POIs, `visit`: a POI, `manual`: none); a bonus
  objective with a `standing` bonus reward, weights, a partial hand-in (`complete` with
  `partial`), a chain (`The crater's depths` requires `The first survey`, resolved by
  `scriptId` from the catalogue), a time to finish, `divers` and a `standing` reward. The route
  `…/objectives/:id/progress` is gone: progress now comes from the game server's player states
  (`PUT /missions/player-states`, measured against `inventory`'s POIs) or from the issuer's
  `confirm` (`manual` objectives only), which the seed uses. The objectives' POIs are fixed UUIDs
  `inventory` does not hold (`mission` checks only that they are UUIDs), so no player ever matches
  them; seed real POIs with the `inventory` step. The body follows `routes/schemas.ts`
  (`zCreateMissionAsAccepted` in `code.ts`, question 19). `make seed-social` run on 2026-10-23:
  only the two new missions were created (`Check the beacon` taken, confirmed, completed unpaid);
  the eight older ones keep their pre-`fix-mission` bodies (409) until `mission`'s database is
  recreated.
- **`dyingstar-admin`'s dev secret is `dyingstar-admin-dev-secret`** (decided for the dev
  environment, maintainer, 2026-10-23): the back team's realm now gives it to the client, with a
  redirect URI `http://admin.dyingstar.local/auth/callback`. `docker-compose.k8s.yml` and
  `k8s-partial-import.json` use it; our compose Keycloak keeps `dyingstar-admin-local`.
- **Checked in a browser** (Playwright in the dev container's network, as `ynotna`, GET only):
  every mission's page opens (BFF 200, no page error): its chain, the assignees' names from
  `social`, a `standing` reward, the terms of PR #37.

### 2026-10-21 — O.5 a mission's page, built against `fix-mission`

- **The internal detail route exists on `mission`'s branch `fix-mission`** (`5725d56`,
  2026-10-19, README › Interne, `mission:read`), not on `develop`. Minikube runs the image
  `mission:develop` (Harbor has no other tag): checked live (GET only, `svc-admin`), the catalogue
  answers 200 and `GET /api/internal/missions/:id` **404 `Route not found`**. The `kubernetes`
  repository's branch `fix-mission` changes Keycloak roles and `internalServiceClients`, not the
  image.
- **Maintainer's choice (2026-10-21): build it now** against the contract of `fix-mission`, try it
  live once deployed. `packages/contracts` pins each service from its own branch
  (`SOURCE_REFS`: `mission` → `fix-mission`, back to `develop` once merged); `make
  contracts-update SERVICE=mission` re-pins one service only.
- **O.5 built**: a row of the catalogue opens `/missions/:missionId`: status, category, origin,
  event; progress of the required objectives (weighted), places taken, handed in (partly or
  not), reward (credits, items, standing); its terms (issuer, visibility, group and its name,
  zones, prerequisites, end, time to finish, completion, partial hand-in, escrow, missions to
  finish first, script, creator); its objectives (step, kind, progress, weight, bonus and its
  reward, parameters as stored); who took it (players linked to their sheet for who may read
  `social`, NPCs, status, deadline, handed in, share, paid). BFF `GET
  /api/mission/missions/:id`, `mission.read`, as `svc-admin`.
- **What `fix-mission` changes for the catalogue**: five categories (`delivery`, `transport`,
  `mining`, `exploration`, `divers`) without migrating the rows, so a row may keep an older one
  (shown as labelled, or as stored); a `standing` reward; new columns (`autoComplete`,
  `allowPartial`, `requiresMissionIds`, `assignmentDeadlineHours`) read as optional while
  minikube is on `develop`; zones without `radiusM`.
- **When `fix-mission` is live** (merged and deployed, or an image of the branch): `GET` a
  mission as `svc-admin` and check it parses with `zMissionDetailAsServed`; open a mission in the
  panel; **rework the seed's missions**: `fix-mission` checks each objective's `params` against
  its kind (`deliver_material` takes `goodType` and a POI `zone`, the old `itemId` is refused),
  and adds bonus objectives, weights, partial hand-in and chains worth seeding. The seed keeps
  the four categories both versions accept meanwhile.
- **Not committed** (2026-10-21), in the working tree of `develop` with O.4. `make check`: 616
  tests pass; two GitHub drift alerts fail, unrelated: `social`'s OpenAPI on `develop` (batch
  presence, cache) and the object definitions (`food`, `tool`, new properties), for the
  maintainer.

### 2026-10-11 — O.4 mission catalogue done

- **O.4 built** (below): "Missions" in the sidebar (Game world; moved to Administration on 2026-10-23), every mission of `mission`, any
  status, filtered by status, category and origin, read as `svc-admin` for `mission:read`.
  **List only, by the maintainer's choice**: no mission page until the back team gives an
  internal detail route (question 18).
- **To try on minikube**: `make up K8S=1` again (it now sets `MISSION_URL`), create the client
  role `mission:read` on `dyingstar-admin` in minikube's Keycloak and give it to `ynotna`
  (sign in again), `make seed-social` (it now creates eight missions), `make pnpm dev`.
- Checked live on 2026-10-11 (GET only): `svc-admin`'s token holds `mission:read` with the
  `mission-api` audience, `GET /api/internal/missions` answers 200; minikube's `mission` was
  empty.
- **Not committed** (2026-10-11): the work sits in the working tree of `develop` (equal to
  `feature/manage-persistence` at `bfb6285`); the maintainer commits. `make check` passes.
- **Next**: `inventory`, or a mission's page once question 18 is answered.

### O.4 Mission, catalogue — done, to try live on minikube

ADR 0023 › Mission: no Admin API; its Interne API as `svc-admin` for `mission:read` held by the
person.

- Contract pinned (`packages/contracts/src/mission`). Its OpenAPI is 3.1 but marks nullable
  fields with 3.0's `nullable: true`: the generated schemas refuse the rows' `null`s, so
  `code.ts` describes a row as `mission`'s code serves it (`zMissionAsServed`), question 19.
- BFF: `GET /api/mission/missions` (`status`, `category`, `kind`, `limit`, `offset`),
  `mission.read`; `MISSION_URL`; `GET /api/panel` lists `mission` only with `svc-admin`'s secret
  (the catalogue has no other way in).
- SPA: `/missions`, a table (mission, category, origin, issuer, status, reward, places, created;
  "Event" and "Group" badges), three filters and pages, all in the URL.
- Mock: five missions shaped as `mission`'s code stores them (a game delivery, a corporation's
  transport with escrow, a scenario, a group mission, a cancelled player mission).
- `make seed-social` creates eight missions as `svc-admin` (`scriptId` `seed.*`, a rerun answers
  409 and leaves them as they are), then plays the game server's part on some: taken by players,
  progress reported (shared, additive), one completed without payment (`settle: false`), one
  cancelled, one declared an event. Injected in minikube on 2026-10-11; the live catalogue
  parses with `zMissionAsServed`.

### 2026-10-09 — O.3 done

- **O.3 built** (below): credit and debit a player's, an NPC's, a corporation's wallet or a
  political treasury, issue money into a country's or federation's treasury. Not tried live.
- **To try on minikube**: create the client roles `economie:wallet:credit`,
  `economie:wallet:debit`, `economie:money:issue` on `dyingstar-admin` in minikube's Keycloak
  (and O.2's `economie:corporation:read`, `economie:corporation:manage`,
  `economie:politics:manage` if not done), give them to `ynotna`, sign in again. Then: a player
  sheet's wallet (Credit, Debit), a corporation's treasury, Free Colonies' treasury (Issue
  money: `make seed-social` allows it, ceiling 100,000).
- **Next**: `inventory`, with the ADR 0024 pattern (its README section by section, roles copied
  from its « Rôle requis »); or what the maintainer finds while trying J to O.3.

### 2026-10-09 — O.2 done

- **O.2 built** (below): a corporation's economic settings and fiscal home, a political
  entity's tax rates and minting, its tax assessment; the BFF's record of writes to the game
  services (ADR 0023); empty sidebar groups hidden. Not tried live.
- **To try on minikube**: give `ynotna` the client roles `economie:corporation:manage` and
  `economie:politics:manage` on `dyingstar-admin` (by hand: the partial import's "Skip" does
  not update existing users), `make seed-social` (it now sets the fiscal homes of Vance Freight
  and Okafor Trading to New Haven and mirrors the political members in `economie`), then on New
  Haven: change its rates, run an assessment (corporate tax on both treasuries; the first one
  taxes no income), edit a corporation's settings and fiscal home. The treasuries do not move:
  debts are paid by their debtor (`POST /api/corporations/:id/taxes/pay`, a member route the
  panel does not use).
- `make check` under load (minikube, `make pnpm dev`): Vitest is capped at 8 workers
  (`vitest.config.ts`, `bc46487`), which also fixed a fixture mute that expired on 2026-10-09.
- O.3 followed the same day (block above).

### End of session 2026-10-08 (second)

- Branch `feature/manage-persistence`: pushed up to `ca9b4b0`; the handoff commits after it are
  not (push only when the maintainer asks). Since the first session's handoff: seed and reset
  of minikube's `social` (`6185dc4`, `f13ed78`), J (`bcb6bb2`), K (`3f577f6`), L (`cd2a70d`),
  management rights (`0f47d54`), N (`96506c7`), deployment secrets (`85a88fe`), O.1
  (`ca9b4b0`).
- One `make check` of the handoff failed one test once (533 tests, not reproduced in three full
  runs since): an intermittent test, probably a timeout under load. If it comes back, note which
  test and look at its waits.
- **The rule of every game service** (ADR 0023, maintainer, 2026-10-08): follow the service's
  README section by section. *Admin* sections take the person's token with a moderation role
  (`moderator` < `admin` < `supervisor`, checked by the service); *Interne* sections take
  `svc-admin` only, opened in the panel by **the capability role of the README held by the
  person** on `dyingstar-admin` (`social:corporation:write`, `economie:wallet:read`…).
  Player / member routes are not used. Never route a person's action through `svc-admin` when
  the README gives it an Admin route.
- **To try live** (nothing was tried on minikube in this session, sign-in was not allowed to
  the assistant): J (claim, then confirm / dismiss / escalate; a moderator on an `admin`-level
  report is read only), K and N (organisations, read and managed), O.1 (Economy page, wallets,
  treasuries, political taxes). Setup: `make up K8S=1` (it reads `svc-admin`'s secret and sets
  `SOCIAL_URL`, `ECONOMIE_URL`), give `ynotna` the client roles `social:corporation:write`,
  `social:politics:write`, `economie:wallet:read`, `economie:politics:read` on
  `dyingstar-admin` (the partial import's "Skip" does not update existing users), `make
  seed-social` (or `make reset-social`), `make pnpm dev`.
- **`.env.local`**: `SERVERS` is refused since L: `GAME_SERVER_NAME`, `PERSISTENCE_URL`
  (README › Migrating from `SERVERS`); add `ECONOMIE_URL=` (empty outside minikube).
- **Next: O.2, economie's settings** (as `svc-admin`, ADR 0023 › Economie): a corporation's
  internal tax and donations (`PUT /api/internal/corporations/:id/settings`,
  `economie:corporation:manage`), a political entity's tax rates and minting policy (`PUT
  /api/internal/politics/:id/settings`, `economie:politics:manage`), a tax assessment (`POST
  /api/internal/politics/:id/taxes/assess`, `economie:politics:manage`). Then **O.3**: credit /
  debit a player, an NPC, a corporation or a political treasury (`economie:wallet:credit`,
  `economie:wallet:debit`, `economie:politics:manage`), mint money (`economie:money:issue`).
  Each confirmed (`TwoStepDialog`), with an idempotent `externalId`. Read `economie`'s code
  (`DyingStar-game/services` › `economie/src/services/`) before writing the mock.
- Not built, with the reason: "claimed by X" on a report (`social` stores no claimer, its log
  has no filter); the organisations' activity (members only, question 10); NPC memberships in
  an organisation (an NPC picker first); `economie`'s wallets by pseudonym (`GET
  /api/admin/players`, broken in minikube, question 13).
- Not to build without the maintainer's go: lifting from the moderation sanctions tab,
  deleting a sanction (`social` cannot). Storybook: not for now (ADR 0014).
- The services' OpenAPI differs from their code at times: read the code (`social` twice,
  questions 9); the mocks follow the code.

## The steps to come

### I. Acting on players (ADR 0024 step 3) — done

Done on 2026-10-08 and tried for real on minikube's `social` (warning issued then lifted by
`ynotna`, a moderator's ban refused by `social` itself). What was built:

| Action | `social` route | Input | Minimum role |
|---|---|---|---|
| Warn, mute | `POST /api/admin/players/{id}/sanctions` | `type`, `reason` (≤ 256), `durationHours` (1–8760, or none) | `moderator` |
| Suspend, ban | same | same; a ban may be permanent | `admin` |
| Lift a sanction | `DELETE /api/admin/sanctions/{id}` | the sanction, from the sheet's list | `moderator` |
| Adjust reputation | `POST /api/admin/players/{id}/reputation` | `delta` (−100…100), `reason` (≤ 128) | `admin` |

- BFF: `POST` / `DELETE` routes under `/api/social/…`, bodies validated with the contract
  (`zIssueSanctionBody`, `zAdjustReputationBody`), the user's token forwarded, Origin checked.
- SPA: each action in a confirmation dialog (player, type, duration, reason), like persistence
  writes; the banner, sanctions and reputation history refresh after. `social` logs the actor.
- Permissions already exist: `social.moderate`, `social.sanctionSevere`, `social.reputation`.
- Lift and reputation from the sheet: a "Lift" button on each sanction in force, an "Adjust
  reputation" dialog (`admin`+); NPCs get no action (`social` excludes them).
- Real behaviour differs from `social`'s OpenAPI: lifting an already lifted sanction answers
  **404**, not the documented 409 (mock follows the real service). Log actions are
  `sanction_issued`, `sanction_revoked`, `report_<status>`, `report_escalated`,
  `auto_escalated`.
- A **warning is a record, never in force**: `social` sets its `expiresAt` to its creation, so
  it has no duration, no banner and nothing to lift ("One-off" / "Ponctuel" in the tables).

### J. Report actions — done, to try live on minikube

On a report (moderation › reports, `ReportDetail`), while it is open, for a role at least equal
to its escalation level (`social.moderate`, `social.reportsAdmin`, `social.reportsSupervisor`;
the panel's rule, ADR 0024 › Update 2026-10-08; the BFF reads the level before forwarding):

| Action | `social` route | Effect (`reports.service.ts`) |
|---|---|---|
| Claim (« Prendre en charge ») | `PATCH /api/admin/reports/{id}` `{ status: 'reviewing', note? }` | the only action on an `open` report |
| Confirm (« Confirmer ») | same, `resolved` | on a claimed report; closed; target loses `REPUTATION_UPHELD_REPORT_PENALTY` (10) |
| Dismiss (« Classer sans suite ») | same, `dismissed` | on a claimed report; closed; target gets the filing penalty back (2) |
| Escalate (« Escalader ») | `POST /api/admin/reports/{id}/escalate` | on a claimed report; one level up, back to `open`; hidden at `supervisor` |

Claim first is the maintainer's rule (2026-10-08), enforced by the BFF (409 otherwise).

- BFF: `PATCH /api/social/reports/:id`, `POST /api/social/reports/:id/escalate`, inputs
  validated with the contract (note ≤ 1000), the user's token forwarded, Origin checked.
- SPA: a note form (React Hook Form + Zod) then a summary to confirm, telling the reputation
  effect (none for the system's reports: `social` needs a reporter); escalation confirmed
  with its levels; everything under `social` refreshed after.
- `social` read in its code (2026-10-08), not yet tried live: `moderator`+ at any escalation
  level; a closed report answers **409** to both routes; escalating above `supervisor` answers
  **403** (`forbidden.report_max_escalation`), where its OpenAPI says 409; the mock follows the
  code. Reputation changes only when the report has both a reporter and a target player; the
  reporter gets a `report_resolved` / `report_dismissed` activity.
- To try: `make seed-social` gives open reports against `player-dax` and `player-pell`;
  `make reset-social` empties minikube's `social` and seeds it again (back to the start).
- Staff accounts are registered in `social` at sign-in (`GET /api/me` with their token, when
  they hold `social.moderate`): without a profile, `social` refuses their reputation changes
  (open question 6). Tried on 2026-10-08 before this: dismissing report 5 as `ynotna` failed.

### K. Organisations, reading — done, to try live on minikube

Sidebar entry "Organisations" (Administration), opened by `social.moderate`, shown when `social`
is configured. Player routes called with the moderator's token, read only:

- BFF: `GET /api/social/corporations` (`search`, page), `/corporations/:id` (ranks, parent,
  first members and subsidiaries), `/corporations/:id/members`, `/corporations/:id/subsidiaries`;
  `GET /api/social/politics` (`search`, `type`, page), `/politics/:id` (offices, parent, first
  members and children), `/politics/:id/members`, `/politics/:id/children`. Inputs validated
  with the contract.
- SPA: `/organisations` (tabs Corporations / Political entities, search, level filter), a page
  per corporation (CEO, holding, political home, ranks, members, subsidiaries) and per
  political entity (head, higher level, offices, members, lower levels), all linked to each
  other and to the player sheets; the player sheet's organisations become links.
- Mock: two corporations (a holding and its subsidiary) and two political entities (a commune
  of a country) with `social`'s default ranks and offices; the profiles' memberships derive from
  them. `make seed-social` creates organisations in minikube's `social` too.
- **Not built: the organisations' activity.** `social` keeps it for members only
  (`requireCorporationMember`, `requirePoliticalMember`, no moderator bypass): a moderator gets
  403. ADR 0024 lists it in step 2; question 10 below.

### N. Organisation management — done, to try live on minikube

Through `social`'s internal API as `svc-admin` (`SVC_ADMIN_CLIENT_SECRET`; `make up K8S=1` reads
it from minikube), for people holding the capability roles of its README on `dyingstar-admin`
(ADR 0023 › Social — management) and a moderation role:

- Corporations: create (CEO picked among players and NPCs), edit, transfer the CEO to a member,
  change a member's rank, remove a member, disband. Political entities: create (head picked),
  edit, transfer the head office to a member, disband. Each through a form then a summary to
  confirm (`TwoStepDialog`), or a confirmation for removals.
- `social` acts as the current CEO or head, with its rules (CEO rank by transfer only, the CEO
  leaves after a transfer, one corporation per player, names unique); the mock follows them.
- `GET /api/panel` lists `social-management` when `svc-admin` is configured; the buttons show
  only then, and only to the capability role of the organisation's kind.
- Not built: NPC memberships (add / remove an NPC), to come with an NPC picker; `social`
  records the CEO or head as the actor, not the person (question 8).

### O.1 Economie, reading — done, to try live on minikube

ADR 0023 › Economie: its Admin API with the person's token (`moderator`+), its Interne API as
`svc-admin` for the capability role of its README held by the person.

- Contract pinned (`packages/contracts/src/economie`); the services' shared client
  (`clients/upstream.ts`: timeouts, errors, `svc-admin`) under `social`'s and `economie`'s.
- BFF: `GET /api/economie/stats` (`economie.dashboard`), `/wallets/:holder/:id` and
  `/transactions` (`economie:wallet:read`; political treasuries `economie:politics:read`),
  `/politics/:id/settings`. `ECONOMIE_URL`; `GET /api/panel` lists `economie` and
  `economie-wallets`. The contract's `int64` ids are sent back JSON-safe (`jsonSafe`).
- SPA: "Economy" in the sidebar (money supply, volume, taxes, richest players, NPCs and
  corporations named through `social`, day by day, over 7 / 30 / 90 days); a wallet on the
  player sheet, a treasury on the corporation and political pages, with the political tax rates
  and minting policy.
- `make seed-social` funds the test players, two treasuries and two political entities, and
  sets New Haven's taxes and Free Colonies' minting (as `svc-admin`, replays skipped).
- Not used: `GET /api/admin/players` (wallets by pseudonym): `economie` resolves names through
  `social`, and minikube's `economie` has no `SOCIAL_SERVICE_CLIENT_SECRET` (to tell the back
  team). Amounts are shown as `economie` keeps them (integer units).

### O.3 Economie, money movements — done, to try live on minikube

Through `economie`'s Interne API as `svc-admin` (README › Interne, « Rôle requis »; code read in
`transactions.service.ts` › `movement`, `politics.service.ts` › `issueCurrency`):

| Action | `economie` route | Panel permission ← role |
|---|---|---|
| Credit a player, an NPC, a corporation | `POST /internal/players\|npcs\|corporations/:id/wallet/credit` | `economie.walletCredit` ← `economie:wallet:credit` |
| Debit one | `…/wallet/debit` | `economie.walletDebit` ← `economie:wallet:debit` |
| Credit or debit a political treasury | `POST /internal/politics/:id/wallet/credit\|debit` | `economie.politicsManage` ← `economie:politics:manage` |
| Issue money | `POST /internal/politics/:id/mint` | `economie.moneyIssue` ← `economie:money:issue` |

- BFF: `POST /api/economie/wallets/:holder/:id/credit|debit`, `POST /api/economie/politics/:id/mint`;
  bodies stricter than `economie` (`code.ts` › `zPanelMovement`, `zPanelMint`): in credits, a
  type among the internal ones (`deposit`, `withdrawal`, `fee`, `mission_reward`, `salary`,
  `prime`, `corporation_fund`, `system`), a reason (≤ 128), an `externalId`; ledger ids sent
  back JSON-safe. Each call lands in the BFF's record of writes.
- Types split by direction (maintainer, 2026-10-09; `code.ts` › `MOVEMENT_TYPES`, checked by the
  BFF): a credit is a deposit, mission reward, salary, bonus, corporation funding or system
  adjustment; a debit a withdrawal, fee or system adjustment. `economie` takes any of them
  either way. The ledger shows each movement's reason (`reference`, else a memo).
- SPA: Credit / Debit on a wallet or treasury card (player sheet, corporation, political
  entity), Issue money on a country's or federation's treasury; a form (amount, type, reason)
  then a summary with the balance before → after (`TwoStepDialog`). The `externalId`
  (`admin-panel:<uuid>`) is drawn when the dialog opens: confirming twice records once. A debit
  above the balance cannot be sent; issuing respects the entity's ceiling.
- `economie`'s behaviour, followed by the mock: an account is opened on its first credit; a
  recorded `externalId` answers 409 `DUPLICATE_EXTERNAL_ID`; a debit beyond the balance 409
  `INSUFFICIENT_FUNDS`; a locked account 403 `ACCOUNT_LOCKED`; issuing 403 `MINTING_DISABLED`
  or 400 `MINT_CEILING_EXCEEDED`, booked as an `issuance`; `caller` = `svc-admin` in the ledger.
- Question 17: issuing money takes no idempotency key.

### O.2 Economie, settings — done, to try live on minikube

Through `economie`'s Interne API as `svc-admin`, for the capability roles of its README held by
the person (ADR 0023 › Economie); `economie`'s code read on 2026-10-09 (`develop` `75eb1ce`,
`internal.routes.ts`, `routes/schemas.ts`, `politics.service.ts`, `corporations.service.ts`,
`taxation.service.ts`).

| Action | `economie` route | Panel permission ← role |
|---|---|---|
| Read a corporation's internal tax on donations, donation policy, fiscal home | `GET /internal/corporations/:id/settings` | `economie.corporationRead` ← `economie:corporation:read` or `:manage` |
| Change them | `PUT …/settings` `{taxRateBps?, allowDonations?}`, `PUT …/affiliation` `{politicalEntityId \| null}` | `economie.corporationManage` ← `economie:corporation:manage` |
| Change a political entity's tax rates and minting | `PUT /internal/politics/:id/settings` `{corporateTaxBps?, incomeTaxBps?, allowMinting?, mintCeiling?}` | `economie.politicsManage` ← `economie:politics:manage` |
| Run its tax assessment | `POST /internal/politics/:id/taxes/assess` `{currency: 'credits'}` | same |

- BFF: `GET` / `PUT /api/economie/corporations/:id/settings`, `PUT …/affiliation`,
  `PUT /api/economie/politics/:id/settings`, `POST …/taxes/assess`; inputs validated as
  `economie`'s code reads them (`packages/contracts/src/economie/code.ts`: at least one field,
  a ceiling up to 10¹³, a nullable fiscal home, the fiscal home in the answer). `:manage` opens
  the matching reads (`economie.politicsRead` too).
- **The BFF's record of writes** (ADR 0023 › Calling the services, `lib/audit.ts`): each write
  to `social` or `economie`, refused ones included, is a JSON line on stdout (who, route,
  status), since calls as `svc-admin` carry no identity.
- SPA: on a corporation page, "Economic settings" (internal tax, donations, fiscal home linked)
  with "Edit the settings"; on a political page, the taxes card gains "Edit the settings" and
  "Run a tax assessment". Forms (React Hook Form + Zod) take rates in percent, send only what
  changed, and confirm the changes as before → after (`TwoStepDialog`); the assessment is a
  confirmation saying its bases, since when income is taxed, and that each run books new debts
  (twice = the same treasuries taxed twice), then a toast with the debts booked.
- Money issuing is offered to countries and federations only (`economie`'s README; `economie`
  does not check it), or to turn it off where it is on.
- `economie`'s behaviour, followed by the mock: settings rows created with the defaults on first
  read or write (an unknown id is never a 404); a change needs one field at least (400
  otherwise); the corporate tax is a share of each **attached** corporation's treasury balance
  (`economie`'s fiscal home, apart from `social`'s political home); the income tax a share of
  the salaries, bonuses and mission rewards of the members **mirrored in `economie`** since the
  previous assessment (none on the first one, which opens the period); each run books new debts
  under a new `assessmentId`, paid later by their debtor.
- Sidebar: a group left without any entry the account may see is hidden (the "coming soon"
  ones stay).
- Not built: an entity's tax debts (`economie` lists them per NPC only on its Interne API, per
  player or corporation on member routes); question 14.

### L. Panel settings instead of `SERVERS` — done

- BFF: `GAME_SERVER_NAME` and `PERSISTENCE_URL` replace `SERVERS` (`config/servers.ts` removed);
  one persistence, mounted only when `PERSISTENCE_URL` is set (like `SOCIAL_URL`); no more
  `X-Server-Id`; `GET /api/panel` (`environment`, `gameServerName`, `services`) replaces
  `GET /api/servers`. The BFF refuses to start while `SERVERS` is set, saying what replaces it.
- SPA: `usePanel` replaces `useServers`; no server id in the API calls, the query keys or the
  preferences (persisted version 1 drops the former `serverId`).
- Migration note in the README (`.env.local` and deployments); `.env.sample`, `CLAUDE.md` and
  `deploy/` updated (the latter still describe the previous panel, flagged as such).

## Conformity to the ADRs (2026-10-08)

The lot 2 screens had drifted from ADR 0010 / 0014 / 0020 while lint passed. Fixed: a
`ServicePageLayout` template, business rendering moved out of the pages, `DataTable` on
TanStack Table (columns kept stable through the table meta: `FlexRender` remounts cells
otherwise), React Hook Form + Zod for the moderation forms, a test next to every new component.
The rules lint cannot check are now enforced by `apps/web/src/conventions.test.ts`, and
`CLAUDE.md` › "ADRs are binding" says how to work with them.

## Working locally

- `make up` → our compose Keycloak (`localhost:8080`), persistence of pre-production, no game
  service (moderation, organisations, economy hidden). `make up K8S=1` → the back team's
  minikube: their Keycloak (`auth.dyingstar.local`), `social` and `economie`
  (`services.dyingstar.local/social`, `/economie`) and `svc-admin`'s secret read from the
  cluster. After changing mode or `docker/docker-compose*.yml`, recreate the container (`make up
  …`) then `make pnpm dev`.
- Minikube stack: `~/www/kubernetes`, `./scripts_linux/start-dev.sh`, `minikube tunnel`;
  `*.dyingstar.local` → `127.0.0.1` in WSL's `/etc/hosts` **and** Windows' hosts file.
- Test users (password = user name): `devplayer`, `dev-reader`, `dev-editor`,
  `dev-moderator`, `dev-admin`, `ynotna` (`admin`, id `19dd218f-9cbd-484f-9a3b-cff5285eaa93`,
  the maintainer's real pre-production player), test players `player-*`. List and roles:
  `docker/keycloak/README.md`.
- Minikube Keycloak loses our client and users when its database is recreated: re-import
  `docker/keycloak/k8s-partial-import.json` (Realm settings › Action › Partial import); with
  "Skip", existing users keep their roles (give new ones by hand).
- Test data: `make seed-social` (players, friendships, organisations, reports, sanctions in
  `social`; wallets, treasuries, taxes and minting in `economie`; replays skipped);
  `make reset-social` empties `social` first (not `economie`, whose seeded credits are
  idempotent).
- Services rejecting every token (`401 Invalid token`) in minikube: CoreDNS workaround in
  `docker/keycloak/README.md` until the back team sets `OIDC_JWKS_URL` (reported 2026-10-08).
- Staff accounts are registered in `social` at sign-in (its reputation changes need a profile).
- `make contracts-update` re-pins every service's OpenAPI (`social`, `economie`) and
  regenerates their Zod schemas; `packages/contracts/src/github-sync.test.ts` fails when one
  changed upstream. `economie`'s `int64` ids are `BigInt` in the generated schemas: the BFF
  sends them back with `jsonSafe`.

## Decisions taken during the lot (2026-10-08)

- One panel per environment, each on its own URL and Keycloak; one game server per environment.
- Shared Keycloaks never get a `localhost` redirect URI (back team): local work always signs in
  to a local Keycloak.
- **Our compose Keycloak is temporary**: remove it only when the panel's additions are merged in
  the back team's `kubernetes` repo, the panel manages services, and testers have another way
  than `make start` (ADR 0023 › Local development).
- Persistence is opened by the `persistence:*` roles only; the moderation roles add nothing to
  it. Undecided cells of the matrix are allowed while the panel is in test.
- A player's Keycloak `sub` = their `social` `playerId` = their persistence `player` UUID.
- The BFF calls `/api/admin/*` and player routes with the user's token (`social` checks the
  role and logs the actor); `svc-admin` only for `/api/internal/*`, behind the panel's checks.
- Every game service follows its README section by section (ADR 0023): Admin = the person's
  token and moderation role; Interne = `svc-admin`, for the capability role of the README held
  by the person on `dyingstar-admin`. One `svc-admin` token serves every service.
- Reports: claimed first, then confirmed, dismissed or escalated; handled at their escalation
  level or above (panel rules, stricter than `social`; ADR 0024 › Update).
- `SERVERS` and `X-Server-Id` gave way to `GAME_SERVER_NAME`, `PERSISTENCE_URL`,
  `<SERVICE>_URL`; `GET /api/panel` (environment, game server, services).

## Open questions (back team)

Ready to post (a Discord message was drafted on 2026-10-08). Still open:

1. Pre-production client `dyingstar-admin` (redirect URI on the panel's URL only, client-role
   mapper), its client roles (`persistence:*`, `social:*:write`, `economie:*`), who assigns
   them; the panel's pre-production URL.
2. Realm roles `admin` and `supervisor` (checked by `social` and `economie`, missing from their
   realms); does `supervisor` have rights of its own beyond `admin`?
3. `svc-admin`'s secret for each deployment of the panel (README › Secrets of a deployment),
   with its capability roles kept (`social:*:write`, `economie:*`) and its audiences
   (`social-api`, `economie-api`).
4. `OIDC_AUDIENCE` on pre-production `social` (would need an audience mapper).
5. Services' `OIDC_JWKS_URL` in dev-local (the `401 Invalid token` bug).
6. `social` refuses the reputation changes of a staff account without a profile
   (`reputation_events.actor_id` → `player_profiles`); `updateReportStatus` is not atomic (the
   report is closed and logged before the reputation change fails: report 5, 2026-10-08).
7. `social` does not check the escalation level against the role (the panel enforces it).
8. `social` records the CEO or the head as the actor of the internal API's management, not the
   person: an "actual author" field, or the panel keeps its own log.
9. `social`'s OpenAPI differs from its code (the panel follows the code): lifting an already
   lifted sanction answers 404 (documented 409); escalating above `supervisor` answers 403
   (documented 409).
10. The organisations' activity is for members only: should moderators read it (a role bypass,
   or an internal route)? Until then the panel does not show it.
11. Persistence requiring a token one day (then `svc-admin` needs its audience).
12. Access token lifetime (24 h in pre-production) for the panel's client.
13. Minikube's `economie` has no `SOCIAL_SERVICE_CLIENT_SECRET`: its `GET /api/admin/players`
   (wallets by pseudonym) and the names of its rankings cannot reach `social`.
14. `economie`'s OpenAPI differs from its code (the panel follows the code): `CorporationSettings`
   lacks `politicalEntityId`; the settings bodies' "one field at least" and `mintCeiling`'s
   10¹³ maximum are not written; the affiliation body's `nullable` is lost by generators
   (`nullable: true` beside `format: uuid`). No Interne route lists a political entity's tax
   debts (only an NPC's): could the panel get one, to show what an assessment booked?
15. `economie` lets any political entity issue money (`allowMinting`), its README reserving it to
   countries and federations: should `economie` refuse the other levels? The panel offers it to
   those two only.
16. Fiscal homes and political members are `economie`'s own copies, set by the game server: who
   keeps them in step with `social` (a corporation changing its political home, a member
   leaving)? Until then an assessment may tax according to stale data.
17. `economie`'s `POST /api/internal/politics/:id/mint` takes no `externalId`, unlike credits and
   debits: a resend after a lost answer issues the money twice. Could it accept one? The panel
   only prevents a double click.
18. ~~`mission` has no internal detail route~~ → `GET /api/internal/missions/:missionId`
   (`mission:read`), merged into `develop` on 2026-10-22 (PR #37) and deployed on minikube; used
   by O.5.
19. `mission`'s OpenAPI is 3.1 but used 3.0's `nullable: true` (ignored in 3.1) → fixed by
   PR #37 (`type: [string, 'null']`). Its schemas still list no `required` field (every
   generated field is optional), its internal list takes `groupId`, `groupClaimable`, `isEvent`,
   and its creation takes the objectives' `weight`, `isBonus`, `bonusReward`, the mission's
   `allowPartial`, `autoComplete`, `requiresMissionIds`, `assignmentDeadlineHours`
   (`routes/schemas.ts`), none of which its OpenAPI lists: the panel keeps describing them in
   `code.ts`.
20. `mission`'s `POST /api/internal/missions` accepts `isEvent` (its README and OpenAPI list it)
   but does not store it (`createMission` leaves it out of the insert): the mission is created
   as a non-event. The seed declares it afterwards (`POST …/:missionId/event`).
21. `inventory`'s `openapi.yaml` on `develop` (`bdee3c0`) is not valid YAML: line 816,
   `description: Internal-only: geometry fields …` holds `: ` in an unquoted value. Nothing can
   be generated from it; the panel pins it (the sync test alerts once it changes) and writes the
   POI it reads from `inventory`'s code (`contracts/inventory/code.ts`). Could it be quoted?
22. `inventory`'s POI `parentId`: its README and `db/schema/pois.ts` call it "an opaque persistence
   object UUID (no FK)", but its code checks it is another POI (`assertParentValid`:
   `POI_PARENT_NOT_FOUND`, `POI_PARENT_CYCLE`). Which one is meant? The seed notes the
   persistence object in `metadata.persistence` meanwhile.
