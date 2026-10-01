# 0005. Item hierarchy: lazy, paginated navigation

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence

## Context

Items form a tree through `object_data.parent_id` (star → planets → buildings / zones →
shelves, rocks, vehicles → components). Volume can grow very large: on 2026-10-01 a single
planet (`SandBox`) already had 518 direct children. Roots have `parent_id: ""`.
The service can list children (`GET /items?parent_id=<uuid>`, paginated) but each call is a
full table scan, and it offers no "count children" or "ancestors" operation.

## Options considered

1. **Load everything and build the tree client-side** — simple but does not scale.
2. **Lazy navigation**: load one level at a time, paginated — scales with page size.

## Decision

- No full tree is ever loaded. The hierarchy is browsed **one level at a time**:
  `parent_id=""` for roots, then `parent_id=<uuid>` on expand, paginated ("load more").
- A level is shown grouped by `object_type` with counts (from `total`) when it is large.
- The item detail shows a **breadcrumb of ancestors** (walk `GET /items/{parent_id}` up, with
  a depth guard against cycles) and a link to its children list.
- Orphans (parent not found) are reported as such, not hidden.
- The flat list with filters stays the main entry point; the tree is a navigation aid.

## Consequences

- Each expand costs one full scan on the service; acceptable now, to be raised with the
  services team (index on `parent_id`, child counts) if volumes grow.
- Deleting an item with children: the UI must warn that children are **not** deleted and
  will become orphans (no cascade in lot 1).
