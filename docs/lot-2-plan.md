# Lot 2 — Sign-in and the game services (social first): implementation plan

Scope and decisions: [ADR 0023](./adr/0023-keycloak-authentication.md) (Keycloak sign-in,
permissions, one panel per environment) and [ADR 0024](./adr/0024-game-services-social-first.md)
(game services, `social` first). This plan only orders the work and keeps where we are; when a
step needs a new decision, it goes into an ADR before coding. **Read this file first when
starting a session on lot 2.**

## Status (2026-10-08, end of day)

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
| K. Organisations, reading: corporations, political entities | **Done** (to try live) | — |
| L. Replace `SERVERS` / `X-Server-Id` by the panel's own settings (`GAME_SERVER_NAME`, `PERSISTENCE_URL`, `SOCIAL_URL`) | To do | — |
| M. Decide the final roles × actions matrix with the back team (ADR 0023) | Waiting for the back team | — |
| N. Organisation management (`/api/internal/*` through `svc-admin`) | After M | — |
| O. Next services (`economie`, `inventory`, `mission`, `market`), one by one with the ADR 0024 pattern | Later | — |

Order agreed with the maintainer on 2026-10-08: I (acting on players) before K (organisations),
since the player sheet is where moderators look first.

### End of session 2026-10-08 — where to resume

- Everything is committed and pushed (last commit `d9fee50` on `feature/manage-persistence`).
  After step I: readable moderation log (`e82086b`), warnings as one-off records (`f940e6c`),
  readable player activity (`889d78a`), ADR conformity + `conventions.test.ts` (`dc2cc6f`),
  table alignment and shared event colours (`d9fee50`).
- **Step J** (report actions) is done on the pattern of step I (see its section), with the
  maintainer's rules (claim first, role ≥ escalation level, staff registered at sign-in);
  `make reset-social` then the walkthrough of its section remain to be tried live. Test data:
  `6185dc4`.
- **Step K** (organisations, reading) is done, without the activity (members only in `social`,
  question 10). **Next: step L** (panel settings instead of `SERVERS`). Reread ADR 0010, 0011,
  0013, 0014, 0020, 0023, 0024 before coding (`CLAUDE.md` › "ADRs are binding").
- Not built, for lack of data in `social`: "claimed by X" on a report (its log has no filter;
  `social` stores no claimer).
- Check `social`'s real behaviour on minikube before trusting its OpenAPI (it differed twice:
  lifting twice answers 404, warnings expire at once). Read its code in
  `DyingStar-game/services` › `social/src/services/reports.service.ts` for J.
- Not to build without the maintainer's go: lifting from the moderation sanctions tab (asked
  as a question only), deleting a sanction (`social` cannot; would need a back-team route).
- Storybook: discussed, not wanted for now (ADR 0014 says "not for now").

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
  (open question 7). Tried on 2026-10-08 before this: dismissing report 5 as `ynotna` failed.

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

### L. Panel settings instead of `SERVERS`

`SERVERS` (a list) and the `X-Server-Id` header remain from the multi-server design; with one
panel per environment and one game server per environment they become `GAME_SERVER_NAME`,
`PERSISTENCE_URL`, `SOCIAL_URL`… About 25 files, mostly the SPA's query keys; one commit of its
own, with a migration note for `.env.local` and deployments.

## Conformity to the ADRs (2026-10-08)

The lot 2 screens had drifted from ADR 0010 / 0014 / 0020 while lint passed. Fixed: a
`ServicePageLayout` template, business rendering moved out of the pages, `DataTable` on
TanStack Table (columns kept stable through the table meta: `FlexRender` remounts cells
otherwise), React Hook Form + Zod for the moderation forms, a test next to every new component.
The rules lint cannot check are now enforced by `apps/web/src/conventions.test.ts`, and
`CLAUDE.md` › "ADRs are binding" says how to work with them.

## Working locally

- `make up` → our compose Keycloak (`localhost:8080`), persistence of pre-production, no
  `social` (moderation hidden). `make up K8S=1` → the back team's minikube: their Keycloak
  (`auth.dyingstar.local`) and `social` (`services.dyingstar.local/social`). After changing
  mode or `docker/docker-compose*.yml`, recreate the container (`make up …`) then `make pnpm dev`.
- Minikube stack: `~/www/kubernetes`, `./scripts_linux/start-dev.sh`, `minikube tunnel`;
  `*.dyingstar.local` → `127.0.0.1` in WSL's `/etc/hosts` **and** Windows' hosts file.
- Test users (password = user name): `devplayer`, `dev-reader`, `dev-editor`,
  `dev-moderator`, `dev-admin`, `ynotna` (`admin`, id `19dd218f-9cbd-484f-9a3b-cff5285eaa93`,
  the maintainer's real pre-production player). List and roles: `docker/keycloak/README.md`.
- Minikube Keycloak loses our client and users when its database is recreated: re-import
  `docker/keycloak/k8s-partial-import.json` (Realm settings › Action › Partial import).
- Test data in minikube's `social` (players `player-*`, friendships, open reports, sanctions):
  `make seed-social` after that import, again after each reset (`docker/keycloak/README.md`).
- Services rejecting every token (`401 Invalid token`) in minikube: CoreDNS workaround in
  `docker/keycloak/README.md` until the back team sets `OIDC_JWKS_URL` (reported 2026-10-08).
- `social` only knows players who went through it (the game registers them at login): a
  Keycloak-only account is absent from Players until it calls `social` once (`GET /api/me`).
- `make contracts-update` re-pins the services' OpenAPI and regenerates their Zod schemas;
  `packages/contracts/src/github-sync.test.ts` fails when `social`'s OpenAPI changed upstream.

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

## Open questions (back team)

From ADR 0023 and 0024, still open:

1. Pre-production client `dyingstar-admin` (redirect URI on the panel's URL only), its client
   roles, who assigns them; the panel's pre-production URL.
2. Realm roles `admin` and `supervisor` (checked by `social`, missing from their realms).
3. `svc-admin`'s use by the panel and how its pre-production secret is handed over.
4. The final roles × actions matrix, including organisation management.
5. `OIDC_AUDIENCE` on pre-production `social` (would need an audience mapper).
6. Services' `OIDC_JWKS_URL` in dev-local (the `401 Invalid token` bug).
7. `social` refuses the reputation changes of a staff account without a profile
   (`reputation_events.actor_id` → `player_profiles`): accepting or dismissing a report,
   adjusting reputation fail with a 500 until the account called `GET /api/me` once. And
   `updateReportStatus` is not atomic: the report is closed and logged before the reputation
   change fails (seen 2026-10-08 on report 5: dismissed, refund missing).
8. `social` does not check the escalation level against the role: a `moderator` may act on a
   report escalated to `admin` or `supervisor`, which its README's "instances supérieures" and
   the system reports opened at `admin` suggest it should not. The panel enforces it meanwhile.
9. `social`'s OpenAPI differs from its code (the panel follows the code): lifting an already
   lifted sanction answers 404 (documented 409); escalating above `supervisor` answers 403
   (documented 409).
10. The organisations' activity (`GET /api/corporations/{id}/activity`,
   `/api/politics/{id}/activity`) is for members only: should moderators read it (a role
   bypass in `social`, or through `/api/internal/*` and `svc-admin`, ADR 0023's management
   table)? Until then the panel does not show it.
7. Persistence requiring a token one day (then `svc-admin` needs its audience).
8. Access token lifetime (24 h in pre-production) for the panel's client.
9. `social`'s OpenAPI says `DELETE /api/admin/sanctions/{id}` answers 409 when already lifted;
   the service answers 404.
