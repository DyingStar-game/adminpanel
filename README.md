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

This application lets operators, moderators and contributors inspect and fix the persistent state
of the game universe (items stored by the persistence service: planets, buildings, vehicles,
players…) while the game runs, moderate players, and manage organisations and the economy through
the game services (`social`, `economie`).

All calls to cluster services go through the **BFF** (`apps/bff`), the only component that knows
their internal URLs. The browser only talks to the BFF, which signs people in with Keycloak,
checks their rights on every call and validates writes against the object type definitions.

## Screenshot

> Placeholder — add a screenshot at `docs/screenshot.png` and link it here.

## Features

Persistence items (lot 1):

- **Combined navigation**: hierarchy tree, a table per object type with type-aware columns
  (vehicles, players, planets, stars…), an inspector, and an object page with a clickable orbit
  graph of its relations.
- **Planetary map**: everything placed on a celestial body, types shown or hidden, search,
  clusters, the selected item's last move ([ADR 0018](./docs/adr/0018-planetary-map.md)).
- **Live**: the open object and lists refresh every 5 s, counts every 15 s; can be paused.
- **Scene schematics**: a top-view drawing per object model (`scenename`), bound to live data:
  seats and occupants, component bays, doors, gauges (the truck first; new models are one
  declarative file each, see [ADR 0016](./docs/adr/0016-scene-schematics.md)).
- **Editing**: properties validated against the type definitions and checked for coherence; only
  changed keys are sent, and a value the game changed meanwhile asks before being overwritten.
- **Create, duplicate, delete**: creation from the definitions with a scene picker; spawn or
  duplicate (with children) next to a player or any item, upright on planets; deletion warns about
  orphans. Unknown object types are refused, and writes to a production server ask for
  confirmation.
- **Bulk import**: a JSON array pasted or dropped, checked item by item, then sent parents first,
  with a report ([ADR 0019](./docs/adr/0019-bulk-import-validation.md)).

Sign-in and game services (lot 2, in progress, [docs/lot-2-plan.md](./docs/lot-2-plan.md)):

- **Keycloak sign-in**, each action opened by the person's roles
  ([ADR 0023](./docs/adr/0023-keycloak-authentication.md)).
- **Moderation** (`social`): overview, reports (claim, confirm, dismiss, escalate), sanctions,
  reputation; player sheets linked to their persistence item.
- **Organisations** (`social`): corporations and political entities, read and managed.
- **Economy** (`economie`): dashboard, wallets and treasuries, tax and minting settings, tax
  assessments, credits, debits and money issuing.
- Next: `inventory`, `mission`, `market`.

Everywhere: copy buttons on UUIDs, positions and rotations; the first DyingStar panel's look
(dark, gold accent, ADR 0020); English and French.

## Stack

| Layer | Technologies |
|--------|----------------|
| Frontend (`apps/web`) | React 19, Vite 8, TypeScript 6 (strict), Tailwind CSS 4, shadcn/ui (Radix) in atomic design, TanStack Router, Query and Table, Zustand, React Hook Form + Zod, React Flow, react-i18next (EN/FR) |
| BFF (`apps/bff`) | Node 24, Hono, Zod validation, OpenID Connect (Keycloak); the only component holding internal URLs, and it serves the built SPA in production |
| Shared (`packages/*`) | `schemas`: Zod schemas for the persistence contract, the BFF API and permissions; `contracts`: the game services' pinned OpenAPI and generated Zod; `testing`: fixtures and MSW mocks |
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
`SOCIAL_URL`, `ECONOMIE_URL`; unset, the service is hidden), its Keycloak (`OIDC_*`) and where object type
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
| `SVC_ADMIN_CLIENT_SECRET` | Secret of the service account `svc-admin` (`SVC_ADMIN_CLIENT_ID`, default `svc-admin`), for the services' internal APIs: `social`'s organisation management, `economie`'s wallets, settings and money movements (ADR 0023) | Organisations stay readable, not managed; only `economie`'s dashboard shows |

For `svc-admin`, ask the back team to:

1. give its secret to the panel's deployment of that environment (pre-production, production:
   one secret each), as they do for the game services' `svc-*` accounts;
2. keep on `svc-admin` the capability roles of the services' READMEs the panel uses:
   `social:corporation:write`, `social:politics:write` and `economie`'s (`economie:wallet:*`,
   `economie:politics:*`, `economie:corporation:*`, `economie:money:issue`), with the audiences
   `social-api` and `economie-api`;
3. list `svc-admin` in `social`'s `INTERNAL_SERVICE_CLIENTS` (already the case in dev-local).

People get the same capability roles as client roles on `dyingstar-admin` to see the
management actions. Locally, `make up K8S=1` reads the secret from minikube
(`svc-admin-client-secret`, key `secret`). When a secret changes, restart the BFF.

`make help` lists every target.

## Contributor documentation

- [ONBOARDING.md](./ONBOARDING.md) — first start, where things are, how we work
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the panel is built and talks to the game
- [docs/bff-api.md](./docs/bff-api.md) — the BFF's routes and their permissions
- [docs/adr/](./docs/adr/) — architecture decision records (binding once accepted)
- [docs/lot-1-plan.md](./docs/lot-1-plan.md), [docs/lot-2-plan.md](./docs/lot-2-plan.md) — plans and progress
- [docs/design/](./docs/design/) — the mock-up the views are structured after (their look is the first panel's, ADR 0020)
- [docker/keycloak/README.md](./docker/keycloak/README.md) — local Keycloak, test users, minikube
- [CLAUDE.md](./CLAUDE.md) — working rules (git, Makefile, conventions, extension points)
- [deploy/](./deploy/) is left from the previous panel and does not work: deploying on the team's
  servers is to be decided with the back team.

### Translations

| Language | Documentation |
|----------|----------------|
| English (default) | This file, `ONBOARDING.md`, `ARCHITECTURE.md`, `docs/` |
| French | [docs/fr/](./docs/fr/) |

The UI supports **English** (default) and **French** via the language selector in the header.

## License

AGPL-3.0 — see [LICENSE](./LICENSE)

## Links

- GitHub: https://github.com/DyingStar-game
- Discord: https://discord.gg/dyingstar (update as needed)
