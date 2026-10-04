# 0021. Persistence query needs for the admin at game scale

- **Status:** Proposed
- **Date:** 2026-10-04
- **Deciders:** maintainer, persistence (back) team
- **Scope:** Manage persistence — requests to the persistence service

## Context

The admin reads persistence through four kinds of calls only: `GET /items/{uuid}`, and
`GET /items` paginated (`page`, `page_size` up to 10,000) with exact filters `parent_id`,
`object_type` and `scenename`. Everything else the admin shows — child counts per type, the
planetary map, the orbit view, import coherence checks, the known scenes — is built from these
by the BFF (ADR 0005, 0009, 0018, 0019).

Measured on the test server on 2026-10-03 and 2026-10-04 (GET only, SandBox has about 20,500
children, about 19,500 of them `miningrock`; the server holds about 23,000 items):

| Call | Time |
|------|------|
| `GET /items/{uuid}` | ~0.05 s |
| `GET /items?parent_id=…&object_type=…&page_size=1` (a count) | 1 to 1.2 s, up to 10 s under load |
| 3 such filtered calls at once | ~2.3 s each |
| 8 such filtered calls at once | ~5 s each |
| `GET /items?parent_id=SandBox&page_size=10000`, 3 pages (all 20,470 children, 16.8 MB) | 1.7 + 1.6 + 1.0 s |

What these figures show:

- **A filtered query costs a full scan**, whatever it returns: counting one type of one parent
  takes about as long as listing 10,000 items. The cost grows with the size of the whole
  database, not with the size of the answer.
- **Filtered queries are served one after another**: running them in parallel does not help,
  each waits for the others (8 at once ≈ 8 × 0.6 s). During the load tests of 2026-10-04 they
  took 2 to 5 s each and the BFF, waiting 5 s at most, answered 504: the orbit view and the
  child counts could not load.
- **Answers carry whole items**: a mining rock weighs about 800 bytes (fractures, minerals)
  where the map needs its UUID, type, name and position.
- Counting children per type means **one query per known type** (about 30): the explorer, the
  object page and the orbit view need these counts.

The game is expected to grow by orders of magnitude (more planets, players, vehicles,
buildings, rocks). With full scans, every list and count in the admin slows down in proportion
to the whole database. The admin can soften this on its side — the map now reads a body in one
plain listing and keeps it 30 s (ADR 0018, update of 2026-10-04) — but such copies grow with the
data too: at a million items on a planet, reloading one would take minutes and hundreds of MB.

## Options considered

1. **Keep the current API, the admin caches more.** Snapshots and longer caches in the BFF.
   Cheap and already done where it matters most, but it only moves the cost: every snapshot is
   a full listing that grows with the game, and data gets older as caches lengthen.
2. **The admin keeps its own replica** (a read model indexed by parent, type and position).
   Fast reads, but without a change feed it is filled by full scans as well, and it duplicates
   the persistence service's job.
3. **Persistence offers the queries the admin needs** (detailed below). Each view asks only for
   what it shows; costs follow the size of the answer, not of the database.

## Decision (proposed)

We propose to ask the persistence team for the following, by order of benefit for the admin.
Nothing here is agreed yet; the admin works without any of it today.

1. **Indexes on `parent_id`, `object_type` and `scenename`** (alone and combined), so that a
   filtered query no longer scans the whole database. This alone speeds up every view of the
   admin, and very likely the game's own reads.
2. **Parallel reads**: filtered queries served concurrently rather than one after another.
3. **Counts per type in one call**, e.g. `GET /items/counts?parent_id={uuid}` →
   `[{ object_type, total }]` (a `GROUP BY`). Replaces about 30 queries per counted item.
4. **A spatial query within a parent**, e.g. `GET /items?parent_id={uuid}&within=x1,y1,z1,x2,y2,z2`
   (a box) or `near=x,y,z&radius=r`, in the parent's frame where positions are stored. Lets the
   map load only what is in view, mining rocks included, whatever the size of the planet.
5. **Field selection**, e.g. `fields=object_uuid,object_type,object_data.name,object_data.position`,
   to send only what a view needs (about 10 times less for the map).
6. **Changes since a time**, e.g. `GET /items?changed_since={timestamp}` with deletions reported
   (tombstones or a separate `deleted_since`), so a view refreshes what changed instead of
   reading everything again. Needs a modification time on every item.
7. **Cursor pagination** (`after={last uuid}` on a stable order) instead of page numbers, which
   get slower and shift when items are added or removed while paging.
8. **Several items by UUID in one call**, e.g. `GET /items?uuid=a,b,c`: the BFF resolves
   references and checks existence item by item today (or by a full scan beyond 50).

## Consequences

- If items 1 and 2 land, the admin needs no change to benefit: every view gets faster. The 5 s
  BFF timeout and its 8 parallel calls (`PERSISTENCE_TIMEOUT_MS`, `pLimit(8)`) can then stay.
- Until then, the admin keeps its stopgaps: counts cached 60 s, the map's body listing cached
  30 s and served stale while refreshed (ADR 0018). They will not hold at game scale.
- Item 3 would replace the per-type count loop of the BFF (`childrenCounts`); item 4 would let
  the map ask for its visible area (`bbox` from the web app) instead of a whole body; items 5
  to 8 would lower the volume and number of calls of the map, the explorer and the import.
- Each item, once offered, is adopted in the BFF behind the same BFF API: the web app does not
  change, except for the map sending its visible area (item 4).
- To be discussed with the back team: which of these fit the persistence design, their order,
  and whether a push or change feed (ADR 0009, option 4) is planned, which would also serve
  item 6.
