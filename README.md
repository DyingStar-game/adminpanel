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

This application lets operators and contributors:

- Monitor Godot server status and connected players
- Manage persistence (items, bulk JSON import)
- Administer Keycloak accounts (roles, enable/disable)
- Moderate bans
- Configure servers and test service connectivity

All calls to persistence, Keycloak, and WebSockets go through the **BFF backend** — the only entry point to cluster services (Minikube/Kubernetes). The frontend never exposes internal service URLs.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the responsibility split.

## Screenshot

> Placeholder — add a screenshot at `docs/screenshot.png` and link it here.

## Features

- Real-time dashboard (10s polling)
- Persistence items CRUD with enriched JSON editor
- Bulk JSON import with validation and conflict resolution
- Missions (temporary file storage, WIP)
- Keycloak accounts & roles (graceful degradation when not configured)
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

- [ONBOARDING.md](./ONBOARDING.md) — setup, env vars, conventions
- [ARCHITECTURE.md](./ARCHITECTURE.md) — BFF layout, mesh (resourcesdynamic), Kubernetes
- [deploy/KUBERNETES.md](./deploy/KUBERNETES.md) — mapping to `../kubernetes` (ports, namespaces, realms)
- [deploy/SKAFFOLD.md](./deploy/SKAFFOLD.md) — Skaffold module for admin panel

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
