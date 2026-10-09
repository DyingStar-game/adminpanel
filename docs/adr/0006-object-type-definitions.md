# 0006. Object type definitions drive the editor (guidance, not a schema)

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence

## Context

Object types are defined in
[`horizonserver/ds_genericprops/props/*_def.json`](https://github.com/DyingStar-game/horizonserver/tree/develop/ds_genericprops/props)
(17 types on `develop`). A definition lists **replication channels** (zone, distance,
frequency, lod) and the **property names** each carries. It gives **no value types**,
no required flag, no defaults. Horizon ignores (does not replicate) properties absent
from the definition, but persistence stores them anyway.

Observed on live data: some stored keys are not declared (`type`, `uuid`, `soi` on planet,
`name` on shelf / station / cargo_depot); `star` declares `positions` but stores `position`.

**`object_type` ↔ definition file (confirmed by the maintainer):** an item's `object_type`
is the definition file name without the `_def.json` suffix (`vehicle` ↔ `vehicle_def.json`).

Check on live data (2026-10-01): the 12 `object_type` values in use all have a definition;
5 definitions have no item yet (`box`, `building`, `city`, `crate_container`, `storagewarehouse`).

## Decision

- The admin uses the definitions as **guidance**:
  - list of known `object_type` values (type picker, filters, import warnings), including
    types with no item yet;
  - an item whose `object_type` has no definition is still shown (generic renderer) and
    flagged "unknown type";
  - list of expected properties per type (suggestions in the editor, "declared / not
    declared" indicator, warning when a key will not be replicated).
- They are **not** used to block a save: `object_data` stays free-form JSON, as in the
  persistence contract.
- Value types are inferred from existing items of the same type when available (hint only).
- Definitions are read by the BFF from GitHub (`develop`), cached in memory, with a bundled
  fallback snapshot so the panel works offline.

### Update (2026-10-04): an alert when GitHub's definitions change

The bundled snapshot (`apps/bff/src/definitions/fallback.json`) had drifted unnoticed: four
types (`simple_building`, `vehicle_lift*`) and new properties (`charge_j`, `velocity_local`,
`terrain_settled`) were missing. A test, `definitions/github-sync.test.ts`, now reads the real
repository (one GitHub API call, part of `make check`) and fails when its definitions differ from
the snapshot, listing the types added or removed, then the content that changed; it is skipped,
not failed, when GitHub cannot be reached. Once a change has been looked at (profiles,
schematics, map…), `make definitions-update` rewrites the snapshot from GitHub, with the source
commit, and the test passes again. The admin keeps reading GitHub at run time (this ADR is
otherwise unchanged); the steps to follow are in `CLAUDE.md` (Data sources).

## Consequences

- Branch (`develop`) should be configurable per environment to match the deployed Horizon.
- Inconsistencies spotted (undeclared keys) can be reported to the game team from the UI.
