# Architecture — DyingStar Admin Panel

This document describes how the **DyingStar Admin Panel** fits into the **DyingStar** platform and its Kubernetes deployment.

## DyingStar platform and Kubernetes

Game services are packaged as Helm charts and deployed with **Skaffold** on Minikube for local development. The canonical definition lives in the sibling repository **[`../kubernetes`](../../kubernetes)** (DyingStar platform charts).

| Environment | Namespace | Purpose |
|-------------|-----------|---------|
| Production | `dyingstar-prod` | Live players |
| Preprod | `dyingstar-preprod` | Validated pre-release |
| Dev shared | `dyingstar-dev-shared` | Shared developer infra (e.g. PostGIS) |
| **Dev local** | **`dyingstar-dev-local`** | **Local game stack + admin BFF** |

Full port matrix, Keycloak realm, and `SERVERS` examples: **[deploy/KUBERNETES.md](./deploy/KUBERNETES.md)**.

### Services used by the admin BFF (dev-local)

| Skaffold module | Kubernetes Service | Ports | Admin configuration |
|-----------------|-------------------|-------|---------------------|
| `service-persistence` | `service-persistence` | **3001** HTTP, **9100** WebSocket | `persistenceUrl`, `wsUrl` |
| `service-resourcesdynamic` | `service-resourcesdynamic` | **3001** HTTP, **9200** WebSocket | `resourcesDynamicUrl`, `RESOURCES_DYNAMIC_*` |
| `horizon` | `horizon` | **7040** (NodePort to minikube IP for clients) | `horizonUrl` |
| `godotserver` | `godotserver` | **8980** (headless) | optional `godotserverUrl` |
| `keycloak` | `keycloak` | **8080** (NodePort **30180** in dev) | `KEYCLOAK_BASE_URL`, realm **`dyingstar`** |
| `livekit` | `livekit` | **7880** | Not called by admin (Horizon dependency) |

Deploy the admin panel in the **same namespace** so the BFF resolves short DNS names (`http://service-persistence:3001`, etc.).

Skaffold module for this repo: **[deploy/SKAFFOLD.md](./deploy/SKAFFOLD.md)**.

---

## BFF principle (Backend-for-Frontend)

Only the **backend** pod can reach in-cluster service URLs. The browser never calls persistence, Keycloak, or the mesh directly.

```
┌─────────────┐                    ┌──────────────────┐
│   Browser   │ ──── /api/* ─────► │  Frontend (SPA)  │
└─────────────┘                    └────────┬─────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  Backend (BFF)   │
                                   └────────┬─────────┘
        ┌──────────────────┬───────────────┼───────────────┬──────────────┐
        ▼                  ▼               ▼               ▼              ▼
 service-persistence  service-resourcesdynamic  keycloak   horizon    godotserver
 HTTP :3001 (items)   HTTP :3001 (mesh)        :8080      :7040       :8980
 WS :9100 (presence)
```

### Public vs internal configuration

| Layer | Sees |
|-------|------|
| Frontend | `VITE_API_URL`, `X-Server-Id`, and `GET /api/servers` → `{ id, name, url }` only |
| Backend | Full `ServerConfig` with internal URLs from `SERVERS` env JSON |

---

## Active Horizon instances (dynamic mesh)

**service-resourcesdynamic** orchestrates dynamic Horizon server instances per DyingStar game server. The admin UI shows how many are active for the selected server.

| Piece | Location |
|-------|----------|
| HTTP client | `packages/backend/src/clients/resourcesDynamic.client.ts` |
| Env | `RESOURCES_DYNAMIC_URL`, `RESOURCES_DYNAMIC_HORIZONS_PATH` |
| API | `GET /api/status` (optional header `X-Server-Id`) |

Response fields exposed to the UI:

- `activeHorizonCount` — selected server
- `activeHorizonByServer` — all configured servers
- `horizonInstances[]` — instance id, status, host, port when available
- `resourcesDynamicReachable` — whether the mesh API responded

Set `RESOURCES_DYNAMIC_HORIZONS_PATH` to match the HTTP API in **`../services/resourcesDynamic`** once the route is confirmed (the client tries several common path patterns until then).

**Dashboard** — KPI card “Active Horizon instances”.  
**Servers & Players** — per-server Horizon column and instance list.

---

## Repository layout

