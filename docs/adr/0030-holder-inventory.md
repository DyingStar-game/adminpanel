# 0030. What a holder owns: reading `inventory` where the panel shows the holder

- **Status:** Proposed
- **Date:** 2026-10-24
- **Deciders:** maintainer
- **Scope:** Game services (`inventory`), BFF, Frontend
- **Builds on:** [ADR 0023](./0023-keycloak-authentication.md) (rights, › Inventory),
  [ADR 0024](./0024-game-services-social-first.md) (one service at a time, its README section by
  section), [ADR 0008](./0008-combined-navigation-type-aware-views.md) (type profiles),
  [ADR 0025](./0025-universe-simulation-section.md) (villages and their warehouses)

## Context

`inventory` is the game's **register of ownership**: who owns which goods, never where they are.
The panel already reads its POIs to name a mission's places (ADR 0026, `inventory:read`). Step
O.6 reads the rest: what a holder owns.

**Its README** (`DyingStar-game/services` › `inventory/Readme.md`, `develop` `0c14db4`, unchanged
since `bdee3c0`), section by section:

- **No Admin section** (like `mission`): the Interne API, with a service token and a capability
  role. So the BFF calls as `svc-admin` and opens the read to the person holding the README's
  « Rôle requis », `inventory:read`, as a client role on `dyingstar-admin` (ADR 0023 rule; the
  role exists already in both local realms).
- **Holders** are opaque UUIDs: `player`, `npc`, `corporation`, `system`, `warehouse` (a
  `cargo_depot`'s persistence UUID, kept by `universesimulator`). Goods are **stacks**
  (fungible: `quantity`, `held`, `available`) or **instances** (unique, a stable UUID, `stored` /
  `in_world`, free `metadata`). A **hold** reserves goods (`market_order`, `mission_escrow`,
  `supply_order`, `manual`) without changing the owner.
- **Reads** (`inventory:read`): `GET /api/internal/holders/:type/:id` (stacks whole, instances
  paged: `instancesTotal`, `limit` 1–100, `offset`), `…/stacks/:goodType`,
  `…/holders/:type/:id/pois` (`{ items, total, limit, offset }`), `GET /pois/:poiId`,
  `POST /pois/resolve`. **No route lists holders or holds**: the panel can only read a holder
  it already knows.
- **Writes**: credit and debit, instances (`inventory:credit`), transfers and consuming a hold
  (`inventory:transfer`), holds (`inventory:hold`), POIs (`inventory:poi:manage`).

**Its code** (`src/routes/internal.routes.ts`, `src/services/inventory.service.ts`,
`src/db/schema/`), which the panel follows where they differ:

- holder types are **six**: the README's five and **`political`** (`HOLDER_TYPES`); POI owners
  are `player`, `npc`, `corporation`, `political`, `system`, `mission`;
- a stack has a **`carried`** quantity too (goods physically carried, e.g. crates in a player's
  hold; `carried ≤ quantity`), and **`available = quantity − held − carried`** (the README says
  `quantity − held`); `carried` is moved by `POST …/stacks/:goodType/carried`
  (`inventory:carried:write`), a route and role the README does not list;
- an unknown holder is **not** a 404: it answers an empty inventory (`stacks: []`,
  `instancesTotal: 0`). Only a single stack answers 404;
- ids are any 8-4-4-4-12 hex (`z.guid()`): persistence UUIDs lack the RFC version bits;
- its `openapi.yaml` is still **not valid YAML** (lot 2 question 21): nothing can be generated,
  so the panel describes these answers by hand from the code, as it does for the POI.

**Live data on minikube** (2026-10-24, GET only, as `svc-admin`): of 18 SandBox `cargo_depot`s,
**16 warehouses** hold 13 stacks each (the ARES world's food, `food_broth_cube` 640 …), updated by
the simulation's ticks, no hold, nothing carried, no instance; the 3 seeded corporations, the 22
political entities, `ynotna` and the system holders own nothing yet; the seed's 8 POIs belong to
a `system` holder. A stack reads:

```json
{ "holderType": "warehouse", "holderId": "f46688c6-…", "goodType": "food_broth_cube",
  "quantity": 640, "carried": 0, "held": 0, "available": 640, "updatedAt": "2026-10-24T12:57:47Z" }
```

`inventory` has **no catalogue of goods**: a `goodType` is a code (`food_broth_cube`, `ore.gold`,
`water`). `universesimulator`'s resources name some of them (`inventoryGoodType` → `name`,
`unit`, ADR 0025); `market`'s catalogue will name the tradable ones (O.7).

**Where the panel already shows a holder**: a player's sheet (`social`; the player's id is their
Keycloak `sub` and persistence UUID), a corporation's and a political entity's sheet (`social`),
a `cargo_depot`'s object page (persistence), a village's warehouses in the Simulation section
(`universesimulator`, which shows their quantity and held per resource already).

