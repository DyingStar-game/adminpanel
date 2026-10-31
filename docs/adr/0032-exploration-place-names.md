# 0032. Exploration section: reviewing the names players give the places they discover

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** maintainer, game team, back team (`social`, `inventory`)
- **Scope:** Persistence, Game services (`social`, `inventory`), Frontend
- **Builds on:** [ADR 0006](./0006-object-type-definitions.md) and
  [ADR 0015](./0015-unknown-object-types-refused-on-write.md) (object types),
  [ADR 0023](./0023-keycloak-authentication.md) (permissions, calling the services),
  [ADR 0024](./0024-game-services-social-first.md) (how a game service enters the panel)

## Context

The game wants players to explore. The first player to discover a place becomes its
**discoverer** and proposes a name for it. In the lore, the name only becomes official once
**ARES** (the corporation that owns Tarsis IV, through ARES Mine) has approved it. In practice,
an admin of the panel approves it.

Caves are the first kind of place: a player discovers a cave by entering it. Lakes, planets,
asteroids and other kinds will follow. So the review must not be specific to caves.

What the game does (DyingStar, `server/discoveries.gd`, `scenes/exploration/discovery.gd`):

- **One record per discovered place.** It is a persistence item of the new object type
  **`discovery`** (`horizonserver` › `ds_genericprops/props/discovery_def.json`). Its uuid is
  stable: `uuid5("discovery:<place_kind>:<place_id>")`.
  - It is a child of the place's own item (`parent_id`), so a re-import of the places never
    touches it.
  - The game server creates it **once**, and changes it only by updates afterwards: a second
    create would replace the whole stored record.
