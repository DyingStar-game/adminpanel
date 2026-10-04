# 0016. Scene schematics: declarative views per `scenename`

- **Status:** Accepted
- **Date:** 2026-10-02
- **Scope:** Manage persistence

## Context

Type profiles ([ADR 0008](./0008-combined-navigation-type-aware-views.md)) refine how a whole
`object_type` is shown. Within a type, the actual model is identified by its `scenename`
(e.g. `scenes/_universe/vehicles/ground/trucks/truck.tscn`), and the maintainer knows what a
model looks like: the truck has two seats, a cargo bed and component compartments. A small
schematic of the model, bound to the live data, makes an entity readable at a glance.

Live data of a truck (2026-10-02, 16 trucks):

- `seats`: `{ SeatDriver, SeatPassenger }` → player UUID or `""` (empty seat);
- `components`: `{ Slot_FL, Slot_FR, Slot_RL, Slot_RR }` → **component compartments** (not
  wheels), each holding a `vehicle_component` (today 4 × `engine_t1.tscn`, whose `slot_id`
  names the compartment);
- `doors`, `engine`, `headlights`: only present while the truck is used;
- `speed`, `limiter_kmh`, `handbrake`, `mass`, `cargo_mass`; no known cargo capacity;
- `suspension`: one value per wheel, meaning not specified yet — left aside.

The maintainer wants this for the truck first, then for other models once the result suits.
It must be simple to maintain.

## Options considered

1. **One hand-drawn React component per model** — free-form, but every model is code to
   write, review and keep consistent.
2. **Declarative schematic per model, one generic renderer** — a small data file per model
   (shapes, slots, readouts bound to data paths), validated by Zod.

## Decision

Option 2.

- One file per model in `apps/web/src/lib/schematics/`, registered in an index and matched on
  the exact `scenename` (or a `*` pattern within one path segment, for variants).
- A closed vocabulary, extended only when a new model needs it:
  - **shapes**: `body`, `cargo` (rectangles on a grid, optional value drawn inside, e.g.
    `cargo_mass`);
  - **slots**: `seat` (reference to a player: occupied / empty), `bay` (component
    compartment: installed component shown by its own `scenename` model name, empty, or
    broken reference), `door` (open / closed / unknown);
  - **readouts**: `gauge` (number with an optional maximum read from another path, e.g.
    `speed` / `limiter_kmh`), `toggle` (boolean), `value` (number with unit).
- Labels are short keys translated under `schematic.labels.*`, falling back to the raw label.
- One generic organism draws any schematic in SVG, in the mock-up style; seats and bays link to
  the referenced entity; live refresh updates it like the rest of the page.
- Shown on the object page, in a card next to the usual information. Items without a
  matching schematic are unchanged.
- A test validates every schematic and checks that its paths exist in a sample item.

### Update (2026-10-02): doors swing open

A door is drawn as a leaf hinged at its front end (`at` minus one grid unit): flush with the body
when closed, swung out by 55° when open, towards the left for doors on the left half of the
drawing and the right otherwise, with its swing arc and the opening left in the body. How to add
a schematic is summed up in [`CLAUDE.md`](../../CLAUDE.md) ("Extension points").

### Update (2026-10-03): compartment hatches, component kinds and energy

The game renamed the vehicle keys to snake_case and replaced `Cube_004` … `Cube_007` by the
compartment hatches `doors.hatch_fl` … `hatch_rr`. The compartments are under the cargo bed,
reached through these hatches:

- a bay may declare a `hatch` (`at` on the body's edge, `path` of its open state), drawn like a
  cab door; the truck's bays sit inside the bed, their hatches on its sides;
- `lib/schematics/components.ts` reads a component's kind and tier from its scene
  (`engine_t1`, `battery_t1`) and holds what a tier gives (battery capacity 180 MJ and engine
  power 100 kW for T1, game team figures to be validated); a battery bay shows its charge
  (`charge_j` against the capacity) as a percentage and a gauge;
- a new readout kind `energy` sums the installed batteries' charge and estimates the autonomy on
  flat ground from the installed engines (180 MJ ≈ 30 min / 50 km with one T1 engine).

### Update (2026-10-03): batteries in kWh, battery schematic

The game shows a battery's charge in kWh (a T1 holds 50 kWh = 180 MJ; `charge_j` of
172 424 831 J reads 47.9 kWh in game): every charge in the schematics is now written in kWh,
persistence keeping joules. Batteries get their own schematic
(`scenes/_universe/props/vehicles/battery_t*.tscn`), a cell drawn as a progress bar of the
charge against the tier capacity, through a new shape kind `battery`.

### Update (2026-10-03): headlights, no repeated facts

The truck's headlights are drawn on the front edge of the cab (`lights`, bound to
`headlights`), with a small cone when on. The object page no longer repeats in its key facts
the values the schematic already shows (a fact made only of keys read by the schematic is left
out); the energy left (kWh over the capacity, with a charge bar) joins the key facts.

### Update (2026-10-04): celestial bodies

Planets, moons (`scenes/systems/tarsis/tarsis_*.tscn`) and the star get a schematic through a
new shape kind, `celestial`, drawn from the body's facts on the project wiki (`lib/bodies.ts`,
ADR 0018 update): the disc with its designation and name, radius and gravity (temperature for
the star), an arrow with its day length, and its moons on their orbits, innermost first, sized
to their radius against the planet's. The drawing takes the page's whole width; every body
drawn around another opens its page (the star shows its planets, a moon its planet's system
with itself highlighted and pulsing), and a line gives the facts of the body on screen (a
moon's own radius, gravity and revolution). The wiki page is linked above the drawing.

## Consequences

- Adding a model = adding one data file and one line in the index.
- The vocabulary will grow with the next models (e.g. shelves, cargo depots); each addition
  is a small change of the renderer, documented here or in a follow-up ADR.
- `suspension` is not drawn until its mapping to wheels is known.
