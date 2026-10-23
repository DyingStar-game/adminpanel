# 0026. Mission objective schematics: a declarative view per objective kind

- **Status:** Accepted (2026-10-23)
- **Date:** 2026-10-23
- **Deciders:** maintainer
- **Scope:** Game services (`mission`, `inventory`)
- **Builds on:** [ADR 0016](./0016-scene-schematics.md) (scene schematics),
  [ADR 0018](./0018-planetary-map.md) (body frame, latitude / longitude),
  [ADR 0023](./0023-keycloak-authentication.md) and [ADR 0024](./0024-game-services-social-first.md)
  (services, rights)

## Context

A mission's page (lot 2 step O.5) lists its objectives in a table: title, kind, progress and
the kind's `params` as raw JSON (`{"goodType":"water_barrel","zone":{"kind":"poi","poiId":"…"}}`).
The maintainer wants what an objective asks to be readable at a glance, as the scene schematics
do for persistence items: "a delivery mission: I suppose something is picked up somewhere and
taken elsewhere?" (2026-10-23), and each kind to say **what the player has to do**.

What `mission` does, read in its code (`develop` `0c14db4`, `src/kinds/objectives/`, README ›
« Catégories contraignantes », « Mesure automatique »):

- **A mission's category is a label**; what is asked is in its objectives, each of one kind of a
  registry. A `delivery` mission may hold `deliver_material`, `transport`, `visit`,
  `owns_items` or `manual` objectives (the README's matrix; `divers` takes any kind).
- The kinds, their `params` (checked strictly at creation) and their measure:

  | Kind | `params` | What the player has to do |
  |---|---|---|
  | `deliver_material` | `goodType`, `zone` (a POI), `scope` (`assignee` / `all`) | Be **inside the delivery POI carrying** the quantity of the good; where it comes from is not checked. `scope: all` adds up what every active assignee inside the zone carries |
  | `transport` | `goodType`, `source` (a POI), `zone` (a POI) | **Load at A, then deliver at B**: two phases, the pick-up latched in the objective's `state.pickedUpAt`, then the delivery counted at B |
  | `transport_passenger` | `passengerId`, `zone` | Bring that player, seated but not driving, to the POI |
  | `visit` | `zone` | Reach the POI; done at the first visit |
  | `owns_items` | `itemId`, `scope` (`total` / `available`) | Own the quantity in `inventory` (a snapshot: it can go down) |
  | `manual` | none | Confirmed by the mission's issuer |

  Every kind but `owns_items` keeps its highest progress (high-water mark). The service measures
  from the players' states the game server pushes (`PUT /api/internal/missions/player-states`:
  place and goods carried), which it does not serve back: the panel sees the objective's stored
  progress and `state`, not where a carrier is now.
- **A POI is `inventory`'s** (`inventory/Readme.md`, `d3f177b`): a name, a `system`, a `scene`
  (the body whose frame x / y / z are in, metres from its centre; `space` = the system's frame),
  an optional `radiusM`, an owner and a visibility. `GET /api/internal/pois/:poiId` (section
  Interne, « Rôle requis » `inventory:read`) serves one; `svc-admin` holds `inventory:read`.
  Its frame is the one of persistence items on a body (ADR 0018: +Y pole, longitude 0 on +X),
  so a POI's latitude and longitude come from the panel's geometry as they are.
- `mission`'s `GET /api/missions/kinds` serves each kind's name and summary in `en` / `fr`, but
  written for developers ("measured against carried goods + player-state"), and it is a player
  route (ADR 0023: not used).
- Minikube's missions point at POIs `inventory` does not hold (the seed's placeholders): a POI
  may be unknown, and must be shown as such.

## Options considered

1. **Per mission category** — one drawing for `delivery`, one for `transport`… Simple to name,
   but wrong: a category does not say what is asked, and one mission mixes kinds.
2. **One hand-written component per objective kind** — free-form, but each kind is code to
   write and keep consistent, as ADR 0016 found for models.
3. **A declarative schematic per objective kind, one generic renderer** — the pattern of
   ADR 0016, applied to the objectives: a small data file per kind, validated by Zod.

## Decision

Option 3.

### One file per objective kind

`apps/web/src/lib/objectiveSchematics/<kind>.ts`, registered in an index on the exact `kind`,
validated by Zod at load time, with a closed vocabulary extended only when a kind needs it:

- **`places`**: the POIs of the objective, each a path in `params` (`zone`, `source`) and a role
  (`pickup`, `dropoff`, `target`), drawn in order and joined by an arrow (`source` → `zone` for
  `transport`); a `scope: all` delivery is marked as pooled;
