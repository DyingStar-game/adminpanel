# 0015. Unknown object types are refused on write

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence
- **Amends:** [ADR 0004](./0004-bulk-import-unit-posts.md) (unknown `object_type` was a non-blocking import warning)

## Context

An item's `object_type` must match a definition file `<type>_def.json`
([ADR 0006](./0006-object-type-definitions.md)). The persistence service does **not** check it:
`create_item` / `put_item` (services/persistence/src/rest/handlers.rs, `develop@9caf502`) store
any string, and the game ignores types it has no definition for. The maintainer expects the
API to refuse unknown types.

## Decision

- The BFF refuses, with `400 UNKNOWN_OBJECT_TYPE` (allowed types in `details.allowed`):
  - creating an item whose `object_type` has no definition;
  - changing an existing item's `object_type` to a type without definition.
- An existing item whose own type has no definition (stored before, or definition removed)
  stays **readable and editable** as long as its type is unchanged (ADR 0006).
- The allowed list is the current definitions list (GitHub, cached, fallback snapshot); it is
  never hard-coded. If no definition can be read at all, no restriction applies.
- In the bulk import, an unknown `object_type` becomes an **`invalid`** row (blocking), no
  longer a warning.
- Request to the services team: validate `object_type` in persistence itself.

## Consequences

- Every write path (create form, import, type change) shares the same rule, enforced server-side.
- A type added in `horizonserver` becomes writable once the definitions cache refreshes
  (≤ `DEFINITIONS_TTL_MS`, 10 min by default).
