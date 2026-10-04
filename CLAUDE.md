# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Golden rule — Git

- **Never commit, amend, tag or push on your own.** The maintainer creates every commit.
- Exception granted by the maintainer: commits are allowed **only on the working branch
  `feature/manage-persistence`**, under the maintainer's git identity. Never on any other branch,
  never amend, never push.
- Never add `Co-Authored-By` or any AI attribution to commits or PR descriptions.
- Allowed otherwise: creating/switching branches and read-only commands (`git status`, `git diff`,
  `git log`).

## Commands — always go through the Makefile

Run everything through `make` (Docker / podman, pinned Node and pnpm); do not call `pnpm`,
`node` or `docker compose` directly on the host.

| Need | Command |
|------|---------|
| Start the dev container | `make up` (then `make down` to stop) |
| Install dependencies | `make install` |
| Any pnpm command | `make pnpm <cmd>` — flags go through `ARGS`, e.g. `make pnpm add zod ARGS="--filter @dyingstar-admin/web"` |
| Dev servers (Vite :5173 + BFF :3000) | `make pnpm dev` |
| Checks before committing | `make check` (format, lint, typecheck, test, format check); commit only when it passes |
| Testers profile (build + serve on :3000) | `make start` / `make stop` |
| Production image | `make image` |
| Logs, shell, status | `make logs`, `make shell`, `make status` |
| Add a shadcn/ui primitive | `make pnpm ARGS="--filter @dyingstar-admin/web exec shadcn add <name>"`, then replace `from "cn"` by `from "@/lib/cn"` (lint enforces it) |

`make help` lists every target.

## Repository layout

- `apps/web` — Vite + React SPA (TanStack Router / Query, Zustand, react-i18next, Tailwind,
  shadcn/ui). Components follow atomic design in `src/components/{ui,atoms,molecules,organisms,templates}`
  and `src/pages`; import rules are enforced by ESLint (ADR 0014).
- `apps/bff` — Hono BFF; the only component holding internal URLs. Serves the built SPA in production.
- `packages/schemas` — shared Zod schemas (persistence contract, BFF API).
- `docker/` — compose file (`app`, `dev` services) and `Dockerfile.prod`.

## Conventions

- Commit messages: Conventional Commits with the step as scope (`feat(bff): …`).
- TypeScript strict; code, comments and contributor docs in English; UI strings in both `en` and
  `fr` (`apps/web/src/i18n/locales/`).
- Tests next to the code (Vitest, Testing Library, MSW) — ADR 0013.
- Persistence test server: my own direct calls (curl, scripts) are **GET only**; the app itself
  does write. See "Data sources" below.

## Where we are

Lot 1 (persistence items): status, work delivered beyond the plan and open questions are kept at
the top of [`docs/lot-1-plan.md`](./docs/lot-1-plan.md) — read it first, then the ADR index.
`ONBOARDING.md` and `ARCHITECTURE.md` still describe the previous panel (step 10).

## Data sources — look at the real data first

Check shapes against live data rather than guessing (**GET only**, never POST / PUT / DELETE):

- **Persistence test server**: base URL in [`.env.sample`](./.env.sample) (`SERVERS[0].persistenceUrl`,
  today `http://46.231.240.213:31001`). Routes: `GET /items?page=1&page_size=50` with exact
  filters `parent_id` (roots: `parent_id=`), `object_type`, `scenename` (`page_size` up to
  10000); `GET /items/{uuid}`. Example: `curl -s "$URL/items?object_type=vehicle&page=1&page_size=5"`.
  SandBox (the planet most things stand on): `c0379c08-1d5b-4ca2-8876-230908141b68`.
