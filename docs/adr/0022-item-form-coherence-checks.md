# 0022. Coherence checks on the create and edit forms, for every type

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** maintainer
- **Scope:** Manage persistence
- **Amends:** [ADR 0019](./0019-bulk-import-validation.md) (references of every type, two-way
  checks, shared with the import)

## Context

The bulk import checks every item against the server before sending it
([ADR 0019](./0019-bulk-import-validation.md)): parent found and of a usual type, references
found and of the expected type, value kinds, scenes, missing position, objects created twice.
The create and edit forms (`ItemCreateSheet`, `ItemEditSheet`) check none of this, whatever the
type: they validate the type, the UUID and the shape of each property, and send. A `parent_id`
that designates nothing, a vehicle slot pointing to a player, a building linked to a village
that does not exist: all are saved without a word.

The import's checks cannot be called as they are for one item: `POST /api/items/import/check`
starts with a scan of every item on the server (15,316 items on 2026-10-07, several seconds,
[ADR 0021](./0021-persistence-query-needs-at-scale.md)), which is out of proportion for a form.

### References on the live data

The import only checks the references declared in `KNOWN_RELATIONS` (`vehicle`: `pilot_uuid`,
`seats.*`, `components.*`; `player`: `spawn_appartment_id`). Every value holding a UUID on the
test server, all types (2026-10-07, GET only):

| Type | Path | Target | What the data shows |
|------|------|--------|---------------------|
| every type | `parent_id` | usual parent types | always found; `""` on the 8 root planets |
| `vehicle` | `components.slot_*` | `vehicle_component` | 71 filled, 69 `""`; the component's `parent_id` is the vehicle and its `slot_id` the slot key, always; never in two slots |
| `vehicle` | `seats.*`, `pilot_uuid` | `player` | no value today (players are not seated in persistence yet) |
| `player` | `spawn_appartment_id` | `spawnbuilding` | 416 / 416 found |
| `spawnbuilding` | `apartments[].player_uuid` | `player` | 416, **not declared**; the player's `spawn_appartment_id` is the building, always; a player is in one apartment only; its `parent_id` is the building 415 times out of 416 |
| `spawnbuilding` | `poi_uuid` | `poi_village` | 121 / 121 found, **not declared**; shared (a village has many buildings) |
| `miningrock` | `fractures[].side2_uuid` | `miningrock` | 52 / 52 found, **not declared**; the other side points back only 22 times |
| `crate_container`, `vehicle`, `vehicle_component` | `out_of_zone` | — | 7 UUIDs designating no item: not a reference to persistence |
| `miningrock` | `ore_seed` | — | a seed `x,y,z\|ore\|n`; 11 of 12,539 hold a rock's UUID: not a reference |

Two lessons: declared references miss part of the data (`poi_uuid`, apartments, fractures),
and "looks like a UUID" does not mean "designates an item" (`out_of_zone`). Some references are
two-way (the component and its slot, the player and its apartment) and nothing checks that both
sides agree.

## Options considered

1. **Forms call the import check with one item** — no new code, but a full scan at every save.
2. **A single-item check route with a targeted context** — the same pure check functions
   (`checkImportFormat`, `checkImportCoherence`), fed with targeted reads instead of the full
   scan: the parent, the referenced items, the items of the item's type, the cached scenes.
3. **Checks in the browser** — the browser would need the type's items and every referenced
   item: many calls, the checks written twice.

For the references:

- **A. Every UUID-looking value is a reference** — no declaration, but `out_of_zone` would warn
  on every vehicle, and the target type, the two-way rule and exclusivity stay unknown.
- **B. Declared references, completed from the data** — `KNOWN_RELATIONS` stays the single
  list (views and checks), gains the references found above and says, per reference, what the
  target says back and whether it is exclusive. A guard reports UUIDs at undeclared paths.

## Decision

Option 2, with references B. The import gains the same reference checks, since both go through
the same functions.

### What every item is checked for, whatever its type

All the import's checks (ADR 0019), driven by the type's definition and its existing items:

- **format** (blocking): known type, UUID, `object_data.uuid`, `parent_id` (UUID or `""`, not
  itself), shapes of `position`, `rotation`, `positions`, `rotations`, `scenename`, `name`;
- **parent**: found on the server (warning); type usual for this type (warning); on edit, not
  one of the item's own descendants (blocking `parentDescendant`); an alias
  (`_planet_SandBox`) belongs to the import, a form gives a UUID (blocking `parentInvalid`);
- **properties**: declared in the definition, value kind the one existing items of the type
  have (warnings);
- **scene** known, and used by this type (warnings); **position** present when existing items of
  the type have one (warning);
- **created twice**: same type and name (warning on create), same type, name, parent and
  position (blocking);
- **references** declared for the type (below).

A type without items on the server yet (new type) gets the format, definition and reference
checks only: there is nothing to learn usual kinds or parents from.

### References

`KNOWN_RELATIONS` gains the references found on the live data; `[]` matches an array element,
as `*` matches an object key (`apartments[].player_uuid`). Each reference may say what the
target says back (`inverse`) and whether a target can be in one place only (`exclusive`):

