# Lot 2 — Sign-in and the game services (social first): implementation plan

Scope and decisions: [ADR 0023](./adr/0023-keycloak-authentication.md) (Keycloak sign-in,
permissions, one panel per environment) and [ADR 0024](./adr/0024-game-services-social-first.md)
(game services, `social` first). This plan only orders the work and keeps where we are; when a
step needs a new decision, it goes into an ADR before coding. **Read this file first when
starting a session on lot 2.**

## Status (2026-10-09, O.3 done)

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
| O. Next services, one by one with the ADR 0024 pattern: `economie` first (1. reading, 2. settings, 3. money movements), then `inventory`, `mission`, `market` | **O.1** (`ca9b4b0`), **O.2** (`64ffd9e`) **and O.3 done** (to try live); then `inventory` | — |

Order agreed with the maintainer on 2026-10-08: I (acting on players) before K (organisations),
since the player sheet is where moderators look first.

### 2026-10-09 — O.3 done, where to resume

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
