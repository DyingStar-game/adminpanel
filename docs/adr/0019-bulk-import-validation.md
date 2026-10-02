# 0019. Bulk import: input and per-item format and coherence checks

- **Status:** Accepted
- **Date:** 2026-10-02
- **Scope:** Manage persistence
- **Amends:** [ADR 0004](./0004-bulk-import-unit-posts.md) (input and preview statuses)

## Context

Step 9 of lot 1 is the bulk import ([ADR 0004](./0004-bulk-import-unit-posts.md)): a JSON
array of items, previewed, then sent one by one. The maintainer asks for two inputs (a JSON
pasted in a field, or a file dropped on the page) and for **every item to be checked**: its
format, and the coherence of its data.

What the admin can check against (live data, 2026-10-02, GET only):

- **Definitions** (`*_def.json`) only list property **names** per channel: no value types, no
  required keys, no references ([ADR 0006](./0006-object-type-definitions.md)).
- **Existing items** are very regular: for a given type, a key always holds the same kind of
  value (vehicle, player, spawnbuilding, miningrock, poi_village, vehicle_component: no key with
  two kinds; one exception, `cargo_depot.pnj_reception_deposited_item`, array or `null`). Keys
  are often missing on part of the items (`doors` on 13 of 21 vehicles, `pilot_uuid` on 12):
  **no key can be called required**.
- **Known conventions**: `position` / `rotation` are `{x, y, z}` (Euler, ADR 0017),
  `positions[]` / `rotations[]` hold vectors / quaternions, `parent_id` is a UUID or `""`,
  `object_data.uuid` / `type` repeat the item's UUID and type when present.
- **Known references** come from the type profiles: `pilot_uuid` and `seats.*` → `player`,
  `components.*` → `vehicle_component` ([ADR 0008](./0008-combined-navigation-type-aware-views.md)).

## Options considered

1. **All checks in the browser** — the browser would need the full UUID set, samples of every
   type and the referenced items: many calls, logic far from the data.
2. **Format in the browser, coherence in the BFF** — the browser parses and gives immediate
   feedback on the JSON; one BFF route checks every item against the server (existence,
   parents, references, value kinds, scenes) with its cached reads, and returns a report.

## Decision

Option 2.

### Input

- An **Import** page (`/import`), reached from the top bar and from a level of the explorer
  (the level becomes the default `parent_id` for items without one).
- Two inputs, same result: a **text field** where JSON is pasted, and a **drop zone** (or file
  picker) for a `.json` file, whose content fills the field so it can be read and fixed before
  checking. Limits: **5 MB** and **5,000 items**, beyond which the import is refused.
- Root accepted: an **array** of items, or a single item object (treated as an array of one).
- Malformed JSON is reported with its line and column, nothing else is checked.

### Statuses

Each item gets a status and a list of findings, each finding naming the item (index, UUID) and
the path concerned (e.g. `object_data.position.y`):

- **`invalid`** (blocking, the row is not sent):
  - format: not an object; `object_type` missing or not a string; `object_data` missing or
    not an object; `object_uuid` present but not a UUID;
  - unknown `object_type` (no definition, ADR 0015);
  - `object_data.uuid` present but different from the item's UUID (see the update below for
    `object_data.type`);
  - duplicate UUID inside the input;
  - `parent_id` not a string, not `""` nor a UUID, equal to the item's own UUID, or part of a
    parent cycle inside the input;
  - well-known keys with a wrong shape: `position`, `rotation` not `{x, y, z}` of finite
    numbers; `positions` / `rotations` not arrays of vectors / quaternions; `scenename`,
    `name` not strings.
- **`new`**: no UUID (one is generated) or UUID unknown on the server.
- **`conflict`**: UUID already on the server; *skip* by default or *overwrite* (PUT), per row
  or for all (ADR 0004).
