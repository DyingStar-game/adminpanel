# 0012. Local tooling and Docker: Makefile + compose, modelled on the website repo

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The Docker setup of the first implementation does not build (wrong build contexts, missing
runtime dependencies) and is dropped with the rest of the code
([ADR 0007](./0007-rewrite-admin-from-design.md)). The maintainer's usual tooling is the one of
[`DyingStar-game/website`](https://github.com/DyingStar-game/website/tree/develop)
(reviewed on `develop`):

- `Makefile` wrapping `docker compose -f docker/docker-compose.yml` (auto-switch to
  `podman compose` when available), self-documented targets (`## …` + `make help`, default goal);
- `docker/docker-compose.yml` with a pinned Node image shared by services
  (`x-node-image`, must match `.nvmrc`), the repo bind-mounted on `/app`, `env_file: ../.env.local`;
- two profiles:
  - **testers** (`make start` / `make stop`): one `app` service that installs and runs the app;
  - **developers** (`make up` / `make down`): an idle `dev` container (`tail -f /dev/null`),
    commands run inside it with `make pnpm <cmd>` (corepack + pinned pnpm);
- utilities: `logs`, `logs-<service>`, `shell`, `status`, `clean-volumes` (with confirmation);
- production: `docker/Dockerfile.prod` (Alpine, non-root user, `NODE_ENV=production`),
  `prod.compose.yml` / `staging.compose.yml` with healthcheck on `/health`;
- CI: GitHub Actions builds, lints, packs an artifact, builds the image, pushes to
  `ghcr.io/dyingstar-game` (`staging` on `develop`, `vX.Y.Z` + `prod` on tags).
- Versions: Node `24.21.0` (`.nvmrc`), pnpm pinned through `packageManager`.

## Decision

Reuse the same structure and conventions, adapted to a Vite SPA + Hono BFF
([ADR 0011](./0011-bff-hono.md)):

| Element | Admin adaptation |
|---------|------------------|
| `Makefile` | Same skeleton and target names (`start`, `stop`, `up`, `down`, `pnpm`, `logs`, `logs-<svc>`, `shell`, `status`, `clean-volumes`, `help`), podman detection. No MeiliSearch, no `news-sync`. |
| `docker/docker-compose.yml` | Services `app` (testers: install + run) and `dev` (idle, for `make pnpm …`). Ports: **5173** (Vite dev) and **3000** (BFF). `env_file: ../.env.local`. |
| Persistence target in dev | Set by env (`SERVERS` / persistence URL). No local database container in lot 1. |
| `docker/Dockerfile.prod` | **Self-contained multi-stage build** for now (install + build inside Docker). One image: BFF serving the built SPA, port 3000, Alpine, non-root, healthcheck `/health`. |
| Makefile fixes | Add the missing `install` target (shown in `help`); the catch-all `%:` only swallows the extra arguments of `make pnpm …` and fails with an explicit message on an unknown target. |
| CI | GitHub Actions, on the model of the game services (`DyingStar-game/services`, 2026-10-09): `_build-push.yaml` builds `docker/Dockerfile.prod` and pushes `harbor.dyingstar-game.space/dyingstar/dyingstar-admin` — `:develop` on `develop` (then restarts the pre-production deployment through the `kubernetes` repository), `:vX.Y.Z` + `:latest` on `v*` tags; pull requests build without pushing. |
| Versions | `.nvmrc` = Node 24 (same as website), pnpm pinned via `packageManager`, `x-node-image` matching `.nvmrc`. Answers the runtime question of ADR 0011. |
| Monorepo | pnpm workspaces ([ADR 0011](./0011-bff-hono.md)). |

## Deferred

- Production build pattern: keep self-contained, or switch to the website pattern (CI builds
  the artifact, the Dockerfile only copies it).
- ~~Deployment target~~: the back team's `kubernetes` repository (chart `dyingstar-admin`, ArgoCD),
  like the game services (2026-10-09).
- ~~CI workflow~~: see the CI row above (2026-10-09).

## Consequences

- Same commands across DyingStar web repos; contributors only need Docker + make.
- Bind-mounting the repo shares `node_modules` with the host (fine on Linux / WSL).
