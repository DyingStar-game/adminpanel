# 0004. Bulk import: JSON array sent as unit POSTs

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence

## Context

Operators need to load a set of items at once (seed data, scene layouts). The persistence
service has no bulk endpoint and `POST /items` does not detect duplicates (no 409; POST is an upsert, confirmed in the service source), see
[ADR 0003](./0003-persistence-lot-1-items-scope.md). The expected input is **a JSON array of
items** in the `CreateItemRequest` shape, each one sent with a unit `POST`.

Without an exact existence check, a POST on an existing UUID can overwrite data silently.

## Options considered

1. **Browser loops over BFF `POST /api/items`** — progress per item is trivial to show, the
   BFF stays stateless; a closed tab stops the import midway.
2. **One BFF bulk route that loops server-side** — survives a closed tab only if made
   asynchronous (job + polling), which adds state to the BFF for a modest gain.

## Decision

- Input: a `.json` file (or pasted text) whose root is an **array** of
  `{ object_type, object_uuid?, object_data }`.
- **Preview before sending**, each row gets a status:
  - `invalid` — not an object, missing `object_type`, `object_data` not an object,
    malformed `object_uuid`, `object_data.uuid` / `type` inconsistent with the item;
  - `new` — UUID absent (generated) or unknown on the server;
  - `conflict` — UUID already exists; the user chooses *skip* (default) or *overwrite* (PUT),
    per row or for all;
  - warnings (non-blocking) — unknown `object_type`, properties not declared in the type
    definition ([ADR 0006](./0006-object-type-definitions.md)), `parent_id` not found on the
    server nor in the file, duplicate UUID inside the file (blocking).
- **Conflict detection is exact**: existence is checked against the full UUID set
  (paged `GET /items` up to `total`), not a truncated first page.
- The browser sends items **one by one** through the BFF (option 1), with limited
  concurrency, progress bar, and the ability to cancel.
- The BFF create route refuses to overwrite: it checks `GET /items/{uuid}` first and answers
  **409** if the item exists. Overwrite is an explicit `PUT`.
- Order: items whose parent is in the file are sent after that parent.
- End report: created / overwritten / skipped / failed with the persistence error message,
  downloadable as JSON; failed rows can be retried.
- Extra confirmation when the target server is `production`.

## Consequences

- Import remains bounded by the browser session; acceptable for current volumes
  (hundreds to a few thousand items).
- Each POST is **pushed to the running game** by the service: an import spawns entities live.
- No rollback: a partial import is possible and must be visible in the report.
- Requires a 409 in the BFF create route.
- The Claude Design mock-up has no import screen: it must be designed in the same style.