- **Contract**: [persistence OpenAPI](https://github.com/DyingStar-game/services/blob/develop/persistence/openapi.yaml)
  (copy in `docs/design/persistence/uploads/`). It has no history: only the current state.
- **Object type definitions**: `*_def.json` in
  [`DyingStar-game/horizonserver` › `ds_genericprops/props`](https://github.com/DyingStar-game/horizonserver/tree/develop/ds_genericprops/props)
  (`object_type` = file name without `_def`). `definitions/github-sync.test.ts` fails when they
  differ from the bundled snapshot: look at the change (profiles, schematics, map…), then run
  `make pnpm ARGS="--filter @dyingstar-admin/bff definitions:update"` (ADR 0006).
- **Project dev wiki — the main documentation**: <https://developer.dyingstar-game.com/>
  (public, read with WebFetch or `curl`). What it says is the project's reference (game design,
  worldbuilding, systems): **consult it without hesitating** before guessing a game rule, a
  value or a name, and say when the data disagrees with it. For instance every celestial body
  (radius, gravity, day, moons), e.g.
  [Tarsis III = SandBox](https://developer.dyingstar-game.com/docs/project/GDD/worldbuilding/5_01_geographie/system_tarsis/tarsis_III/);
  the admin keeps those facts in `apps/web/src/lib/bodies.ts`, matched on the body's scene
  (`tarsis_3.tscn` → `tarsis_III/`, `tarsis_3_1.tscn` → its first moon, linked to its section
  anchor); persistence has none.
- **Through the BFF** (dev servers running): `curl -H "X-Server-Id: universe-testing" localhost:3000/api/items?page=1&page_size=5`
  — also GET only.

## Domain facts

- Positions are relative to the parent; items on a planet are relative to its **centre**
  (≈ 6,361.6 km for SandBox). Rotations are Godot Euler angles, **order YXZ**, radians
  (`packages/schemas/src/geometry.ts`, checked against live data). Latitude / longitude as in
  game: pole on +Y, longitude 0 on +X growing towards +Z; in-game altitude is above the wiki
  radius (SandBox's ground ≈ 4 km above its 6,356 km).
- Persistence `POST` and `PUT` are upserts; `DELETE` always answers 204 and does not notify the
  game. The BFF adds 409 on create, merge-on-save, and refuses unknown types (ADR 0009, 0015).
- The game saves an item about **every 60 s** by design: the admin cannot be more live than that.
  Player positions do not reach persistence yet (players sit at their apartment slot): a
  persistence bug the back team is fixing; the map and the move arrow will show them as is.
- Vehicle keys are snake_case since 2026-10-03: `components.slot_fl` … `slot_rr` are component
  compartments (not wheels), `seats.seat_driver` / `seat_passenger` hold a player UUID or `""`,
  `doors` has `front_l_door`, `front_r_door` and the compartment hatches `hatch_fl` … `hatch_rr`.

## Extension points

Views adapt to the data through declarative files, validated with Zod at load time:

- **Type profile — per `object_type`** ([ADR 0008](./docs/adr/0008-combined-navigation-type-aware-views.md)),
  `apps/web/src/lib/profiles/<type>.ts`, registered in `lib/profiles/index.ts`: table columns,
  headline facts, labelled relations, renderers (`namedMap`, `inlineList`, `angle`,
  `orbitalSamples`), children order, spawn distance / height, map flags (`map.body`,
  `map.hidden`). Fields: `lib/profiles/schema.ts`.
- **Scene schematic — per model `scenename`** ([ADR 0016](./docs/adr/0016-scene-schematics.md)),
  a top-view drawing of one model bound to live data (the truck today). To add one:
  1. Look at real items of that model first (`GET /items?scenename=…`) to get the paths.
  2. Create `apps/web/src/lib/schematics/<model>.ts` on the model of `truck.ts`: exact
     `scenename` (or a `*` pattern within one path segment), grid `size`, then `shapes`
     (`body`, `cargo`, `battery` — a charge bar in kWh, `celestial` — a planet, moon or star from its wiki facts), `seats`, `bays` (with an optional access `hatch`, drawn like a door),
     `lights` (a lens on the body's edge, a small cone when its boolean is true),
     `doors` (a door hinges at its front end and swings out on its side of the drawing) and
     `readouts` (`gauge`, `toggle`, `value`, `energy`). Component kinds and tiers (engine,
     battery capacity, engine power) are in `lib/schematics/components.ts`. Fields:
     `lib/schematics/schema.ts`; extend this closed vocabulary only when a model needs it.
  3. Register it in `lib/schematics/index.ts` and add its labels under `schematic.labels.*` in
     `en.ts` and `fr.ts`.
  4. `lib/schematics/schematics.test.ts` checks the paths against a sample item: add a fixture
     with the real shape in `packages/testing/src/fixtures.ts` if the model is not a truck.

The generic organism `SchematicCard` draws any schematic on the object page; nothing else to
wire.

## Checking in a browser

Visible changes are checked against the dev servers (`make pnpm dev`) with Playwright in a
container, scripts kept in the session scratchpad, **failing if any non-GET request is sent**:

```sh
docker run --rm --network host -v "$SCRATCH":/out mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c "cd /tmp && npm i -s playwright@1.63.0 >/dev/null 2>&1 && cp /out/check.mjs . && node check.mjs"
```

The script opens `http://localhost:5173/...`, records `page.on('request')` methods other than GET
and page errors, and writes screenshots to `/out`.

## Way of working

- Analyse the need before coding. Significant decisions are recorded as ADRs in
  [`docs/adr/`](./docs/adr/) (`Proposed` → `Accepted` before implementation).
- The lot 1 plan is in [`docs/lot-1-plan.md`](./docs/lot-1-plan.md).
