# 0028. Cancelling a mission, and the simulation's missions in the mission views

- **Status:** Accepted (2026-10-23)
- **Date:** 2026-10-23
- **Deciders:** maintainer
- **Scope:** Game services (`mission`, `universesimulator`), Frontend
- **Builds on:** [ADR 0023](./0023-keycloak-authentication.md) (rights, `svc-admin`),
  [ADR 0024](./0024-game-services-social-first.md) (the per-service pattern),
  [ADR 0025](./0025-universe-simulation-section.md) (the simulation section, cancelling an order),
  [ADR 0026](./0026-mission-objective-schematics.md) (a mission's page)

## Context

A mission's page (O.5) is read-only. The panel should be able to cancel a mission, and two kinds
of missions live in `mission`'s catalogue:

- **missions published by `universesimulator`**: each leg of a supply order is published as an
  internal mission, its reward escrowed on the federation's treasury (`issuerType: politics`,
  `escrowPayerType: politics`), with the idempotency key **`scriptId: usim:leg:<leg id>:<attempt>`**
  (`universesimulator` › `src/simulation/publisher.rs`, develop `0c14db4`, the service's last
  change `b37d81a`, 2026-10-12); each of its objectives carries in its `payload`
  `{ source: "universesimulator", orderId, legId, seq, resource }`;
- **every other mission**: the game's, a corporation's, a player's.

