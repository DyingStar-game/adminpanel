# 0008. Combined navigation with type-aware views

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence

## Context

The Claude Design mock-up proposes three navigations (see [ADR 0007](./0007-rewrite-admin-from-design.md)).
Each has its own value:

- **Table / explorer (1b)** — simple and efficient to browse a level or a type.
- **Orbit (1a)** — useful **centred on one entity** to see what it is linked to
  (e.g. a vehicle, its components, its pilot, its parent).
- **Object page (1c)** — needed to see precisely what an entity is made of.

Types do not carry the same data (17 definitions, from `box` to `planet`), so a single
generic layout does not fit every type.

### Relations observed in live data (2026-10-01)

Besides `parent_id`, UUID references are found **nested anywhere** in `object_data`:

| Type | Path | Points to |
|------|------|-----------|
| `vehicle` | `components.<slot>` (object keyed by slot, e.g. `Slot_FL`) | `vehicle_component` — 26 of 108 refs point to missing items |
| `player` | `spawn_appartment_id` | `spawnbuilding` |
| `spawnbuilding` | `apartments[].player_uuid` | `player` |

Definitions also declare `pilot_uuid`, `seats`, `reception_owner`, `storage_shelves`… which
are likely references when populated.

## Decision

### One navigation, three complementary views

1. **Explorer (main entry)** — lazy hierarchy tree (`parent_id`, roots = `""`) on the left,
   paginated table of the selected level / type in the middle, inspector on the right.
   Also reachable as a flat list by `object_type`.
2. **Object page** — full detail of one entity: identity, ancestors breadcrumb, relations,
   children by type (tabs, paginated), properties grouped by channel, undeclared keys,
   raw JSON, edit / delete.
3. **Orbit (contextual)** — opened **from an entity**, never as a global map: the entity in
   the centre, its parent, its children grouped by type (paginated per cluster) and the
   entities it references. Click = inspect, double-click = re-centre.

The three views share the same selection: switching view keeps the current entity.

### Type-aware rendering

- A **generic renderer** works for any type, driven by value shape: `Vec3`, quaternion,
  arrays of positions, booleans, timestamps, UUID references (detected at any depth),
  nested objects / arrays (collapsible), unknown JSON.
- An optional **view profile per type**, kept in the admin, refines it: table columns,
  headline fields, which fields are relations and their target type, sections / order,
  which children types to show first. Types without a profile fall back to the generic
  renderer, so a new `*_def.json` works immediately.
- Properties are grouped by replication channel from `*_def.json`
  ([ADR 0006](./0006-object-type-definitions.md)).

### API limits that shape these views

- **Outgoing** references (this entity → others) are cheap: one `GET /items/{uuid}` each.
- **Incoming** references (who points to me, other than children) are **not available**:
  it would need a full scan. Only reciprocal fields that exist in data can be shown
  (e.g. `player.spawn_appartment_id` ↔ `spawnbuilding.apartments[].player_uuid`).
- Dangling references are shown as such (broken link), not hidden.
- Child counts per type are costly (one call per type, full scan each); the orbit loads
  clusters only when needed, and counts are shown lazily.

### First profiles (lot 1): `vehicle`, `player`, `planet`, `star`

Drafted from live data (2026-10-01). Every other type uses the generic renderer.

| | `vehicle` (28) | `player` (6) | `planet` (19) | `star` (1) |
|---|---|---|---|---|
| **Table columns** | name / uuid, `speed`, `engine`, `handbrake`, `odometer_km`, pilot | `name`, `is_npc`, `action`, `seat`, `position` | `name`, planet or moon, `soi`, `from_timestamp`, children count | `name`, `position` |
| **Headline (object page)** | speed, engine, handbrake, limiter (`limiter_on` / `limiter_kmh`), odometer, mass + cargo_mass | name, NPC or player, action, seat, carrying | name, `soi`, number of orbital samples, `from_timestamp` as a date | name, position |
| **Relations** | `pilot_uuid` → player; `seats.<seat>` → player (object keyed by seat, `""` = empty); `components.<slot>` → vehicle_component (shown per slot, broken links flagged) | `spawn_appartment_id` → spawnbuilding (in data equal to its `parent_id`) | parent planet when it is a moon | root planets (implicit, see notes) |
| **Children first** | `vehicle_component` | — | `spawnbuilding`, `vehicle`, `cargo_depot`, `miningzone`, moons (`planet`), then `miningrock` (450, paginated) | root planets (implicit) |
| **Specific renderers** | `doors.<door>` and `seats.<seat>` as labelled lists; `suspension` as 4 values | `head` / `head_yaw` as angles | `positions[]` + `rotations[]` (quaternions) as an orbital-samples table; `soi` (undeclared key) shown with a "not replicated" hint | `position` (singular, whereas the definition declares `positions`) flagged as a definition mismatch |

Notes from the data:

- **Planets and moons share the `planet` type.** A moon is a `planet` whose `parent_id` is a
  planet (11 in data); the UI labels it "moon" and shows its planet in the breadcrumb.
- **Planets have no parent for now** (`parent_id: ""`) because there is a single star
  (confirmed by the maintainer). The star → planet link is therefore **implicit**: the star
  page lists root planets as "bodies of the system" with an explicit "implicit — single star"
  hint, and this rule is dropped as soon as planets get a real `parent_id` or a second star appears.
- `pilot_uuid` is `""` and no seat is occupied because nobody was playing at sampling time
  (normal state). Relations must handle `""` as "no link"; fixtures must also include an
  occupied vehicle (pilot + seats) so this case is tested.
- Profiles are declared in code as typed objects (validated by a Zod schema), one file per type.

## Open questions

- ~~Which types get a profile first~~ → vehicle, player, planet, star.
- Who maintains profiles when the game adds fields — admin team or game team?
- Is a reverse-reference lookup worth asking from the services team?

## Consequences

- Profiles are a small, explicit configuration to maintain alongside `*_def.json`.
- The orbit view is bounded to one entity at a time, which keeps it within API limits.