- **`good`**: what is carried or owned, from a path (`goodType`, `itemId`), with the objective's
  quantity and unit;
- **`player`**: a player to bring (`passengerId`), linked to their sheet when `social` may be read;
- **`phase`**: a two-phase kind's step, from the objective's `state` (`pickedUpAt` set → loaded,
  on the way);
- **`progress`**: the stored progress against the target, as a gauge (a latch for `visit`).

Each kind has its **instruction**, the "what the player has to do" column above, written for the
panel's readers in `en` and `fr` under `missions.objectiveKinds.<kind>.instruction`, filled with
the objective's values (good, quantity, POI names). The panel writes its own sentences rather
than `mission`'s developer summaries; a kind added to `mission`'s registry is shown generically
(its name as stored, its `params` as JSON) until it gets a file.

### Where

On a mission's page, the objectives become one card per objective, in `mission`'s order
(required ones first, bonus ones after, with their reward): its title and status, its
instruction, its schematic (an SVG drawn like the scene schematics: places as pins on a line,
the arrow between them, the good and its quantity on the arrow, the gauge), weight and bonus as
today. The raw `params` stay available, folded. A `manual` objective has no drawing, only its
instruction and who confirms it.

**Amended by [ADR 0027](./0027-mission-places-map.md) (2026-10-23)**: the strip of pins was not
usable visually; the places of every objective are drawn on one map of the mission instead, and
the card lists its places as text.

### POIs, read from `inventory`

- The BFF resolves an objective's POIs through `inventory`'s `GET /api/internal/pois/:poiId`
  **as `svc-admin`** (Interne section, `inventory:read`), with the mission's detail: one call per
  distinct POI, cached a minute. `inventory` gets its own client, URL (`INVENTORY_URL`) and
  contract in `packages/contracts`, as ADR 0024's pattern says (the `inventory` step starts with
  this read).
- A POI is shown by its name, its body (the scene matched to `lib/bodies.ts`, as the
  schematics' `celestial` shape does) and, on a body, its latitude / longitude and its distance
  to the other place of the objective along the surface (both on the same body; through space
  otherwise, not computed). Its id stays copyable.
- **Rights**: a person reading missions holds `mission:read`; seeing POI names also needs the
  README's `inventory:read` on `dyingstar-admin` (ADR 0023's rule for Interne sections). Without
  it, or when `inventory` is not configured, does not answer or has no such POI, the place is
  drawn with its id and "unknown place" — the drawing never fails.

### Not in this decision

- **Where a carrier is now**: `mission` does not serve the players' states, and the panel does
  not need them (maintainer, 2026-10-23: "we just want the mission's information"); the drawing
  shows stored progress only.
- **POIs on the body map** (ADR 0018): a place could open the map centred on it. Kept for a
  follow-up once POIs are read; the latitude / longitude are computed the same way.

### Update (2026-10-23): the card rearranged, steps from 1, the simulation's missions

At the maintainer's request ("this objective card is messy"): a step bubble counted **from 1**
(`mission` stores them from 0; the map's titles count the same way), the title with its kind,
bonus and weight, the status and "On the map" on the right; under them the sentence, the places
**in a column** (each role's bubble joined to the next by a dotted line, the distance along the
surface beside it), a place's details (body, position, altitude, zone, id) on a click on its
name, then the progress on one line and the parameters folded.

Missions published by `universesimulator` (ADR 0025: one per leg of a supply order) are linked
both ways: a leg's mission opens its page from the Simulation's orders, for who reads `mission`;
a mission's page shows the order and leg it carries (kind, status, resource, villages, quantity,
reward) with a way to the order, for who holds `simulation.view`, found among the latest 100
orders (its API filters no order by mission).

## Consequences

- Adding a kind = one data file, its instruction in `en` / `fr` and one line in the index; a
  test checks every file against a sample objective of its kind (fixtures with the real
  `params` shapes, as ADR 0016's test does with items).
- The `inventory` step starts with POIs (contract, client, mock from its code, `INVENTORY_URL`,
  the right `inventory:read` in ADR 0023 and `docker/keycloak/*.json`); the seed creates real
  POIs (`POST /api/internal/pois`, `inventory:poi:manage`, held by `svc-admin`) for its missions'
  objectives instead of placeholders.
- `inventory`'s OpenAPI is not valid YAML at `develop` `bdee3c0` (lot 2 plan, question 21): its
  contract is pinned but not generated, and the POI the panel reads is written from its code
  (`packages/contracts/src/inventory/code.ts`), as `mission`'s rows are.
- Accepted by the maintainer on 2026-10-23: `inventory:read` held by the person for the POI
  names (ids only without it), the `inventory` step started by this read, no carrier position.
