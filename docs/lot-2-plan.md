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
| I. **Acting on players**: sanction (warn, mute; suspend, ban for `admin`+), lift, reputation | **Next** | — |
| J. Report actions: status with a note, escalate | To do | — |
| K. Organisations, reading: corporations, political entities | To do | — |
| L. Replace `SERVERS` / `X-Server-Id` by the panel's own settings (`GAME_SERVER_NAME`, `PERSISTENCE_URL`, `SOCIAL_URL`) | To do | — |
| M. Decide the final roles × actions matrix with the back team (ADR 0023) | Waiting for the back team | — |
| N. Organisation management (`/api/internal/*` through `svc-admin`) | After M | — |
| O. Next services (`economie`, `inventory`, `mission`, `market`), one by one with the ADR 0024 pattern | Later | — |

Order agreed with the maintainer on 2026-10-08: I (acting on players) before K (organisations),
since the player sheet is where moderators look first.

Committed with this plan: the labels "En jeu" / "Voir dans la persistance" on the
player sheet, and the test user `ynotna` in `docker/keycloak/*.json` (see below).

## The steps to come

### I. Acting on players (ADR 0024 step 3)

From the player sheet, an action bar filtered by the user's moderation role:

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
- Test in minikube on `devplayer` (writes to the local cluster only).

### J. Report actions

On a report (moderation › reports): `PATCH /api/admin/reports/{id}` (status `reviewing` /
`resolved` / `dismissed`, optional note ≤ 1000), `POST /api/admin/reports/{id}/escalate`
(moderator → admin → supervisor). Same confirmation and refresh pattern.

### K. Organisations, reading

Sidebar entry "Organisations", opened by `social.moderate`. Player routes called with the
moderator's token: corporations (`GET /api/corporations?search`, `/{id}`, `/members`, `/ranks`,
`/subsidiaries`, `/activity`) and political entities (`GET /api/politics?search&type`, `/{id}`,
`/members`, `/offices`, `/children`, `/activity`). The player sheet's organisations become links.

### L. Panel settings instead of `SERVERS`

`SERVERS` (a list) and the `X-Server-Id` header remain from the multi-server design; with one
panel per environment and one game server per environment they become `GAME_SERVER_NAME`,
`PERSISTENCE_URL`, `SOCIAL_URL`… About 25 files, mostly the SPA's query keys; one commit of its
own, with a migration note for `.env.local` and deployments.

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
7. Persistence requiring a token one day (then `svc-admin` needs its audience).
8. Access token lifetime (24 h in pre-production) for the panel's client.