- **Warnings** (not blocking, shown on the row):
  - key not declared in the type definition (not replicated to clients);
  - value kind different from the one this key always has on existing items of the type
    (e.g. `speed` a string where every vehicle has a number), with the expected kind;
  - `parent_id` found neither on the server nor in the input; parent type unusual for this
    type (never seen on existing items, e.g. a `vehicle_component` under a planet);
  - reference (`pilot_uuid`, `seats.*`, `components.*`) to an item found neither on the server
    nor in the input, or of another type than expected;
  - `scenename` never used by this type on the server, or used by another type;
  - no `position` while existing items of the type have one.

### Where the checks run

- The browser parses the JSON, validates the format with the shared Zod schemas and shows those
  findings at once.
- `POST /api/items/import/check` (BFF) takes the parsed items and returns the statuses and
  findings of every item. It uses the full UUID set (exact, ADR 0004), the known scenes
  (cached), the parents and references, and a sample of existing items per type present in the
  input (value kinds, usual parent types, `position`). Pure functions, tested on their own.
- Sending stays as decided in ADR 0004: one item at a time through the BFF, parents before
  children, limited concurrency, progress, cancel, report, retry; extra confirmation on a
  production server.

### Update (2026-10-02): `object_data.type`

Checked against the 2,075 live items, `object_data.type` is not always a copy of the object
type: on `poi_village` it holds the village kind (`mining`). A different `type` is therefore a
**warning** (`typeMismatch`), reported only for types whose existing items all repeat their
type there; `object_data.uuid` stays blocking (no live item differs). Re-checking every live item
as an import gives only conflicts, with two warnings: 19 parents not found (real orphans) and
247 undeclared keys.

### Update (2026-10-02): business rules

Given by the maintainer:

- **`object_uuid: null`** (like a missing UUID) gets a UUID generated on the fly.
- **Parent alias**: `parent_id` may be `_<object_type>_<name>`, e.g. `_planet_SandBox`. The BFF
  replaces it by the UUID of the only item of that type with that name, on the server or in the
  import itself (types contain `_`: the longest known type matching the prefix wins). The row
  shows the resolution as an information; no match (`aliasNotFound`) or several
  (`aliasAmbiguous`: 11 spawn building names are shared by up to 16 buildings) is blocking.
  The check returns the resolved items, which are the ones sent.
- **Compound alias**: a shared name is narrowed down by its container, segments separated by
  `/`: `_poi_village_mining_village_45/_spawnbuilding_tarsis_4-1008` is the building of that
  name linked to that village. Each segment after the first only matches items one of whose
  top-level properties holds the previous item's UUID (`poi_uuid` for a building and its
  village, `parent_id`…). Spawn building names are unique within a village (live data).

### Update (2026-10-02): objects imported twice

Items without UUID get a new one at every check, so re-checking an imported file shows them as
new again. Business rule given by the maintainer:

- same type and same `name` as an item on the server: **warning** `possibleDuplicate`, for new
  items only (names are often shared: 16 spawn buildings are called `tarsis_4-1008`);
- same type, `name`, `parent_id` and `position` (within 1 mm) as an item on the server, or as an
  earlier item of the import: **error** `duplicateSpawn` / `duplicateSpawnInImport`, the same
  object cannot spawn twice at the same place. The item itself (same UUID) does not count.

No live item is a same-place duplicate of another (2,076 items re-checked).

## Consequences

- Most errors appear before anything is sent, with the path of the faulty value.
- Coherence checks are heuristics learnt from the server's data: warnings, never blocking,
  except the conventions listed as `invalid`.
- One more BFF route, read-only (it never writes), whose cost is one full scan plus a few
  samples per check; the full scan is shared with the existence check.
- If the services team later adds value types or required keys to the definitions, the
  warnings can rely on them instead of samples.

## Alternatives considered

- **Blocking on value-kind mismatches**: too strict while definitions carry no types and new
  keys appear with game versions; kept as warnings.
- **Required keys from the most common keys**: real items miss keys often (`doors`,
  `pilot_uuid`), it would flag valid items.