```ts
vehicle: [
  { path: 'pilot_uuid', target: 'player', label: 'pilot' },
  { path: 'seats.*', target: 'player', label: 'seat' },
  {
    path: 'components.*', target: 'vehicle_component', label: 'component',
    inverse: { parent: true, key: 'slot_id' },  // component.parent_id = vehicle, slot_id = slot key
    exclusive: true,
  },
],
player: [{ path: 'spawn_appartment_id', target: 'spawnbuilding', label: 'spawn apartment' }],
spawnbuilding: [
  { path: 'poi_uuid', target: 'poi_village', label: 'village' },
  {
    path: 'apartments[].player_uuid', target: 'player', label: 'tenant',
    inverse: { ref: 'spawn_appartment_id' },    // player.spawn_appartment_id = building
    exclusive: true,
  },
],
miningrock: [{ path: 'fractures[].side2_uuid', target: 'miningrock', label: 'fracture' }],
```

For each filled reference (an empty string is a free place, not checked):

| Code | When | Severity |
|------|------|----------|
| `refNotFound` | the target does not exist (existing) | warning |
| `refWrongType` | the target is of another type (existing) | warning |
| `refOtherParent` | `inverse.parent`: the target's `parent_id` is not the item | warning |
| `refOtherKey` | `inverse.key`: the target's key (`slot_id`) is not the place's key | warning |
| `refNotBack` | `inverse.ref`: the target's property (`spawn_appartment_id`) is not the item | warning |
| `refRepeated` | `exclusive`: the same UUID twice in the item | error |
| `refTaken` | `exclusive`: the UUID is held by another item of the type (params: that item) | error |
| `uuidNotReference` | a UUID at a path no reference declares, designating no item | info |

The two-way codes are warnings: the admin may be fixing precisely that, one side at a time. The
exclusive ones are errors: a component cannot be mounted in two places, a player cannot live in
two apartments. In an import, `refRepeated` / `refTaken` also look at the other items of the
input. `uuidNotReference` is an information shown on changed values only (`out_of_zone` keeps
quiet unless edited): it tells the admin nothing is checked there, and tells us a reference may
be missing from the list.

Seats and `pilot_uuid` stay without `inverse`: players do not reach persistence correctly yet,
what a player says back cannot be relied on. Fractures stay one-way: the other side points back
only 22 times out of 52.

The type profiles of `spawnbuilding` and `miningrock` show their new references as links
(ADR 0008), like the vehicle's today.

### Route

`POST /api/items/check` (read-only, never writes) takes
`{ item: { object_type, object_uuid, object_data }, mode: 'create' | 'edit', changed?: string[] }`
and returns `{ findings }` in the import's format (code, severity, path, params). The BFF builds
the `ImportContext` from:

| Check | Read |
|-------|------|
| Parent found, its type | `GET /items/{parent_id}` |
| Parent not a descendant of the item (edit) | the new parent's ancestors, walked up ([ADR 0005](./0005-hierarchy-lazy-navigation.md)) |
| References found, their type, two-way checks | `GET /items/{uuid}` per filled reference |
| Value kinds, usual parent types, `position`, created twice, exclusive references taken | the item's type, `GET /items?object_type=…` |
| Scenes | the known scenes, already cached |

The type's statistics (value kinds, parent types, names, exclusive references in use) are kept
in a cache for a few minutes, like the scenes, and cleared on every write: a type such as
`miningrock` (12,539 items) is not listed again at every save.

### What changes for the edit form

- **An edit only reports what it changes** (`changed`): findings about a property the edit did
  not touch are left out (an old dangling reference, an undeclared key the game wrote), so
  editing `speed` never asks to "save anyway" because of a slot. Findings without a property
  (`object_type`, `object_uuid`) stay.
- The item itself is ignored by the "created twice" and `refTaken` checks (same UUID), as the
  import already does for duplicates.
- `new` / `conflict` do not apply: on create, an existing UUID is already refused with 409
  (ADR 0004).

### Forms

- The check runs when the form is submitted, not on every keystroke; the button reads
  *Checking…* meanwhile.
- Errors block the save; warnings are shown under the property they concern (the finding's
  `path`, e.g. `object_data.components.slot_fl` → the `components` row), and the button becomes
  **Save anyway** / **Create anyway** while the item stays as checked. Information never asks
  for a confirmation. If the check itself fails, a second submit saves without it: the check
  advises, persistence stays reachable.
- Labels are the import's (`import.codes.*`, `en` and `fr`), plus the new codes.
- On a production server, the existing confirmation comes after the check.

## Consequences

- Every type gets the same checks on create, edit and import; a type is only better checked
  when its references are declared.
- Re-checking every live item as an import should give no new error, and only the warnings the
  data explains (the player whose parent is a planet, unreferenced orphans); the test is written
  on a sample of each type.
- One more read-only BFF route; a save costs one check before the write, about one filtered
  query (≈ 1 s on the test server, [ADR 0021](./0021-persistence-query-needs-at-scale.md)) when
  the type's statistics are not cached, a few `GET /items/{uuid}` otherwise.
- `valuesAt` / `matchesPath` learn `[]`; `checkImportCoherence` takes an optional list of
  changed keys and the context gains, per type, the exclusive references in use.
- A new type or a new reference in the game shows up as `uuidNotReference` when edited, and is
  declared in `KNOWN_RELATIONS` then; the definitions sync (ADR 0006) does not tell references
  apart, since definitions only list property names.