- **Fields of `object_data`:**
  - `place_kind` (`cave` for now), `place_id`, `place_uuid`, `planet_name`;
  - `discoverer_id` (the player's Keycloak `sub`), `discoverer_name`, `discovered_at` (unix s);
  - `status`, `proposed_name`, `proposed_at`, `approved_name`, `refusal_reason`, `decided_at`
    (unix s);
  - `poi_id`: the discoverer's own point of interest in `inventory`.
- **Statuses:**
  - `unnamed`: found, nothing proposed;
  - `pending`: a name awaits review;
  - `approved`: published;
  - `refused`: the discoverer may propose another name.
- **The name rule:** 3 to 40 characters, letters of any alphabet, digits, spaces, apostrophes
  and hyphens. Both the game client and the game server check it.
- **The discoverer's point of interest.** At discovery, the game server creates a **private**
  point of interest for the discoverer in `inventory` (`POST /api/internal/pois`, owner
  `player`). The player sees it on their star map and can share it like any other. Its
  `metadata` is `{kind, discovery_uuid, place_uuid, place_id, uncharted}`. The game renames it
  after the proposed name.
- **What the game does once a name is decided.** The game server receives the panel's edit of
  the item live (`update_object_from_external`). The game client then shows the approved name in
  a banner when a player enters the place, and turns the two notification types below into
  ARES messages.

## Options considered

1. **The generic item editor.** The admin opens each `discovery` item and edits its fields by
   hand. It needs no code. But nothing lists what is waiting, the status values are free text,
   and the discoverer is never told.
2. **A cave-specific page.** It is simpler today. But each new kind of place would need its own
   page and its own menu entry.
3. **An "Exploration" section with one review page for every kind of place.** The page lists
   the `pending` discoveries, whatever their `place_kind`, and approves or refuses each one. It
   also tells the discoverer and renames their point of interest.

## Decision

We will add an **Exploration** section to the sidebar, with a first page, **Names to review**
(`/exploration/names`).

**The list.**
- `GET /api/exploration/discoveries?status=&kind=&page=` reads every item of type `discovery`
  (`items.listAll`, since persistence cannot filter on a field) and filters in the BFF.
- It defaults to `status=pending`, oldest proposal first.
- Each row shows:
  - the kind of place;
  - the proposed name;
  - the discoverer, through `EntityLink`;
  - the planet;
  - when the place was found and when the name was proposed;
  - a link to the place's own item.
- A kind filter covers every `place_kind` met, so a new kind of place needs no new page.

**Approve.** `POST /api/exploration/discoveries/:uuid/approve {base, name}`:
1. `items.update` sets `status: approved`, `approved_name` and `decided_at`.
   - `name` defaults to the proposed name. The admin may correct it, and the same rule as the
     game applies.
   - `base` is the item as the admin read it. A concurrent change of the same fields answers
     `409 EDIT_CONFLICT`, as every edit does; `proposed_name` is sent as read too, so a proposal
     changed since the reading is never decided by mistake.
   - A discovery whose name is not `pending` answers `409 DISCOVERY_NOT_PENDING`; an item that
     is not a discovery answers 404.
2. When `poi_id` is set, the discoverer's point of interest is renamed with the approved name and
   `uncharted: false` (`inventory` `PATCH /api/internal/pois/:id`).
3. The discoverer is told, with `type: place_name_approved` and
   `data: {kind, name, discoveryId}`:
   - live, through `social` `POST /api/internal/players/:id/notifications`;
   - in their stored activity history, through `POST /api/internal/players/:id/activity`, since
     a live notification is lost when the player is offline.

**Refuse.** `POST /api/exploration/discoveries/:uuid/refuse {base, reason}`:
1. `items.update` sets `status: refused`, `refusal_reason` and `decided_at`.
2. The discoverer is told in the same two ways, with `type: place_name_refused` and
   `data: {kind, name, reason, discoveryId}`.

**After the decision.**
- The item update is the decision. Renaming the point of interest and telling the player come
  after it, and each failure of theirs is reported in the answer (`poiRenamed`, `notified`,
  `recorded`) rather than undoing the decision.
- Both routes are mounted with `auditWrites('persistence', audit)`. The action is in the path,
  because bodies are not logged.

**Rights.**
- Listing requires `persistence.read`; deciding requires `persistence.write`.
- The calls to `social` and `inventory` go out as `svc-admin`. Under ADR 0023 the person must
  hold the role each one needs, as a client role on `dyingstar-admin`; three new permissions:
  - `social.notify` (`social:notify:write`): telling the player live. A decision needs it, with
    `persistence.write`;
  - `social.playerWrite` (`social:player:write`): recording the decision in the player's
    activity history; without it, `recorded` is `false`;
  - `inventory.poiManage` (`inventory:poi:manage`): renaming the discoverer's point of interest;
    without it, `poiRenamed` is `false`.
- ADR 0023's rights table, `permissions.ts` and the Keycloak files are updated.

**Schemas.** `packages/schemas/src/discoveries.ts` holds:
- the `discovery` `object_data`, with `place_kind` an open string and the known kinds listed for
  the labels;
- the two decision bodies and the list response.

## Consequences

- **A new kind of place costs the panel nothing.** It needs a label in the kind filter's
  translations, at most.
- **Dependencies:**
  - the `discovery` type must be on `horizonserver` `develop` (horizonserver#138), followed by
    `make definitions-update`, for the generic item pages to know it. The Exploration routes do
    not depend on it: they read `object_type=discovery` directly (`items.allOfType`), and an
    update never checks a type it does not change;
  - the `social` notification route exists in its code but not in its README or OpenAPI. It is
    called through a hand-written Zod schema that follows the code, as ADR 0024 allows, and
    `docs/back-team-questions.md` asks the back team to document it.
- **Listing reads every discovery.** That is acceptable while there are thousands. A persistence
  filter on `object_data` fields would remove it (back-team question).
- **The game's own saves cannot undo a decision.** The game server never writes `status`,
  `approved_name` or `refusal_reason` back to `approved` or `refused` itself: it only moves a
  discovery from `unnamed` or `refused` to `pending`. The decision is also merged field by
  field.
- **Later pages can join the section:** every discovery, a discoverers' leaderboard, revoking a
  published name.