```
adminpanel/                          # This monorepo (DyingStar Admin Panel)
├── packages/
│   ├── shared/                      # Public TypeScript DTOs
│   ├── backend/                     # Express BFF
│   │   └── src/
│   │       ├── config/              # env, SERVERS registry
│   │       ├── domain/              # ServerConfig (internal)
│   │       ├── clients/             # Outbound HTTP/WS
│   │       ├── services/            # Business logic
│   │       ├── routes/              # HTTP handlers
│   │       └── middleware/          # X-Server-Id, errors
│   └── frontend/                    # React SPA
│       └── src/
│           ├── i18n/                # EN (default) / FR
│           ├── pages/
│           ├── components/
│           └── stores/
├── deploy/
│   ├── KUBERNETES.md                # Mapping to ../kubernetes
│   ├── SKAFFOLD.md
│   └── helm/dyingstar-admin/
└── ../kubernetes/                   # DyingStar platform Helm + Skaffold
```

### Backend layers

| Layer | Responsibility |
|--------|----------------|
| `config/` | Environment variables, parsing `SERVERS` |
| `domain/` | `ServerConfig`, normalization from env JSON |
| `clients/` | persistence, WebSocket, resourcesDynamic, HTTP ping |
| `services/` | Status, items, Keycloak proxy, missions, bans |
| `routes/` | Thin HTTP handlers grouped by domain |
| `middleware/` | Resolve `X-Server-Id`, auth stub, error handler |

**`ServerConfig.services`** (never sent to the frontend):

```ts
{
  persistence: string;       // e.g. http://service-persistence:3001
  websocket: string;         // e.g. ws://service-persistence:9100
  keycloakRealm: string;     // e.g. dyingstar
  resourcesDynamic?: string;
  horizon?: string;
  godotserver?: string;
}
```

### Frontend layers

| Layer | Responsibility |
|--------|----------------|
| `lib/api.ts` | Single HTTP client to the BFF |
| `stores/` | Active server, locale, toasts |
| `i18n/` | UI strings (EN default, FR optional) |
| `pages/` | Feature screens; no internal URLs |
| `components/ui/` | Tailwind design system |

Every scoped request includes header **`X-Server-Id`**; the backend loads the matching `ServerConfig`.

---

## Main API surface (BFF)

| Method | Route | `X-Server-Id` | Description |
|--------|-------|---------------|-------------|
| GET | `/api/health` | — | Health check |
| GET | `/api/servers` | — | Public server list |
| GET | `/api/status` | optional | Dashboard metrics |
| GET/POST/PUT/DELETE | `/api/items` | required | Persistence proxy |
| GET | `/api/connectivity` | required | Service ping |
| GET | `/api/admin/users` | required | Keycloak proxy |
| GET/POST/PUT/DELETE | `/api/missions` | required | File-backed (WIP) |
| GET/POST/DELETE | `/api/bans` | required | In-memory bans |
| GET | `/api/activity-log` | — | Admin activity ring buffer |

---

## Connectivity checks

`GET /api/connectivity` returns latency probes without exposing internal hostnames:

| Field | Service |
|-------|---------|
| `persistence` | service-persistence HTTP |
| `mesh` | service-resourcesdynamic |
| `auth` | Keycloak realm |
| `realtime` | WebSocket endpoint |
| `horizon` | Horizon HTTP (if configured) |

---

## Example backend configuration (dev-local)

Two game environments are configured (ids match the DyingStar launcher):

| Id | Name | Environment | Public URL | Notes |
|----|------|-------------|------------|-------|
| `universe` | Universe | production | `https://server.dyingstar-game.space` | Production stack (currently offline) |
| `universe-testing` | Universe Testing | testing | `https://dyingstar-game.com` | Test stack (live) — **default** active server |

Full JSON template: `packages/backend/config/servers.example.json`.

```json
{
  "id": "universe-testing",
  "name": "Universe Testing",
  "environment": "testing",
  "url": "https://dyingstar-game.com",
  "persistenceUrl": "http://service-persistence:3001",
  "wsUrl": "ws://service-persistence:9100",
  "keycloakRealm": "dyingstar",
  "resourcesDynamicUrl": "http://service-resourcesdynamic:3001",
  "horizonUrl": "http://horizon:7040"
}
```

Copy from `packages/backend/.env.example` for local `pnpm dev`; use ConfigMap/Secret when deployed in Kubernetes.

---

## UI internationalization

- Default locale: **English**
- French available in the header language selector
- Persisted in browser: Zustand + `localStorage` (`dyingstar-locale`)
- Strings: `packages/frontend/src/i18n/translations.ts` (update both `en` and `fr` when adding UI text)

---

## Documentation

| Language | Files |
|----------|--------|
| English | `README.md`, `ONBOARDING.md`, this file, `deploy/*.md` |
| French | `docs/fr/` |

---

## License

AGPL-3.0 — see [LICENSE](./LICENSE).
