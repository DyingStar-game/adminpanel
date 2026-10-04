# 0018. Planetary map: a 2D view of everything placed on a celestial body

- **Status:** Accepted
- **Date:** 2026-10-02
- **Scope:** Manage persistence

## Context

The maintainer wants a 2D map of a planet showing the positions of what it holds (players,
buildings, vehicles…), with types shown or hidden and a search.

Live data of SandBox (2026-10-02, GET only):

- **896 direct children**, every one with a `position` relative to the planet centre: 592
  `miningrock`, 188 `spawnbuilding`, 55 `poi_village`, 20 `vehicle`, 18 `cargo_depot`,
  16 `mining_depot`, 3 `miningzone`, 1 `station`, 1 orphan `vehicle_component`, and 2 moons
  (`planet`, no `position`: they orbit, with `positions[]` samples).
- Surface items lie at about **6,361.6 km** from the centre, between −617 m and +2,826 m around
  it (relief). The `planet` item has **no radius** property.
- They spread over a region of about **1,500 km** (latitude 10.8° → 24.9°, longitude
  129.4° → 140.7°, assuming +Y is the pole), while the 20 trucks stand within a few hundred
  metres: the map must zoom from the region down to a few metres.
- The `station` is at **394 km** above the surface: in orbit, not on the ground.
- **Players are not children of the planet**: the 657 players are children of `spawnbuilding`s,
  their `position` relative to the building (24 distinct apartment slots, `y = 0.071`). Their
  place on the planet is the building's transform applied to it (Euler YXZ, as checked in
  ADR 0017). The game does not report player positions yet: today the map shows where players
  are housed; it will show where they are without change once the game writes them.
- Below the other surface types, only vehicles have children (their `vehicle_component`s,
  which have no meaning on a map).

## Decision

### Where

- One map per celestial body (planet or moon), at `/map/$uuid`, opened from a **Map** action on
  the body's object page and inspector (type profiles flag the types that have one).

### What is shown

- The body's **direct children with a position**, and the **players whose parent is one of
  them**, placed by composing the parent's position and rotation. Other nested items are left
  out (none today besides vehicle components).
- Items more than **50 km** above the surface are **not drawn**: they are listed in an
  "In orbit" section next to the map (the station today). Moons are not on the map either.
- Each point carries its UUID, type, label, parent (for players), latitude, longitude and
  altitude.

### Show / hide and search

- A legend lists the present types with their counts and a toggle each. Defaults come from the
  type profiles (`map.hidden`): **`miningrock` is hidden by default** (two thirds of the points,
  little interest), everything else shown. Choices are remembered in the browser.
- A search box finds items by name, UUID or type among the loaded points, centres the map on the
  match and highlights it (even when its type is hidden).
- Players housed in the same building stack at the same place: points close to each other at the
  current zoom are **grouped** into a counter that splits as the user zooms in.

### Interaction and live

- Hover: label, type, altitude, latitude / longitude. Click: selects the item in the inspector
  panel next to the map (the same organism as the explorer), with a link to its object page.
- The map data refreshes with the lists' cadence (5 s, ADR 0009), paused with the live switch.

### Geometry

- **Body frame**: positions are relative to the body centre. **+Y is the pole** (Godot "up"),
  longitude 0 is the +Z direction; this is an assumption to confirm with the game team, and only
  changes the labels of the graticule, not distances.
- **Reference radius**: the body has no radius, so the BFF takes the median distance of its
  surface children to the centre; altitude = distance − reference radius.
- **Projection**: azimuthal equidistant centred on the centroid of the drawn items, in metres.
  Over a regional extent it keeps distances and shapes close to the truth (unlike a whole-planet
  equirectangular map, where everything would be a single dot). A latitude / longitude graticule
  and a scale bar are drawn; there is no terrain background (no texture or height map available).

### Computation in the BFF

- `GET /api/bodies/:uuid/map` returns `{ body, referenceRadius, points[], inOrbit[] }`. The BFF
  pages through the body's children (`parent_id`), pages through the players (`object_type`) and
  keeps those whose parent is a child, composes the transforms, converts to latitude / longitude
  / altitude and projects. The response is cached and coalesced like other reads (a few
  persistence calls per refresh: about 4 today).
- The cost grows with the number of children and players; above **20,000 points** the BFF
  answers `MAP_TOO_LARGE` rather than scanning, until a later ADR adds a spatial index or a
  server-side filter.

### Rendering

- **Leaflet** (with `react-leaflet`) in its non-geographic mode (`CRS.Simple`, coordinates in
  projected metres), its canvas renderer for the points (thousands without DOM cost) and
  `Leaflet.markercluster` for grouping. Pan, zoom, fly-to, tooltips and clustering come from the
  library instead of being written here. Colours per type follow the existing type badges.