## Options considered

1. **An Inventory section listing holders** — impossible: `inventory` has no such route, and
   copying the holders from `social` and persistence would only guess who owns something.
2. **A lookup page** (holder type + id) — works for any holder, `npc` and `system` included,
   but staff rarely know an id; useful later as a fallback, not as the way in.
3. **What a holder owns, on the page that already shows that holder** — one organism reused on
   each page, the holder's type and id known from the page. Nothing to search; the goods are
   read where the question arises ("what does this corporation own?", "what is in this depot?").

## Decision

We will take **option 3**, **reading only**. Writes (credit, debit, transfer, holds, POIs) come
later, each with its README role and its own decision.

1. **BFF** (`clients/inventory.ts`, as `svc-admin`, `inventory.read` = `inventory:read`), two
   curated routes:
   - `GET /api/inventory/holders/:holderType/:holderId?limit=&offset=`: the holder's stacks
     (whole) and a page of its instances;
   - `GET /api/inventory/holders/:holderType/:holderId/pois?limit=&offset=`: the POIs it owns.

   `holderType` is `inventory`'s six (`political` included), `holderId` any 8-4-4-4-12 hex id.
   Answers are described by hand from the code in `contracts/inventory/code.ts` (`zStackView`,
   `zInstance`, `zHolderInventory`, `zPoiPage`), until question 21 is fixed; then generated.
   Listed in `docs/bff-api.md`; the two rows added to ADR 0023 › Inventory.
2. **One organism, `HolderInventory`** (props: holder type and id), shown only when `inventory`
   is configured and the person holds `inventory:read`:
   - **stacks** in a TanStack Table: good, quantity, held, carried, available (the last one
     emphasised; a held or carried part greater than zero visible at a glance);
   - **instances** in a second table, paged by `inventory` (good, id through `IdLabel`, status
     `stored` / `in_world`, metadata folded);
   - **POIs** it owns, each named with its body and radius, as the mission places already are;
   - **empty** reads "owns nothing in inventory" (an unknown holder answers the same: the panel
     does not claim the holder does not exist).
3. **Where**:
   - a **player's sheet** (`player`, the `social` player id), a **corporation's sheet**
     (`corporation`) and a **political entity's sheet** (`political`): one more card;
   - a **`cargo_depot`'s object page** (`warehouse`, its persistence UUID): through its type
     profile (ADR 0008), a new profile field **`inventoryHolder: 'warehouse'`** naming the holder
     type the item's UUID stands for, so any type can opt in later without wiring;
   - **a village's warehouses** (Simulation section) keep ADR 0025's view from
     `universesimulator`; each warehouse gets a link to its depot's object page, where the
     inventory card is, for whoever reads persistence. No second stock table there.
4. **Naming goods**: by `universesimulator`'s resource whose `inventoryGoodType` matches (name
   and unit) when that section is configured and allowed; otherwise the code itself, in
   monospace (a technical value, ADR 0020). `market`'s catalogue can add names at O.7.
5. **Freshness**: read on opening and on focus (TanStack Query), no polling; a refresh button on
   the card. The simulation's ticks move warehouse stocks every few minutes at most.
6. **Tests**: `inventoryMock` (MSW) extended with holders, following the code (`available` with
   `carried`, empty answer for an unknown holder, `limit` 1–100), fixtures from the live shapes
   above (a warehouse with food stacks, a holder with a hold and a carried part, an instance);
   a test next to each component (ADR 0014).

## Consequences

- Staff see what a player, an organisation or a depot owns, and what of it is reserved or
  carried, without a new section or a search. `npc` and `system` holders stay out of reach
  until a lookup page or a page showing them exists.
- Holds themselves (which order, which mission reserved what) cannot be listed: only their sum
  per stack. A route listing a holder's holds would let the panel link a held part to its
  `market_order` / `mission_escrow` / `supply_order`.
- A new profile field (`inventoryHolder`) in the closed vocabulary of ADR 0008, tested.
- Until question 21 is fixed, the panel's description of `inventory` can drift from its code
  unnoticed; the GitHub sync test still alerts when the pinned file changes.
- **Questions for the back team** (to add to the plan: 26–28):
  26. `inventory`'s README lists five holder types and `available = quantity − held`; its code
      has `political` too and subtracts `carried`. Its Interne table lacks
      `POST …/stacks/:goodType/carried` (`inventory:carried:write`). Could the README follow?
  27. No Interne route lists a holder's holds (kind, reference, quantity): could one exist, to
      show what reserved a held quantity?
  28. `auth.ts` declares `MODERATION_ROLES` "used by the admin read endpoints", but `inventory`
      has no Admin route: is one planned (then the panel would read with the person's token)?
