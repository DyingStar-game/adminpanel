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
![Node](https://img.shields.io/badge/node-%3E%3D20-green)

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
| Frontend | React 18, Vite, TypeScript, TailwindCSS v3, React Query, Zustand, React Hook Form + Zod |
| Backend | Node 20, Express, TypeScript, node-fetch |
| Monorepo | pnpm workspaces |

## Quick start

```bash
# Prerequisites: Node 20+, pnpm 9+
corepack enable
pnpm install

# Configuration
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# Dev (frontend :5173 + backend :3000)
pnpm dev
```

With Docker:

```bash
docker compose up --build
```

Open **http://localhost:5173** for the UI (not port 3000 — that is the API only).

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