### Update (2026-10-02): metric grid

At the maintainer's request, the latitude / longitude graticule is replaced by a **metric grid
following the zoom**: cells of a 1-2-5 step in metres (1 m … 500 km) about 80 px on screen, a
thick line every 5 cells, and a caption with the current step next to the scale bar. The
projection keeps distances (below 0.3 % error at the edge of SandBox's region), so the grid
measures the map at any zoom. Latitude / longitude stay in the tooltips.

### Update (2026-10-03): a budget instead of a refusal

SandBox now holds about 19 500 mining rocks, and the whole map was refused (`MAP_TOO_LARGE`).
At the maintainer's request the BFF no longer refuses: it **counts every type** of the body
(cheap `total` queries) and **loads them within the 20 000-point budget**, the types the viewer
shows first and the smallest first, the hidden ones last (`GET /api/bodies/:uuid/map?hide=a,b`,
sent by the web app from the profile defaults and the viewer's choices). A type that does not
fit is left out and listed in `omitted`; the legend still gives its count, marked "too many to
draw". Players placed through their building take their share of the budget first. The counts
come with the map (`counts`), so the legend lists types that are not loaded. Children of a type
without a definition are counted but not drawn (all live types have one). Drawing every rock
stays for the spatial index or tiles mentioned above.

### Update (2026-10-04): only the shown types, counts kept a minute

Hidden types are no longer loaded, only counted (`hide`); the selected item of a hidden type is
added on its own (`include`). Measured on the test server, each filtered persistence query is a
full scan (1 to 10 s), so the ~30 per-type counts were most of the map's 17 to 20 s. Counts
(children per type, totals per type) are now cached 60 s in the BFF and served stale while
refreshed in the background, cleared on any write: a refresh takes the listing of the shown
types only (about 6 s instead of 17 s). A count route on the persistence side, or an index on
`parent_id` / `object_type`, is requested from the back team for the first load.

### Update (2026-10-04): a fixed projection frame

The projection centre (mean direction of the drawn items) and reference radius (their median
distance) were computed on every map: showing or hiding a type, or vehicles moving, shifted
every point (by more than 100 km on SandBox), and the selected item's move arrow drew these
shifts as moves. The BFF now computes the frame on a body's first map with points and keeps it
while it runs; a BFF restart computes it anew.

The selected item now keeps its whole trail (up to 100 moves, earlier ones fainter, each with
its distance and time), cleared when another item is selected or the selection is cleared.

### Update (2026-10-04): one listing of the body

Counts and per-type lists made about forty filtered queries per map, each a full scan on
persistence, served one after another (ADR 0021). The BFF now reads all the body's children in
one plain listing (3 pages for SandBox's 20,470 items, about 4.3 s) and the players, keeps them
30 s (`SNAPSHOT_TTL_MS`) served stale while refreshed in the background, cleared on any write;
counts come from that listing. First map 17 s → 5.4 s, showing or hiding a type 6–17 s → under
0.03 s. Every type on the body is counted and drawn, with or without a definition. This copy
grows with the body: the lasting answer is on the persistence side (ADR 0021).

### Update (2026-10-04): pole axis confirmed

The game confirms the body frame: +Y is the pole and +Z longitude 0. The map no longer shows
the "assume +Y is the pole" caption.

## Consequences

- A body's content becomes visible at a glance; vehicles, buildings and, later, moving players
  can be found and opened from the map.
- Three new dependencies in the web app (Leaflet, react-leaflet, markercluster) and a new BFF
  endpoint with its schema in `packages/schemas`.
- Labels of latitude / longitude follow the pole convention (+Y), confirmed on 2026-10-04.
- The map loads the body content at once within a 20 000-point budget; a type that does not fit
  is counted but not drawn (update of 2026-10-03).
- Later: click on the map to choose a spawn or duplicate position (ADR 0017), terrain background
  if the game provides one, other nested types if needed.

## Alternatives considered

- **Whole-planet equirectangular map**: simple, but today's content would cover a few pixels and
  the projection distorts shapes; kept only as the graticule labels.
- **SVG with d3-zoom, or React Flow** (already used for the orbit graph): no clustering, no
  canvas rendering for thousands of points, and fly-to / scale bar to write.
- **3D globe (three.js / deck.gl)**: heavier, harder to read for a regional cluster, and the
  request is a 2D map.
- **Computing positions in the browser**: it would need every parent of every player in the
  browser and duplicate the scan logic; the BFF already pages and caches persistence reads.