Cancelling a simulation mission in `mission` does not stop it. On every tick,
`universesimulator`'s reconciler lists the federation's `cancelled` and `expired` missions, and
for a published leg found there it **publishes a new mission for the same leg** (next attempt)
until `SIM_LEG_MAX_ATTEMPTS` (default 3), then releases the goods' hold and closes the order as
`failed` (`src/simulation/reconciler.rs` › `retry_or_fail`). The way to stop such a mission is to
**cancel its order**: `POST /api/admin/orders/{id}/cancel` cancels the leg's mission in `mission`
(its escrow refunded there), releases the hold in `inventory` and closes the order as
`cancelled` (`reconciler.rs` › `cancel_order`). The panel already offers it in the simulation's
"Transits & missions" tab (`POST /api/simulation/orders/:id/cancel`, `simulation.manage`, the
person's token with `admin` or `supervisor`, ADR 0025).

For any other mission, `mission`'s README (develop `0c14db4`, section **Interne**) lists
`POST /api/internal/missions/:missionId/cancel`, **Rôle requis `mission:write`**: it cancels the
mission and its active assignments and **refunds the escrow** (credits and items); `409` when the
mission is completed (checked in `src/routes/internal.routes.ts` and `src/middleware/auth.ts` ›
`SERVICE_ROLES.missionWrite`). The README has no Admin section; the player route
`DELETE /api/missions/:missionId` is the creator's and is not used (ADR 0023 › Mission).

Today the two views meet only one way: a mission's page shows "Published by the simulation"
(`organisms/MissionSimulationOrigin`) when its id is found among **the latest 100 orders**
(`universesimulator` filters no order by mission), and the orders tab shows each leg's bare
mission id. The catalogue's "Issuer" column says `politics` for a simulation mission, like any
other mission of a political entity.

## Options considered

How to cancel a simulation mission from its page:

1. **Cancel it in `mission`, like any other** — one code path, but the mission comes back at the
   next tick (a new attempt), two more times, then the order fails: the opposite of what the
   person asked, and money and goods move three times for nothing.
2. **Cancel its order through `universesimulator`** — what the service itself does, and what the
   panel already offers in the orders tab; the button is the same, its effect explained.
3. **Refuse cancelling on the mission's page** and send to the orders tab — safe but a detour,
   and the page already knows the order.

How to recognise a simulation mission:

- **A. Its `scriptId`** (`usim:leg:` prefix) — read from the mission alone, in the catalogue too,
  without `simulation.view` and without `universesimulator` configured. It ties the panel to the
  service's key format, which its code calls an idempotency key, not a contract.
- **B. Its order from its objectives' `payload`** (`orderId`, `legId`) — exact, gives the order
  directly (`GET /api/simulation/orders/:id`), for people holding `simulation.view`. Today's way,
  its id among the latest 100 orders, stays only as a fallback for a mission without that
  payload.

## Decision

We will take **option 2**, recognising a simulation mission with **A to classify it and B to
find its order**.

### A simulation mission (`scriptId` starting with `usim:leg:`)

- The panel's rule: `lib/missions.ts` › `isSimulationMission(mission)`, on the `usim:leg:`
  prefix only (the leg id and attempt are not parsed).
- On its page, the **Cancel** button cancels **its order**: shown when its order is found (B),
  the order is open (`OPEN_STATUSES` of `universesimulator`) and the person holds
  `simulation.manage`; it calls the existing `POST /api/simulation/orders/:id/cancel`. The
  confirmation says what happens: the order is closed, the mission cancelled and its reward
  refunded to the federation's treasury, the goods held for it released; no new mission will be
  published for that leg.
- When the order is not found (no `simulation.view`, `universesimulator` not configured or not
  answering), the page says the mission belongs to the simulation and is cancelled through its
  order, with no button. The BFF route `POST /api/mission/missions/:id/cancel` **refuses** a
  simulation mission (`409 SIMULATION_MISSION`, checked on the mission read from `mission`
  first), so that the rule does not rest on the SPA.
- "Published by the simulation" (`MissionSimulationOrigin`) finds its order the same way (B).

### Any other mission

- **Cancel** on its page, for a mission `available` or `active`, for the person holding
  **`mission:write`** (client role on `dyingstar-admin`, a new permission `mission.write`), after
  confirmation naming its effect (active assignments abandoned, escrow refunded to its payer).
- The BFF calls `POST /api/internal/missions/:missionId/cancel` **as `svc-admin`**
  (`clients/mission.ts` › `cancel`), route `POST /api/mission/missions/:id/cancel` guarded by
  `mission.write`, recorded by `auditWrites`; `mission`'s refusals (`404`, `409` completed) are
  shown as it words them. The page and the catalogue are refreshed after it.

### The same mission, seen from both sides

- **Catalogue**: the "Issuer" column reads **Simulation** for a simulation mission (rule A),
  whatever the person's rights; other missions keep their issuer type.
- **Mission page**: "Published by the simulation" stays, its order found by B, the cancel in the
  page's actions.
- **Transits & missions**: a **published** leg's mission shows **its title and status** from
  `mission` (`GET /api/mission/missions/:id`, for who holds `mission.read`), its id still an
  `EntityLink` to the mission's page; other legs (their mission done, cancelled or expired) and
  people without `mission.read` keep the id alone, so that the tab reads a few missions, not one
  per leg of the latest 100 orders.

### Rights

ADR 0023 › Mission gains one row (source: `mission`'s README › Interne at develop `0c14db4`,
checked in `src/middleware/auth.ts` and `src/routes/internal.routes.ts`):

| Action (route of `mission`) | The person needs | Sent as |
|---|---|---|
| Cancel a mission that is not the simulation's: its active assignments abandoned, its escrow refunded (`POST /api/internal/missions/:missionId/cancel`) | `mission:write` | `svc-admin` |

A simulation mission is cancelled through its order: `simulation.manage` (`admin` or
`supervisor`, the person's token, ADR 0025). `mission:write` is added to the panel's client roles
in `docker/keycloak/dyingstar-realm.json` and `k8s-partial-import.json`, given to the staff test
users. As `economie`'s `:manage` roles open their reads, `mission:write` also opens
`mission.read` (cancelling needs the page).

## Consequences

- One write on `mission`, through the pattern of ADR 0024 (client, route, permission, mock
  following `cancelMission`, confirmation in the SPA); the simulation's cancel is reused as is.
- The panel knows `universesimulator`'s `scriptId` format: if the service changes it, the
  catalogue labels its missions as `politics` again and the BFF no longer refuses their direct
  cancel; a test on the mock's leg missions keeps the prefix in sight, and the back team is asked
  to keep it stable (or to give the order id on the mission).
- The order is found from the objectives' `payload`, which `universesimulator` writes but no
  contract promises: without it, the latest 100 orders are searched as before.
- The transits tab costs one `mission` read per published leg (the legs on offer, a few).

### Open questions

1. **`svc-admin` and `mission:write`**: the maintainer asks the back team to add it to
   pre-production's `svc-admin` (2026-10-23); minikube's to check (`make up K8S=1`). Without it,
   the direct cancel answers 403 there.
2. **`universesimulator`**: whether the `usim:leg:` prefix and the objectives' `payload`
   (`orderId`, `legId`) can be relied on; otherwise a filter of orders by mission id (its order
   list filters by status, kind, resource and village only, develop `0c14db4`).
3. **`mission`'s README** (develop `0c14db4`) still lists `…/objectives/:objectiveId/progress` in
   its player table and in its Interne table (`mission:progress`), while neither route is in
   `src/routes/` any more (the internal API keeps `confirm` and `verify`): to report to the back
   team (not this ADR's subject).
4. **`universesimulator`'s missions cannot be published today**: its publisher (`build_mission`,
   develop `0c14db4`) sends `transport` objectives with `params: { itemId }`, which `mission`'s
   strict `transport` kind refuses (`goodType`, `source`, `zone`), and mining legs as
   `deliver_items`, a kind `mission` no longer has. The panel's mock follows `mission`'s shape,
   with the simulation's `scriptId` and `payload`: to check again once the back team fixes it.
