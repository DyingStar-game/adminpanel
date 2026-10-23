# 0027. A mission's places on a map

- **Status:** Accepted (2026-10-23)
- **Date:** 2026-10-23
- **Deciders:** maintainer
- **Scope:** Game services (`mission`, `inventory`), Frontend
- **Builds on:** [ADR 0026](./0026-mission-objective-schematics.md) (objective schematics, POIs
  from `inventory`), [ADR 0018](./0018-planetary-map.md) (the 2D map frame, its geometry),
  [ADR 0025](./0025-universe-simulation-section.md) (`MetricMap`, the network map)
- **Amends:** ADR 0026 › Where (the drawing of an objective's route)

## Context

ADR 0026 draws each objective's places as a strip of pins joined by an arrow, under its card.
The maintainer finds it **not usable visually** (2026-10-23) and asks for **an equivalent of the
simulation's network map** for the objectives that send players somewhere: the places on the
ground, at their true distances, as the villages and routes are drawn.

What is at hand:

- `molecules/MetricMap` (ADR 0025): Leaflet in `CRS.Simple`, coordinates in projected metres
  east / north, a metric grid following the zoom and a scale bar. The network map draws its
  villages (a disc and the name above), routes (lines) and legs (lines with a head) in it.
- A POI from `inventory` holds x / y / z in metres from the centre of the body its `scene`
  names (ADR 0026), the frame of persistence items on that body (ADR 0018), and an optional
  `radiusM` (a zone).
- The network map places villages **in the planet's map frame from persistence**
  (`/api/bodies/:uuid/map`), which needs the planet's persistence UUID and `persistence:read`. A
  POI has no such UUID (`parentId` is optional, unset on the seed's), and several persistence
  items share a planet's scene (`tarsis_3.tscn` twice on 2026-10-23, GET only): the planet
  cannot be found from the scene alone.

## Options considered

1. **The planet's persistence frame** (as the network map) — markers land exactly where
   `/map/$uuid` draws objects, but it needs the planet's UUID (unknown for a POI, ambiguous by
   scene) and `persistence:read`, which a mission reader may not hold.
2. **A frame of the mission's own places** — the same projection (azimuthal equidistant,
   ADR 0018's geometry) centred on the places of the body, computed in the SPA from the POIs:
   true distances and directions around them, no persistence read, no new right. Persistence
   objects are not drawn around them.

## Decision

Option 2, drawn like the network map.

- **One map per mission**, a "Places" section above its objectives, for every place of every
  objective (`places` of ADR 0026's schematics): a disc per POI with its name above, its colour
  by role (load, deliver, reach), a POI used by several objectives drawn once with all of them in
  its title; a `radiusM` zone as a circle of that radius; a `transport` as a line from where the
  goods are loaded to where they are delivered, with a head at its end, dashed until the goods
  are loaded (`state.pickedUpAt`), its distance along the surface in its tooltip. The view fits
  the places.
- **Objectives and map are linked**: choosing an objective (its card) rings its places and dims
  the others; a click on a place chooses the first objective using it.
- **The frame**: centred on the mean direction of the places of the body, on a sphere of their
  mean distance from its centre (ADR 0018's `azimuthalEquidistant`). A mission with places on
  several bodies picks the body shown (the one with most places first); places in open space
  (`scene: space`), unknown to `inventory` or not read are listed under the map, not drawn.
  Without `inventory:read` (ADR 0026), the map says the places were not read.
- **The objective's card** keeps its sentence, its progress and its places as text (name, body,
  latitude / longitude, altitude, zone, id); the strip of pins is removed.
- The map's code follows the network map's: an organism drawing in `MetricMap`, pure helpers in
  `lib/places.ts` (projection, layers), tested.

### Update (2026-10-23): the planet's landmarks, shown or hidden by type

Asked by the maintainer the same day: show and hide the planet's objects around the places as on
the persistence map, **only the fixed ones that help find one's way**, not vehicles, players or
mining rocks. For who reads persistence (`persistence:read`):

- the body is found in persistence by its scene model (the planet whose `scenename` ends in the
  POIs' `scene`, `tarsis_3` → `…/tarsis_3.tscn`; one on 2026-10-23, the duplicate seen earlier
  was not one), and its map (`/api/bodies/:uuid/map`, ADR 0018) is read with every type but the
  landmarks left out (`hide`);
- **landmarks** (`lib/places.ts` › `LANDMARK_TYPES`): villages, cities, cargo and mining depots,
  mining zones, spawn buildings, buildings, simple buildings, storage warehouses and areas; not
  crates, vehicles, lifts, players, rocks, stations. Each is a small square of its type's colour;
  a legend beside the map (the persistence map's `MapLegend`) shows or hides each type and its
  names (villages and cities named by default; no names below 1 px = 64 m, they would pile up);
- the places are then projected **in the planet map's frame** (its centre and reference radius),
  so they stand among the landmarks exactly where `/map/$uuid` draws them. Without
  `persistence:read`, the map keeps the places' own frame and says landmarks need it.

The seed's POIs stand on SandBox's real objects since (a village's cargo depot, the village, a
mining depot and its nearest mining zone, the farthest mining zones, the orbital station), the
object noted in the POI's `metadata` (`inventory`'s `parentId` is a parent POI in its code: lot 2
plan, question 22).

## Consequences

- No persistence read and no new right: the map works for anyone reading missions with
  `inventory:read`.
- Persistence objects (buildings, vehicles, players) are not drawn around the places, and the
  map's coordinates differ from `/map/$uuid`'s. If wanted later, a POI's `parentId` (when set) or
  a planet chosen by the reader could put the places in the planet's frame (option 1) and link
  to its map.
