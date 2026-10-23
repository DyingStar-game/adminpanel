# 0029. What a crate holds: its page, its schematic and the contents of what carries it

- **Status:** Accepted (2026-10-23)
- **Date:** 2026-10-23
- **Deciders:** maintainer
- **Scope:** Manage persistence, Frontend
- **Builds on:** [ADR 0008](./0008-combined-navigation-type-aware-views.md) (type profiles and
  their renderers), [ADR 0016](./0016-scene-schematics.md) (scene schematics, a cargo shape's
  contents)

## Context

Crates are a core of the gameplay: a mining depot packs its ore into one, players carry it, load
it into a truck's bed and store it on a depot's shelves. The maintainer wants to see what a crate
holds, on its page and wherever it lies, as the truck's bed shows its rocks.

What the game does (`DyingStar-game/DyingStar`, `7c1429f`, 2026-10-23):

- `crate_container` is the type of two scenes sharing `crate_container.gd`:
  `props/containers/crate_container.tscn` (the 108 crates of the test server, `content: {}`) and
  `props/containers/hauling_box.tscn`, the crate a **mining depot** packs (`mining_depot.gd` ›
  `handle_extract`): `content: { ore_volume, mineral, units }`, **one mineral per crate**,
  `ore_volume` in m³ and `units` in litres (≈ 0.066 m³, 66 L), `weight` in kg. Its definition
  (`crate_container_def.json`) lists `content` (zone 6).
- **Where a crate is**, read from its `parent_id`: on the body (on the ground, or on a shelf: a
  shelf only marks the slot taken, `shelf_slots_occupied`, it does not become the parent,
  `shelf.gd`), in a player's hands (the player is its parent while carried) or in a vehicle (the
  vehicle is its parent, as `food` in trucks today).
- On the test server (2026-10-23): one `hauling_box` with `{ mineral: gold, ore_volume: 0.066,
  units: 66 }` and `weight: 50`; `gold` is the only mineral of the mining rocks.

Today the page shows `content` as a folded "3 keys" to open, its keys and raw values inside
(`ValueView`); there is no schematic for a crate, and a truck's bed draws crates as one
"×N crate_container" box, without what they hold.

## Options considered

1. **Read `content` with a generic renderer** (`namedMap`): its three keys one per line — no new
   vocabulary, but `units` without its unit, the mineral as an id, the same three lines in a bed.
2. **One meaning for "goods"**, shared by the profile, the schematic and the bed: a renderer and a
   schematic option that read `{ mineral, units, ore_volume }` and say "66 L of gold
   (0.066 m³)", the mineral named from `schematic.minerals.*`.

## Decision

We will take **option 2**, extending the closed vocabularies of ADR 0008 and ADR 0016 by one
word each, for this shape only.

- **Goods** (`lib/goods.ts`): `goodsOf(value)` reads `{ mineral, units, ore_volume }` (Zod, every
  field optional but `mineral`); `{}` or no `mineral` is **empty**. A mineral is named from
  `schematic.minerals.<id>`, its id when unknown.
- **Profile `crate_container`** (ADR 0008): a new renderer **`goods`** for `content`: "66 L of
  gold · 0.066 m³", "empty" for `{}`; headline `content`, `weight`; columns `content`,
  `parent_id`, so a list of crates says what each holds and where it is.
- **Schematic `crate`** (ADR 0016) for both scenes (two exact `scenename`s, one file): a `cargo`
  shape with a new option **`goods: <path>`** (`content`): the crate's own load drawn as one
  content box beside it, as a rock group is beside the bed (the mineral's colour, its units and
  weight, its name), "empty" otherwise; readout `weight`. The page already says where the crate
  is (breadcrumb, `parent_id`).
- **Contents of what carries it** (a truck's bed, `contentsOf`): crates are grouped by
  **mineral** (`crate_container` + `gold`), empty ones together; a group's box says its count,
  weight and mineral; its detail lists each crate with its units, and opens it.

## Consequences

- Two words added to closed vocabularies (`goods` renderer, `goods` shape option), tested on a
  fixture with the real shape (`packages/testing`, a `hauling_box` in the truck's bed).
- Other goods (a `deliver_material` cargo, food) will need their own shape: `goodsOf` stays
  strict on the depot's three keys rather than guessing.
- A crate stored on a shelf shows the body as its parent: telling which shelf holds it needs the
  shelf's slots in world space, left aside.

## Update (2026-10-23): a crate opens the list of what it holds

At the maintainer's request, a crate behaves like the ore: a click on its box lists, under the
drawing, what it holds instead of opening it. On a truck, a group of crates opens that list even
for one crate (each line, with its litres, volume and mass, then opens its crate); on a crate's
page, its own load opens the list of its mineral, quantity, volume and mass ("Holds: Gold").

## Update (2026-10-23): crates as one box, like the ore; who sits is not carried

At the maintainer's request (crates will hold more than gold): the crates a truck carries are
**one box, "×N Crate"**, whatever they hold, as the rocks are one "Ore" box whatever their
mineral — replacing the grouping by mineral above. A click lists them flat, with no section by
mineral: each line names the crate, says what it holds ("Gold · 66 L · 0.066 m³", or "empty")
and its weight, and opens it.

Contents also leave out **who sits in the vehicle**: a driver is the vehicle's child in
persistence. A child is seated when a schematic seat references it, or when it is a player whose
own `seat` is set: the player and the vehicle are saved apart (the test server had `ddurieux`
with `seat: "driver"` while the truck's `seat_driver` was still empty).
