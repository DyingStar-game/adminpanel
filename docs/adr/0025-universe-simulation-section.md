# 0025. Universe simulation section: `universesimulator` in the panel

- **Status:** Proposed
- **Date:** 2026-10-11 (amended 2026-10-12: configuration; villages as the nodes)
- **Deciders:** maintainer, back team (`universesimulator`)
- **Scope:** Game services (`universesimulator`), Frontend
- **Builds on:** [ADR 0024](./0024-game-services-social-first.md) (the per-service pattern),
  [ADR 0023](./0023-keycloak-authentication.md) (permissions, calling the services),
  [ADR 0018](./0018-planetary-map.md) (the planetary map and its frame),
  [ADR 0009](./0009-live-refresh-by-polling.md) (live refresh)

## Context

The back team wrote a new game service, **`universesimulator`** (Rust, axum, PostgreSQL), which
was not planned in ADR 0024's list (`social`, `economie`, `inventory`, `mission`, `market`). It
simulates the physical economy of a federation by orchestrating the other services: the first
federation, **ARES**, governs planet `tarsis_3` (SandBox). Its own README and ADRs
(`DyingStar-game/services` › `universesimulator/`, read 2026-10-11 and 2026-10-12 from the back
team's working copy: the service is **not on GitHub yet**) describe, since its **ADR 0013**
("Villages are the simulation nodes; they aggregate their warehouses", 2026-10-12):

- **villages**, the nodes of the simulation: persistence `poi_village` objects (`Mxxxx` mining
  villages, `Fxxxx` factory towns, with a `population` and a `type`), each a commune in
  `social`, with the position of the POI cached (`x`, `y`, `z`, relative to the planet centre);
- **warehouses**: the `cargo_depot` objects attached to a village (their `object_data.poi_uuid`),
  holding the goods in inventory; each village has a **main warehouse** (deliveries, production
  and mined ore go there). `mining_depot` objects are ignored;
- the **stock of a village** is the sum of its warehouses' stocks; **thresholds and target
  levels** (village policies), production and consumption **flows** per game hour, **mineral
  sources**, **routes** and **local prices** are per village; **capacities** (and initial
  stocks) per warehouse;
- **supply orders** (meta-missions): a village below its threshold gets a mining order or a
  transport order from the nearest village with a surplus (Dijkstra on the route graph), split
  into one **leg** per hop between villages (goods held in a warehouse of the origin, delivered
  to the main warehouse of the next village), each published as a mission (escrowed by the
  federation);
- **prices**: a federation index per resource from supply and demand, local buy / sell prices
  per village;
- the federation **treasury** (in `economie`), with money issued when it falls below its floor;
- a **tick** (every `SIM_TICK_SECONDS`) that can be paused, resumed or forced.

Its **Admin API** (`/api/admin/*`) holds the supervision views written for this panel
(`dashboard`, `network`, `stock-history`, `price-history`, `local-prices`, `incoming`,
`mint-events`), the read routes (villages, warehouses, resources, entities, prices, orders), the
configuration CRUD, order cancelling and the simulation control. It takes **the person's token
with a moderation role** (`src/auth/mod.rs` › `MODERATION`: `moderator`, `admin`,
`supervisor`); **every write needs `admin` or `supervisor`** (`Caller::require_admin`). Errors
are `{ error, message }`. Its Interne API (`/api/internal/*`, `usim:*` roles) is for the game
server and services, not for people.

## Options considered

How the panel draws the charts (stock and price histories, trends):

1. **A chart library** (Recharts, visx, Chart.js…) — complete, but a new dependency of some
   weight for a handful of single-series line charts, styled apart from the panel's tokens.
2. **Small inline SVG components** — a line chart and a sparkline are a few dozen lines on a
   pure geometry helper; they use the design tokens (`stroke-link`, `fill-fg-3`…) and so follow
   the theme. No new dependency.

Where the network map draws the villages:

- **A. A schematic graph** (React Flow, as the orbit view) — readable, but the positions mean
  nothing and nothing ties it to the planet.
- **B. The planetary map's frame** (ADR 0018) — the same Leaflet `CRS.Simple` setup, metric grid
  and scale, and the villages (and their warehouses) projected in **the frame the BFF keeps for
  that planet's map**, so each lands exactly where `/map/$uuid` draws its POI.

## Decision

We will add `universesimulator` to the services of ADR 0024, with **option 2** for the charts and
**option B** for the map, as a section **Simulation** in the sidebar's "Game world" group, and we
follow the service's model: **villages are what the panel shows and edits; warehouses appear
inside their village**.

### The per-service pattern, for `universesimulator`

| Piece | `universesimulator` |
|---|---|
| Configuration | `UNIVERSESIMULATOR_URL` (minikube: `http://services.dyingstar.local:<port>/universesimulator`); unset, hidden |
| Contract | `packages/contracts/src/universesimulator/openapi.yaml`, pinned **from the back team's working copy** (`source.json` › `commit: null` and the copy's sha256 until it is pushed to `develop`; the GitHub sync test skips it while GitHub answers 404, `make contracts-update` keeps the copy and records the commit once it is there). Ids follow the contract's hex pattern (persistence UUIDs have no RFC version bits) |
| BFF | `clients/universesimulator.ts` on `clients/upstream.ts`; curated routes `/api/simulation/…` (`docs/bff-api.md`), **all with the person's token** on the Admin API; writes recorded by `auditWrites` |
| Permissions | `simulation.view` (`moderator`, `admin`, `supervisor`) and `simulation.manage` (`admin`, `supervisor`), mirroring the service's own checks (ADR 0023 › Universesimulator) |
| Tests | `createUniversesimulatorMock` in `packages/testing`, typed by the generated types, following the service's code (`views.rs`, `reads.rs`, `admin.rs`, `reconciler.rs`): ARES with four villages (the city C0001, the factory towns F0001 and F0003, the mining village M0002), six warehouses, routes between villages, active legs, prices and history |
| SPA | Route `/simulation?tab=…`, shown when the service is configured and `simulation.view` is held |

