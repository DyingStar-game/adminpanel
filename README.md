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
- **Comfort**: copy buttons on UUIDs, positions and rotations; the first DyingStar panel's look (dark, gold accent, ADR 0020); English and
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
make check   # format, lint, typecheck, test, format check
```

### Configuration

The first `make up` or `make start` creates `.env.local` from [`.env.sample`](./.env.sample).
One panel serves one environment and its one game server (ADR 0023, 0024): set its name
(`GAME_SERVER_NAME`), the URLs of the game services it manages (`PERSISTENCE_URL`,
`SOCIAL_URL`; unset, the service is hidden), its Keycloak (`OIDC_*`) and where object type
definitions are read from (`DEFINITIONS_*`).

#### Migrating from `SERVERS` (2026-10-08)

`SERVERS` and the `X-Server-Id` header are gone: the BFF refuses to start while `SERVERS` is
set. In `.env.local` and in every deployment, replace

```bash
SERVERS='[{"id":"universe-testing","name":"Universe Testing","environment":"testing","persistenceUrl":"http://46.231.240.213:31001"}]'
```

by the entry's `name` and `persistenceUrl`:

```bash
GAME_SERVER_NAME=Universe Testing
PERSISTENCE_URL=http://46.231.240.213:31001
```

The `environment` field becomes the panel's `ENVIRONMENT` (already set). `GET /api/servers` is
now `GET /api/panel` (`environment`, `gameServerName`, `services`); the browser forgets the
server it had picked.

### Production image

```bash
make image IMAGE=dyingstar-admin:local
docker run -p 3000:3000 \
  -e GAME_SERVER_NAME='Universe Testing' -e PERSISTENCE_URL=http://46.231.240.213:31001 \
  dyingstar-admin:local
```

Pass the variables of [`.env.sample`](./.env.sample) with `-e` (at least `PERSISTENCE_URL` and
the `OIDC_*` settings).

#### Secrets of a deployment

Two secrets, both from the environment's Keycloak (the back team's), never in the repository nor
in an image: give them to the container from a secret store (a Kubernetes `Secret` read with
`envFrom` / `secretKeyRef`, the CI's secrets…).

| Variable | What | Without it |
|---|---|---|
| `OIDC_CLIENT_SECRET` | Secret of the panel's client `dyingstar-admin` (sign-in, ADR 0023) | The BFF does not start |
| `SVC_ADMIN_CLIENT_SECRET` | Secret of the service account `svc-admin` (`SVC_ADMIN_CLIENT_ID`, default `svc-admin`), for `social`'s internal API: organisation management (ADR 0023 › Social — management) | Organisations stay readable, not managed |

For `svc-admin`, ask the back team to:

1. give its secret to the panel's deployment of that environment (pre-production, production:
   one secret each), as they do for the game services' `svc-*` accounts;
2. keep on `svc-admin` the capability roles of `social`'s README the panel uses:
   `social:corporation:write` and `social:politics:write`, with the audience `social-api`;
3. list `svc-admin` in `social`'s `INTERNAL_SERVICE_CLIENTS` (already the case in dev-local).

People get the same capability roles as client roles on `dyingstar-admin` to see the
management actions. Locally, `make up K8S=1` reads the secret from minikube
(`svc-admin-client-secret`, key `secret`). When a secret changes, restart the BFF.

`make help` lists every target.

## Contributor documentation

- [docs/adr/](./docs/adr/) — architecture decision records (stack, BFF, live, writes, views…)
- [docs/lot-1-plan.md](./docs/lot-1-plan.md) — lot 1 plan and progress
- [docs/design/](./docs/design/) — the mock-up the views are structured after (their look is the first panel's, ADR 0020)
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
