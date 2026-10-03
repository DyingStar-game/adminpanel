# 0009. Live refresh by polling the persistence REST API

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Manage persistence

## Context

The admin manages game entities in real time; game data changes constantly, so views must
stay live. What the platform offers:

- The persistence REST API has **no push** (no SSE, no WebSocket for REST clients).
- The persistence WebSocket (`:9100`) only relays writes made **through REST** (by the admin
  itself); updates coming from the game are not re-broadcast. Subscribing to it would not
  show game activity.
- Persistence reflects what the game **has saved**, not the instantaneous game state.
  Sampling the whole dataset every 5 s for 30 s (2026-10-01): only one sample had changes
  (4 items: a moving vehicle and its components). Moving entities are saved by the game at
  its own cadence, not continuously.
- `GET /items/{uuid}` is served from the in-memory cache; `GET /items` filters the whole
  cache in-process (cost grows with dataset size).

## Options considered

1. **Polling via the BFF** — works today, no service change.
2. **Subscribe to the persistence WebSocket** — does not carry game updates (see above).
3. **Read from Horizon / GORC** (true real-time state) — different service, protocol and
   access; out of lot 1.
4. **Ask the services team for a change feed** (SSE / WS broadcast of all writes) — best
   long-term, not available now.

## Decision

- Live = **polling through the BFF**, with a visible indicator (live / paused, last refresh)
  and a pause toggle, as in the mock-up.
- Default rates, configurable:
  - selected entity (inspector / object page / orbit centre): `GET /items/{uuid}` every **2 s**;
  - visible table page or tree level: refetch the current page every **5 s**;
  - nothing is polled when the tab is hidden.
- Changed fields are highlighted briefly (diff between two snapshots); appeared / vanished
  rows are marked.
- The BFF may coalesce identical concurrent polls (several viewers, same page) with a
  short-lived cache, to keep the load on persistence bounded.
- Option 4 is filed as a request to the services team.

## Editing a live entity

`PUT` is a full replace and is pushed to the game immediately. If the game saved a newer
position meanwhile, a stale `PUT` would move the entity back.

- When editing, live updates keep flowing and fields changed by the game since edit start
  are flagged.
- On save, the BFF re-reads the item and sends **the latest version + only the fields the
  user changed** (field-level merge), reducing the overwrite window to a few milliseconds.
- If a field the user changed was also changed by the game meanwhile, the user is asked
  to confirm.

### Update (2026-10-04): entity every 5 s

The game saves an item about every 60 s, so polling the selected entity every 2 s showed
nothing more than every 5 s: at the maintainer's request it now follows the list rate, 5 s.

## Consequences

- "Live" means "as fresh as the game's last save", which must be stated in the UI.
- Polling load grows with viewers × open views; bounded by rates and BFF coalescing.
- `DELETE` is not propagated to the game by the service: deleting a live entity may leave
  it in game until reload. To be raised with the services team; the UI must warn.
