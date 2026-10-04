# 0017. Duplicating an item, with its children, next to a player

- **Status:** Accepted
- **Date:** 2026-10-02
- **Scope:** Manage persistence

## Context

To test in game, the maintainer wants to copy an existing item (e.g. a truck) and spawn the copy
next to their player. An item is rarely alone:

- its **children** (`parent_id`) belong to it: a truck owns its four `vehicle_component`
  engines, and `components.Slot_*` points to them;
- it may **reference other entities**: `pilot_uuid`, `seats.*` point to players.

Positions are relative to the parent ([ADR 0003](./0003-persistence-lot-1-items-scope.md)), so
"next to a player" means: the player's parent, a position in front of the player. The admin has
no authentication ([ADR 0002](./0002-no-admin-authentication.md)): it does not know who "me" is.

## Decision

- **Children are duplicated too**, recursively (option A). Every copy gets a new UUID; every
  reference to an item of the copied set is remapped to its copy (`parent_id`, `components.*`,
  `object_data.uuid`, …), so the copy is self-consistent.
- **References to entities outside the copied set are emptied** (`""`): the copy has no pilot,
  no passenger, no external link.
- The root copy gets the target parent, position and rotation; descendants keep their own positions,
  relative to their (copied) parents.
- The duplication is done by the BFF (`POST /api/items/{uuid}/duplicate`): read the subtree, map
  UUIDs, then create parents before children through `POST /items`. It is refused above
  **200 items** (`DUPLICATE_TOO_LARGE`) and for types without definition (ADR 0015). A failure in
  the middle reports the items already created (`DUPLICATE_PARTIAL`): no rollback.
- Targets in the UI: **next to a player** (picked in a list, human players first, the choice
  remembered in the browser as "me") or **next to the original**. Placement reuses the
  "spawn next to" rule: same parent, in front of the reference and above it (distance and height
  per type, editable), facing the same way and upright. "Up" is the local vertical: on a
  celestial body (reference more than 1 km from its parent's origin, i.e. a planet whose centre
  is the origin) it is the radial direction and the rotation aligns the copy with the ground;
  elsewhere it is the parent's +Y and only the yaw is kept. Rotations are Godot Euler angles,
  order YXZ (checked against the live vehicles resting on SandBox).

### Update (2026-10-04): the state of the moment is not copied

A duplicated truck appeared upright, then sank into the ground, while "spawn next to it", with
the same placement, did not. Spawning writes only the parent, scene, position and rotation; the
duplicate copied the vehicle's state of the moment too (compressed `suspension`, `speed`,
`steering`…). Each type profile now lists such fields (`duplicateOmit`), sent with the request
(`omit`, per `object_type`) and left out of every copy, children included; the game sets them
again as for a new item. The truck leaves out `suspension`, `speed`, `steering`, `engine`,
`handbrake`, `horn`, `horn_special`, `limiter_on` and `odometer_km`, and keeps its scene,
doors, headlights, limiter speed, masses and components. A type without a list is copied
whole. The type definitions do not tell state from configuration (their channels are network
sync zones): marking it there is requested from the game team (ADR 0021).

## Consequences

- One request from the browser; the copy is created in a few `POST /items`, each pushed live to
  the game by persistence.
- While the game does not report player positions to the API, "next to a player" uses the
  player's last saved position.
- Copying large subtrees (a planet with thousands of rocks) is not possible by design.
