# Lot 1 — Manage persistence (items): implementation plan

Scope and decisions: [ADR 0001 → 0018](./adr/README.md). This plan only orders the work;
when a step needs a new decision, it is written as a new ADR before coding.

## Status (2026-10-02, end of day)

| Step | Status |
|------|--------|
| 1–8 | **Done** (foundation, BFF, design system, explorer, object page, orbit, live, writes) |
| 9. Bulk import | **Done** ([ADR 0004](./adr/0004-bulk-import-unit-posts.md), [ADR 0019](./adr/0019-bulk-import-validation.md) and its business rules); not yet tried for real on the test server |
| 10. Documentation | **Partly done**: `README.md` (+ `docs/fr/`) rewritten; `ONBOARDING.md`, `ARCHITECTURE.md`, BFF API doc and `deploy/` still to do |

### Delivered beyond the plan

- Scene schematics of the truck, bound to live data, doors drawn swinging open
  ([ADR 0016](./adr/0016-scene-schematics.md)).
- Spawn next to a player or item, and duplication with children
  ([ADR 0017](./adr/0017-duplicate-items.md)): editable distance / height, upright on planets.
- Planetary map of a celestial body ([ADR 0018](./adr/0018-planetary-map.md)): types shown /
  hidden and named, search, metric grid following the zoom, clusters coloured by type, arrow of
  the selected item's last move, "show on map" from objects.
- Orbit view: several clusters open at once; copy buttons on UUIDs, positions and rotations.
- Look of the first DyingStar panel ([ADR 0020](./adr/0020-visual-identity-first-panel.md)):
  dark palette with gold accent, Poppins / JetBrains Mono, sidebar, page titles with their action.

### Open questions

- Pole axis and longitude 0 of the bodies (assumed +Y and +Z): to confirm with the game team.
- Offered, not decided: map refresh every 15 s instead of 5 s (the game saves every ~60 s);
  hide overlapping names on the map; lighter muted text; Add an item on the orbit view and the
  map; collapsible sidebar.

Settled (2026-10-02):

- Truck doors (`doors.Cube_004` … `Cube_007`): they will change soon in the game; the schematic
  stays as it is until then.
- Truck `suspension`: not important, left out of the schematic.
- Player positions: not reaching persistence is a persistence bug, fixed by the back team; no
  change needed in the admin (the map and the move arrow show them once they are saved).

## Conventions for every step

- All steps are done on the working branch `feature/manage-persistence`; one step = one or
  more Conventional Commits (scope = step, e.g. `feat(bff): …`).
- A step is **done** when: `make check` passes (format, lint, typecheck, test, format check),
  the feature is visible in `make start`, EN + FR strings exist, and docs are updated.
- Tests are written with the code ([ADR 0013](./adr/0013-testing-strategy.md)); MSW fixtures
  follow the real data shapes (roots `parent_id: ""`, quaternion `rotations`, `components` /
  `seats` keyed by name, dangling references, an occupied vehicle).

## Target layout

```
.
├── apps/
│   ├── web/                # Vite + React SPA (ADR 0010, 0014)
│   └── bff/                # Hono BFF, serves the built SPA in production (ADR 0011)
├── packages/
│   └── schemas/            # Shared Zod schemas: persistence contract, BFF API, type profiles
├── docker/
│   ├── docker-compose.yml  # app (testers) + dev (idle) services (ADR 0012)
│   └── Dockerfile.prod     # self-contained multi-stage build
├── docs/                   # adr/, design/, fr/
├── Makefile
├── .nvmrc                  # Node 24
└── package.json            # pnpm workspaces, packageManager pinned
```

## BFF API draft (refined in step 2)