Out of scope: the rest of the configuration CRUD (resources, routes, mineral sources, federations,
warehouses' activation and POI refresh, a village's activation), order creation and
`POST /import`.

### The views

Each a tab, its state in the URL (`lib/simulationSearch.ts`: tab, resource, village, entity,
order status, body). Only the tab on screen is mounted and polled, at the lists' rate (5 s,
paused with the live switch, ADR 0009). Everywhere, places are **village names**.

1. **Overview** — key figures: tick state (running / paused, period), last tick (and its
   duration), tick count, treasury balance (against its floor; "unknown" when `economie` did not
   answer), money minted in 24 h, escrowed rewards, orders in progress, missions on offer; the
   last tick's error if any; then the **villages below their threshold** (available, threshold,
   net flow per hour, autonomy), each opening the village on the map. **Pause / Resume** and
   **Force a tick** for `simulation.manage` only, each confirmed: they act on the live game.
2. **Network map** — in the planetary map's frame (below): **villages** as discs coloured by
   the health of their stock of the chosen resource, all their warehouses summed (**empty**,
   **below threshold**, **OK**, or **not kept**; a village has no capacity, so never "full"),
   with a legend naming each colour; their warehouses as small squares beside them (the main
   one filled); routes between villages as grey lines; active legs as gold arrows between
   villages whose weight grows with the quantity carried (dashed and dimmer until on offer).
   Mining depots are never shown. A click on a village opens its panel, from
   `GET villages/:id`: its summed stocks and health, its warehouses with their own stocks and
   capacities (the main one marked), its flows per hour, the goods on their way, its local
   prices.
3. **Stocks** — **only villages**: one row each (type, population, warehouses) with its stock of
   the chosen resource against its threshold and target, its net flow, autonomy and health,
   filtered by political entity (a commune, or one above it). A picked village shows all its
   summed stocks, its last 24 hours of the resource (`stock-history?village=`) against its
   threshold and target, and each of its warehouses with its own stocks and capacities.
4. **Transits & missions** — the orders, newest first, filtered by status, resource and village
   (one the order goes through), each with its hops as a timeline between villages (status,
   quantity, distance, reward, the warehouses holding and receiving the goods, mission id).
   `simulation.manage` can cancel an open order, after confirmation.
5. **Prices** — the federation index per resource (unit price, supply against demand, the last
   day as a sparkline), then the local buy / sell prices of the picked resource per village,
   largest spread first.
6. **Treasury** — balance, floor, minted in 24 h, escrowed, and the money issued (date, amount,
   reason).

### Configuration (for `simulation.manage`)

The service's configuration routes the panel uses (`admin.rs`), each through
`/api/simulation/…` with the person's token:

- **a village's thresholds** (`GET`, `PUT /village-policies`,
  `DELETE /village-policies/{village}/{resource}`): threshold and target level of its summed
  stock, `0 ≤ threshold ≤ target` (the service answers 400 otherwise);
- **a warehouse's capacities** (`GET`, `PUT /warehouse-capacities`,
  `DELETE /warehouse-capacities/{warehouse}/{resource}`): whole units, or `null` for no limit;
- **a village's main warehouse** (`PUT /villages/{id}` `{ mainWarehouseId }`): one of its own
  warehouses (the service answers 400 otherwise);
- **a village's flows** (`POST /flows`, `PUT /flows/{id}` for the rate and label — `null`
  clears the label — `DELETE /flows/{id}`).

Inputs are checked by the BFF before the call (`contracts/universesimulator/code.ts`): the
contract's fields only, the service's rules (threshold ≤ target, capacity ≥ 0 or `null`, a
village change names one field at least, a flow change names its rate or label), plus panel
rules on top: labels trimmed, 1 to 128 characters; a flow's rate is never 0 in the SPA.

