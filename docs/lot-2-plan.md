# Lot 2 — Sign-in and the game services: plan

Scope and decisions: [ADR 0023](./adr/0023-keycloak-authentication.md) (Keycloak sign-in,
permissions, one panel per environment) and [ADR 0024](./adr/0024-game-services-social-first.md)
(game services, one by one). This plan orders the work and says where we are; a step needing a
new decision gets an ADR first. **Read it first when starting a session on lot 2.** What was
built session by session: [`lot-2-journal.md`](./lot-2-journal.md) (history only).

## Status (2026-10-28)

| Step | Status |
|------|--------|
| A–D. Keycloak sign-in, interim permissions, one panel and one game server per environment, local Keycloaks (compose, minikube) | **Done** (`a6e2eef`) |
| E. Service contracts (`packages/contracts`: pinned OpenAPI, generated Zod, GitHub sync test) | **Done** (`ae3dce8`) |
| F–I. `social`: moderation, players, player sheet → persistence item, acting on players | **Done** |
| J. Report actions · K. Organisations, reading · N. Organisation management | **Done**, to try live |
| L. Panel settings (`GAME_SERVER_NAME`, `PERSISTENCE_URL`, `<SERVICE>_URL`) | **Done** (`cd2a70d`) |
| M. Final roles × actions matrix (ADR 0023): persistence's 🟡 cells left | The maintainer's call |
| O.1–O.3. `economie`: reading, settings, money movements | **Done**, O.3 to try live |
| Simulation (`universesimulator`, ADR 0025) | **Done** (PR #2) |
| O.4–O.5. `mission`: catalogue, a mission's page (ADR 0026, 0027); cancelling a mission (ADR 0028); crates in persistence (ADR 0029) | **Done**, PR #3 merged |
| Polish: supply orders laid out as a mission's objectives, issuer and escrow payer named, persistence-made POI ids read by the BFF (`z.guid()`) | **Done**, branch `feature/simulation-orders-layout`, PR to `develop` open; needs `services` PR #40 for persistence-made POI ids and #41 for simulation missions |
| **O.6. `inventory`** | **Next** (below) |
| O.7. `market` | Then (below) |

## Next: O.6, `inventory`

**What the panel already has** (for a mission's places, ADR 0026): its contract pinned at
`develop` `bdee3c0` but **not generated** (invalid YAML, [question 21](./back-team-questions.md); `zPoi` by hand in
`contracts/inventory/code.ts`), a BFF client reading POIs as `svc-admin` (`clients/inventory.ts`,
a minute's cache), `inventory.read` (`inventory:read`, ADR 0023 › Inventory, both local realms),
an MSW mock (`inventoryMock.ts`), seeded POIs.

**Its README** (`DyingStar-game/services` › `inventory/Readme.md`, `develop` `bdee3c0`):

- **No Admin section**: like `mission`, the Interne API as `svc-admin`, opened by the README's
  « Rôle requis » held by the person (ADR 0023 rule).
- **Holders** `player`, `npc`, `corporation`, `system`, `warehouse` (a village's stock for
  `universesimulator`, its id the `cargo_depot`'s persistence UUID). Goods are fungible stacks
  (`quantity`, `held`, `available`) or unique instances (`stored` / `in_world`). **Holds**
  reserve goods (`market_order`, `mission_escrow`, `supply_order`, `manual`) without changing
  the owner.
- **Reads** (`inventory:read`): `GET /api/internal/holders/:type/:id` (stacks whole, instances
  paged), `…/stacks/:goodType`, `…/holders/:type/:id/pois`, `GET /pois/:poiId`,
  `POST /pois/resolve`. **No route lists holders or holds**: the panel reads a holder it knows.
- **Writes**: credit / debit / instances (`inventory:credit`), transfers and consuming a hold
  (`inventory:transfer`), holds (`inventory:hold`), POIs (`inventory:poi:manage`).
- Lists answer `{ items, total, limit, offset }` (`limit` 1–100); `Accept-Language: fr|en`.

**Where to resume.**

1. Re-pin if `inventory` moved (`make contracts-update SERVICE=inventory`) and see whether
   question 21 is fixed (then generate its Zod like the others).
2. Reread ADR 0010, 0011, 0013, 0014, 0020, 0023, 0024, 0026 and write **ADR 0030 (Proposed)**,
   reading first: a holder's inventory (stacks with held / available, instances) where the
   panel already shows the holder — a player's sheet, a corporation's sheet, a village's
   warehouses in the Simulation section, a `cargo_depot`'s object page — and a holder's POIs.
   Writes later, each with its README role.
3. Read `inventory`'s `src/routes/internal.routes.ts` and `src/services/` before the mock (its
   OpenAPI cannot be trusted while invalid); look at live data on minikube
   (`http://services.dyingstar.local/inventory`, `make up K8S=1`, GET only).

## Then: O.7, `market`

`DyingStar-game/services` › `market/Readme.md` (`develop` `bb7eafd`, read 2026-10-23): a
**catalogue** of tradable goods (pushed by the game server, `PUT /api/internal/catalog/:goodType`),
an **order book** (`sell` / `buy`, matched at once), **demands** any holder may fulfil, and
**trades** settled through `inventory` (goods) and `economie` (money), `pending` until both
moved. **No Admin section**: the Interne API as `svc-admin` — reads `market:read` (catalogue,
orders, demands, trades of every holder), `market:manage` (the catalogue, orders and demands for
an explicit holder), `market:settle` (replay a `pending` trade's settlement). Pre-production's
`svc-admin` already holds the three roles in the `kubernetes` repository; the panel would need
them as client roles on `dyingstar-admin` and an ADR, like O.6. The market is fed by the game
server (catalogue) and by players or the game server (orders, demands), not by a world file.

## Waiting on the back team

- **`kubernetes`** (the panel's missions and inventory, patch sent 2026-10-23) and
  **`services`** (questions 21–25 among others): [`back-team-questions.md`](./back-team-questions.md).
- **Pre-production** (parked by the maintainer, 2026-10-23): reading pre-production's `mission`
  and `inventory` from the local panel as `svc-admin` needs either a `localhost` redirect (or a
  dev client) on pre-production's Keycloak, or a read-only service account and its secret. Their
  URLs: `https://services-preprod.dyingstar-game.space/mission`, `…/inventory`. Not started.

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
  `social`; wallets, treasuries, taxes and minting in `economie`; missions in `mission` and their
  POIs in `inventory`, on real SandBox objects; replays skipped); `make reset-social` empties
  `social` first (not `economie`, whose seeded credits are idempotent), `make reset-mission`
  empties `mission`.
- Simulation on minikube: `make seed-simulation` copies SandBox, its villages and cargo depots
  (read GET only from the test server) into minikube's empty persistence, then imports the ARES
  world file the back team prepared (`docker/minikube/universesimulator/world-ares.json`) into
  `universesimulator`, without the keys `develop`'s importer refuses (question 25:
  `packages/contracts/scripts/simulation-world.ts` lists them), and runs a tick. 16 villages are
  simulated (the mining villages with a cargo depot). `make reset-simulation` empties its database
  and its warehouses' goods in `inventory` first (the import credits the initial stocks once, and
  remembers it in its own database). It also creates ARES's political entities in `social` and
  mints its treasury in `economie` once.
- Browser checks against minikube: Playwright with `--network container:dyingstar-admin-dev-1`
  and `--host-resolver-rules=MAP auth.dyingstar.local:80 <minikube ip>:<traefik node port>`
  (`--network host` does not reach minikube; read the node port from `kubectl`).
- Services rejecting every token (`401 Invalid token`) in minikube: CoreDNS workaround in
  `docker/keycloak/README.md` until the back team sets `OIDC_JWKS_URL` (reported 2026-10-08).
- Staff accounts are registered in `social` at sign-in (its reputation changes need a profile).
- `make contracts-update` re-pins every service's OpenAPI (`SERVICE=<name>` for one) and
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

In [`back-team-questions.md`](./back-team-questions.md), apart so the back team can follow them
alone; their numbers are unchanged.