All item routes take the target game server from the `X-Server-Id` header.

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/health` | Healthcheck (Docker) |
| GET | `/api/servers` | Public server list `{ id, name, environment }` — no internal URL |
| GET | `/api/definitions` · `/api/definitions/:type` | `*_def.json` from GitHub, cached, bundled fallback (ADR 0006) |
| GET | `/api/items` | `parent_id`, `object_type`, `scenename`, `page`, `page_size` — validated; `object_type` must be a known definition type |
| GET | `/api/items/:uuid` | 404 mapped from persistence |
| GET | `/api/items/:uuid/ancestors` | Walks `parent_id` up, depth guard (ADR 0005) |
| GET | `/api/items/:uuid/children-counts` | Count per known type, lazy (ADR 0005, 0008) |
| POST | `/api/items/exists` | `{ uuids[] }` → existing subset, exact (ADR 0004) |
| POST | `/api/items` | Existence check first → **409** if present (ADR 0004) |
| PUT | `/api/items/:uuid` | `{ object_type, base, changes, removed, force }` → re-read + field-level merge, **409** `EDIT_CONFLICT` with the conflicting keys (ADR 0009); 404 on unknown item (no upsert) |
| DELETE | `/api/items/:uuid` | Error mapping without fake 404 |

Identical concurrent GETs are coalesced with a short-lived cache (ADR 0009).

## Steps

### 1. Foundation — done

- Remove the first implementation in one go (`packages/*`, root compose, Dockerfiles, old
  ESLint / Prettier config). Keep `LICENSE`, `CLAUDE.md`, `docs/adr/`, `docs/design/`.
- pnpm monorepo (`apps/web`, `apps/bff`, `packages/schemas`), TypeScript strict, shared
  tsconfig, ESLint (+ `eslint-plugin-boundaries` for atomic levels) and Prettier.
- Makefile + `docker/docker-compose.yml` + `docker/Dockerfile.prod`, website conventions with
  the fixes of ADR 0012 (`install` target, explicit error on unknown target).
- Vitest workspace, Testing Library, MSW wiring; one sample test per package.
- Skeletons: Hono app with `/health` serving a placeholder SPA; Vite app with TanStack Router,
  TanStack Query, Zustand, i18n (EN default, FR).
- **Done when** `make start` serves the placeholder on `:3000` and `make up` + `make pnpm dev`
  gives Vite on `:5173` proxying `/api` to the BFF.

### 2. Contract and BFF — done

- `packages/schemas`: Zod schemas for the persistence contract (OpenAPI `develop@9caf502`),
  value shapes (Vec3, quaternion, UUID, `""` as empty link), BFF requests / responses.
- BFF: server registry from env (`SERVERS`), persistence client (timeouts, error mapping),
  all routes of the table above, definitions service, poll coalescing.
- MSW persistence mock reproducing the real behaviour (exact filters, upserts, DELETE 204,
  `{ "error" }` bodies).
- **Done when** every route is covered by `app.request()` tests, including 409 and merge conflicts.

### 3. Design system — done

- shadcn/ui init, theme tokens mapped from the mock-up (light / dark), Geist fonts, `cn()`.
- Atoms and molecules needed by all views: `TypeDot` (per-type colours), `MonoText`, `Kbd`,
  `LiveDot`, `SearchBar`, `LiveToggle`, `Breadcrumb`, `Pagination`, `PropertyRow`,
  `UuidLink`, `ConfirmBox`, generic value renderers (Vec3, quaternion, positions array,
  boolean, timestamp, nested JSON, broken link).
- `TopBar` organism and the app shell (server picker, search, live toggle, theme, language).
- **Done when** atoms / molecules are tested and the shell matches the mock-up style.

### 4. Explorer — done

- `HierarchyTree` (lazy, roots `parent_id=""`, paginated levels, counts, TanStack Virtual),
  `ItemsTable` (TanStack Table, paginated, columns from profiles), `Inspector`.
- Flat list by `object_type`; go-to-UUID search; orphan reporting.
- URL state with TanStack Router search params (selection, level, type, page).
- **Done when** the live dataset can be browsed from roots down to vehicle components.

### 5. Object page — done

- `ObjectPageLayout`: identity, ancestors breadcrumb, relations (outgoing UUID references at
  any depth, broken links), children by type (tabs, paginated), properties grouped by channel,
  undeclared keys, raw JSON.
- Type profiles `vehicle`, `player`, `planet` (planet vs moon), `star` (implicit system
  bodies) as Zod-validated objects (ADR 0008).
- **Done when** the four profiled types and one generic type render as specified.

### 6. Orbit view — done

- React Flow (`@xyflow/react`) with our own node components; radial layout computed by us:
  parent, children clusters by type (paginated, "load more"), referenced entities.
- Click = inspect, double-click = re-centre, pan / zoom; shares selection with other views.
- **Done when** navigation vehicle → components → parent planet works by clicks only.

### 7. Live refresh — done

- TanStack Query polling: 2 s on the selected entity, 5 s on the visible page / level,
  paused on hidden tab and by the toggle; "last refresh" indicator; "as fresh as the last game
  save" hint.
- Snapshot diff → field highlight, appeared / vanished rows.
- **Done when** a moving vehicle visibly updates in inspector, object page and orbit.

### 8. Edit, create, delete — done

- React Hook Form + Zod; JSON editor for complex values; definition-based suggestions and
  "not replicated" warnings (ADR 0006).
- Edit while live: changed-by-game flags, `{ base, changes }` save, conflict confirmation.
- Create: type picker (all definitions), client UUID, definition properties, 409 handling.
- Delete: confirmation, orphaned children warning, "not propagated to the game" warning.
- **Done when** create / edit / delete work against the MSW mock and conflicts are tested.

### 9. Bulk import — done

- Import screen designed in the mock-up style (none exists yet).
- JSON array file or paste → preview with statuses (`invalid`, `new`, `conflict`, warnings),
  exact existence check, skip / overwrite per row or for all, parents before children,
  limited concurrency, progress, cancel, downloadable report, retry failed rows.
- **Done when** the ADR 0004 scenarios are covered by tests.

### 10. Documentation — partly done

- Rewrite `README.md`, `ONBOARDING.md`, `ARCHITECTURE.md` (and `docs/fr/`) for the new stack;
  document the BFF API; decide what happens to `deploy/` with the deployment ADR.

## Dependencies

```
1 ─► 2 ─┬─► 4 ─► 5 ─► 6
        │         │
1 ─► 3 ─┘         └─► 7 ─► 8 ─► 9 ─► 10
```

Steps 2 and 3 can run in parallel after step 1. Live (7) needs at least one view (4–5) to
plug into; write operations (8) need live for the merge-on-save behaviour.
