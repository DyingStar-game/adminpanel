# 0003. Manage persistence — lot 1 scope: items, contract = persistence OpenAPI

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence

## Context

"Manage persistence" covers browsing, inspecting, creating, editing and deleting items, plus
bulk JSON import. The admin is rewritten from scratch ([ADR 0007](./0007-rewrite-admin-from-design.md)). The persistence service publishes an OpenAPI contract:
[`DyingStar-game/services` — `persistence/openapi.yaml`](https://github.com/DyingStar-game/services/blob/develop/persistence/openapi.yaml)
(reviewed at `develop@9caf502`).

### What the contract offers

| Operation | Notes |
|-----------|-------|
| `GET /items` | Filters `object_type`, `parent_id`, `scenename` — **exact match**, in-process after a full table scan. `page` (1-based), `page_size` (default 100, **max 10000**). Returns `{ items, total, page, page_size }`. No sort, no free-text search. |
| `POST /items` | `object_uuid` **required** (client-assigned). 201 / 400 / 500. **No 409**: behaviour on an existing UUID is undocumented (likely silent upsert in ScyllaDB). |
| `GET /items/{uuid}` | 200 / 404. |
| `PUT /items/{uuid}` | **Full replace**; `object_type` and `object_data` **required**. No 404 documented (likely upsert). |
| `DELETE /items/{uuid}` | **Always 204**, idempotent. |
| Errors | `{ "error": "<message>" }`. |

`ObjectData` = free-form object with well-known keys `parent_id` (uuid), `scenename`,
`position` and `rotation` (`Vec3 {x,y,z}`), `additionalProperties: true`.
No bulk endpoint, no partial update (PATCH), no versioning / optimistic locking.

### Confirmed in the service source (`services/persistence/src`, `develop@9caf502`)

- `POST` and `PUT` are both **upserts** (`upsert_single_item`): POST on an existing UUID
  silently overwrites it; PUT on an unknown UUID creates it.
- `parent_id`, `scenename`, `position`, `rotation` are extracted from `object_data`;
  `position` / `rotation` are parsed as `Vec3` and **silently dropped if invalid**.
- After `POST` / `PUT`, the service **pushes the item to the game** over its WebSocket
  (`create_object` / `update_object_from_external`): admin writes are applied live in game.
- `DELETE` removes the item from DB and cache but **notifies nobody**: the game is not told.
- The WebSocket broadcast only relays REST-originated writes; game updates received by the
  service (`update_object` from Horizon) are **not** re-broadcast to other clients.

### Observed on the live service (read-only GETs, 2026-10-01)

Dataset at that date: **819 items**, 12 types (miningrock 450, shelf 193, vehicle_component 87,
vehicle 28, spawnbuilding 23, planet 19, miningzone 7, player 6, cargo_depot 3, station 1,
mining_depot 1, star 1). Item JSON size: median ~0.9 KB, max ~2 KB. Full dump in one call
(`page_size=10000`) ≈ 0.5 MB in ~0.25 s.

- Roots have `parent_id: ""` (empty string), not `null` / absent.
- Many types duplicate `uuid` and `type` inside `object_data`; they always matched
  `object_uuid` / `object_type`.
- `planet` / `star` use `positions[]` and `rotations[]` (orbital samples); rotations are
  **quaternions** `{w,x,y,z}`, not `Vec3`.
- Exact-match filters confirmed (`scenename=rock_mining_sm` → 0 result).
- `GET /items/{uuid}` → `404 {"error": "item '…' not found"}`, also for a non-UUID string.
- Validation is loose: `page=0` and `page_size=20000` are accepted (documented min 1 / max 10000).
- 6 `vehicle_component` items reference a missing parent (orphans).

### Constraints this puts on the admin

- Shared DTOs must follow the contract: `object_uuid` required on create, `object_type`
  required on PUT, `ObjectData` free-form. `name` is not in the contract but is used by
  several types (planet, star, shelf, spawnbuilding, player…).
- Positions / rotations are not always `Vec3` (quaternion arrays on planet / star).
- Error handling must not invent statuses: DELETE never returns 404, a 500 is a 500.
- Any local mock must reproduce exact-match filters and `parent_id: ""` roots.

## Decision

1. Lot 1 covers **items only**: browse, inspect, create, edit, delete and bulk import.
   Other persistence data (WebSocket presence…) is out of scope.
2. The persistence OpenAPI is the **source of truth**: shared DTOs, BFF client and mock must
   conform to it. The admin panel does not require changes to the persistence service for lot 1;
   wished-for additions are listed as requests to the services team.
3. Since the service has no conflict detection, the **BFF** is responsible for checking
   existence (`GET /items/{uuid}`) before a create, so that create never overwrites silently.

## Open questions

- Bulk import → see [ADR 0004](./0004-bulk-import-unit-posts.md).
- Hierarchy → see [ADR 0005](./0005-hierarchy-lazy-navigation.md).
- Type definitions in the editor → see [ADR 0006](./0006-object-type-definitions.md).
- Deleting a parent: what happens to its children (the service does not cascade)?
- Safeguards on a `production` server (confirmations, read-only toggle)?
- Requests to the services team: 409 on duplicate POST, sort, substring search, bulk endpoint?

## Consequences

- Lot 1 is implementable without waiting for the services team.
- Listing stays limited by exact-match filters and full-scan performance on large datasets.
- The UI design (Claude Design mock-up) will be checked against this contract.
