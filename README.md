# DyingStar Admin Panel

```
 ____        _            ____  _             _     
|  _ \  __ _| | _____ _ __/ ___|| |_ _ __ __ _| |___ 
| | | |/ _` | |/ / _ \ '__\___ \| __| '__/ _` | / __|
| |_| | (_| |   <  __/ |   ___) | |_| | | (_| | \__ \
|____/ \__,_|_|\_\___|_|  |____/ \__|_|  \__,_|_|___/
```

![Version](https://img.shields.io/badge/version-0.1.0-gold)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D24-green)

Web administration panel for game servers of the open-source community project **DyingStar** (space MMO, Godot 4).

## Role in the ecosystem

This application lets operators and contributors inspect and fix the persistent state of the game
universe (items stored by the persistence service: planets, buildings, vehicles, players…),
while the game runs.

All calls to cluster services go through the **BFF** (`apps/bff`), the only component that knows
their internal URLs. The browser only talks to the BFF, which also validates writes against the
object type definitions.

## Screenshot

> Placeholder — add a screenshot at `docs/screenshot.png` and link it here.

## Features

Available (lot 1, persistence items):

- **Combined navigation**: hierarchy tree, a table per object type with type-aware columns
  (vehicles, players, planets, stars…), an inspector, and an object page with a clickable orbit
  graph of its relations.
- **Live**: the open object refreshes every 2 s, lists every 5 s, counts every 15 s; can be paused.
- **Scene schematics**: a top-view drawing per object model (`scenename`), bound to live data:
  seats and occupants, component bays, doors, gauges (the truck first; new models are one
  declarative file each, see [ADR 0016](./docs/adr/0016-scene-schematics.md)).
- **Editing**: properties validated against the type definitions; only changed keys are sent, and a
  value the game changed meanwhile asks before being overwritten.
- **Create, duplicate, delete**: creation from the definitions with a scene picker; spawn or
  duplicate (with children) next to a player or any item, upright on planets; deletion warns about
  orphans. Unknown object types are refused, and writes to a production server ask for
  confirmation.
- **Comfort**: copy buttons on UUIDs, positions and rotations; light and dark themes; English and
  French.

Planned:

- Bulk JSON import (next step of lot 1)
- Real-time dashboard of game servers and connected players
- Bans and moderation history
- Settings and connectivity tests

## Stack

| Layer | Technologies |
|--------|----------------|
| Frontend (`apps/web`) | React 19, Vite 8, TypeScript 6 (strict), Tailwind CSS 4, shadcn/ui (Radix) in atomic design, TanStack Router, Query and Table, Zustand, React Hook Form + Zod, React Flow, react-i18next (EN/FR) |
| BFF (`apps/bff`) | Node 24, Hono, Zod validation; the only component holding internal URLs, and it serves the built SPA in production |
| Shared (`packages/schemas`) | Zod schemas for the persistence contract and the BFF API |
| Tests | Vitest, Testing Library, MSW; frontend tests run the real BFF in-process |
| Tooling | pnpm 12 workspaces, ESLint (atomic-design import rules), Prettier, Makefile over Docker or Podman |

Technical decisions are recorded in [docs/adr/](./docs/adr/).

## Quick start

Prerequisites: **Docker** (with Compose) or **Podman**, and `make`. Node and pnpm run inside the
container, with pinned versions: nothing to install on the host.

### Try it (testers)

```bash
make start   # installs, builds and serves the app
```

Open **http://localhost:3000**. Stop with `make stop`.

### Develop

```bash
make up            # start the dev container
make install       # install dependencies
make pnpm dev      # Vite (:5173) + BFF (:3000), hot reload
```

Open **http://localhost:5173** for the UI (port 3000 is the BFF API). Stop with `make down`.

Before committing:

```bash
make pnpm lint && make pnpm typecheck && make pnpm test && make pnpm format:check
```

### Configuration

The first `make up` or `make start` creates `.env.local` from [`.env.sample`](./.env.sample).
Edit it to choose the game servers the admin targets (`SERVERS`: id, name, environment,
persistence URL) and where object type definitions are read from (`DEFINITIONS_*`).

### Production image

```bash
make image IMAGE=dyingstar-admin:local
docker run -p 3000:3000 \
  -e SERVERS='[{"id":"universe-testing","name":"Universe Testing","environment":"testing","persistenceUrl":"http://46.231.240.213:31001"}]' \
  dyingstar-admin:local
```

Pass the variables of [`.env.sample`](./.env.sample) with `-e` (at least `SERVERS`).

`make help` lists every target.

## Contributor documentation

- [docs/adr/](./docs/adr/) — architecture decision records (stack, BFF, live, writes, views…)
- [docs/lot-1-plan.md](./docs/lot-1-plan.md) — lot 1 plan and progress
- [docs/design/](./docs/design/) — the design mock-up the UI follows
- [CLAUDE.md](./CLAUDE.md) — working rules (git, Makefile, conventions)
- [ONBOARDING.md](./ONBOARDING.md), [ARCHITECTURE.md](./ARCHITECTURE.md) and [deploy/](./deploy/)
  still describe the previous version of the panel and are being rewritten.

### Translations

| Language | Documentation |
|----------|----------------|
| English (default) | This file, `ONBOARDING.md`, `ARCHITECTURE.md` |
| French | [docs/fr/](./docs/fr/) |

The UI supports **English** (default) and **French** via the language selector in the header.

## License

AGPL-3.0 — see [LICENSE](./LICENSE)

## Links

- GitHub: https://github.com/DyingStar-game
- Discord: https://discord.gg/dyingstar (update as needed)