In the SPA: the village panel shows the village's **thresholds** (edit, delete, add one for a
resource without) and its **flows** (edit the rate and label, delete, add one: resource, rate,
source, label) in place of the read-only flows; each warehouse of the village (panel and Stocks
tab) offers **"Make it the main warehouse"** and the **capacity** of each of its rows; the
Stocks tab offers the picked village's threshold for the chosen resource. Read-only users keep
the views. Forms on React Hook Form + Zod (ADR 0010), each field's error under it as soon as it
is typed, an incoherent target named on its field, then the changes to confirm
(`TwoStepDialog`); deletions and the main warehouse change are confirmed. Every simulation view
is refreshed after a write; the service's refusals are shown as it words them.

### Inline SVG charts

`molecules/TrendChart` draws one series over time (default size, or `compact` as a sparkline in
a table cell) from `lib/simulation.ts` › `lineChartGeometry` (pure, tested without a DOM): the
line in the accent colour with its last value marked, references (threshold, target) as dashed
status lines labelled at their end, recessive value ticks, the first and last times, a hover
title on every point. Every colour comes from the design tokens, so the charts follow the theme
(dark only today, ADR 0020) without code of their own. The tables next to the charts give the
same figures as text.

### The planetary map's frame for the villages

- `molecules/MetricMap` is the Leaflet frame `BodyMapCanvas` used inline (`CRS.Simple`, zoom
  range, metric grid following the zoom, scale bar); `BodyMapCanvas` now draws in it unchanged,
  and `organisms/SimulationNetworkMap` draws its layers in it too.
- `GET /api/simulation/network?body=<planet UUID>` adds, next to `universesimulator`'s network,
  each village **and each of its warehouses** projected **with the frame the BFF keeps for that
  planet's map** (`ItemsService.bodyFrame`, computed on the planet's first map, by building it
  if needed; `services/bodyMap.ts` › `projectOnFrame`, `packages/schemas` › `geometry.ts`):
  `positions[]` of `{ id, kind: village | warehouse, lat, lon, altitude, x, y }`. Without a
  body, without persistence, with a body unknown to persistence, persistence failing or a body
  without positioned items, nothing is projected and `projectionIssue` says why; the raw
  positions stay in the network.
- The SPA takes the planet from the URL (`?body=`), else from persistence: the parent of the
  first village's POI, when the person may read persistence. A moderator without a persistence
  role sees the reason instead of the map's markers (the other tabs are unaffected).

## Consequences

- One more contract, client, route group, permission pair, mock and SPA section, following ADR
  0024's checklist; no new dependency (charts in SVG, the map on the existing Leaflet).
- The contract pin has no commit until the back team pushes `universesimulator` to `develop`:
  the GitHub sync test skips it (404) and must be run again then (`make contracts-update`).
- The service's model may still move (its ADR 0013 is Proposed, its migration rewritten rather
  than added): the panel follows the pinned contract and is re-pinned with it.
- The BFF reads persistence (the planet and its children) to place villages for people who may
  not read persistence themselves: it only answers the planet's name and the projected positions
  of the villages and warehouses, which `universesimulator` already gives.
- Building the planet's frame on a cold BFF is the cost of a first map (a few seconds on SandBox,
  ADR 0018); later network refreshes reuse it.
- The writes (pause, resume, tick, cancel, thresholds, capacities, main warehouse, flows) act on
  the live game and on missions offered to players: confirmed in the SPA, recorded by the BFF
  (`audit: service-write`), checked by `universesimulator` on the person's token.

### Open questions

1. The back team: push `universesimulator` (and its OpenAPI) to `develop`, then re-pin.
2. The realms: `admin` and `supervisor` still exist in our local realm only (ADR 0023): until the
   back team creates them, nobody can pause, tick, cancel or configure on minikube or
   pre-production.
3. Minikube route: `universesimulator` behind Traefik at `/universesimulator`, like `social` and
   `economie` (to confirm in the `kubernetes` repository).
4. The rest of the configuration in the panel: resources, routes, mineral sources, federations,
   activating villages and warehouses, manual orders and the world import — a later step.
5. A capacity can only be edited on a row the warehouse already shows (a resource it holds or
   has a capacity for): a capacity for a new resource of a warehouse needs a "set a capacity
   for…" choice, not built yet.
6. The game must write `poi_uuid` on each cargo_depot (the service's ADR 0013); until then a
   depot and its village are not simulated, and the panel shows only what the service has.

### Revisions

- 2026-10-11: first draft (warehouses as the nodes, reading and control).
- 2026-10-12: configuration (stock policies and flows) in scope.
- 2026-10-12: villages as the nodes, after the service's ADR 0013 — thresholds and flows per
  village, capacities and the main warehouse per warehouse; the stock policies of the first
  model are gone from the service and from the panel.
