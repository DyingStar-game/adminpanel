# Architecture — DyingStar Admin

## StarDeception / Skaffold context

Local and preprod stacks are deployed from the **kubernetes** repository with Skaffold modules (`dyingstar-dev-local` namespace). The admin panel is designed to run **alongside** these services:

| Skaffold module | K8s Service | Ports (typical) | Admin BFF usage |
|-----------------|-------------|-----------------|-----------------|
| `service-persistence` | `service-persistence` | **3001** HTTP, **9100** WS | Items CRUD (`persistenceUrl`), player WS (`wsUrl`) |
| `service-resourcesdynamic` | `service-resourcesdynamic` | **3001** HTTP, **9200** WS | **Active Horizon count** per game server |
| `horizon` | `horizon` | **7040** (NodePort dev) | Optional connectivity probe |
| `godotserver` | `godotserver` | chart-defined | Optional Godot metrics |
| `keycloak` | `keycloak` | **8080** | User admin API |
| `livekit` | `livekit` | 7880 | Not called by admin (used by Horizon) |

See [deploy/SKAFFOLD.md](./deploy/SKAFFOLD.md) for adding a `dyingstar-admin` Skaffold module.

## BFF principle (Backend-for-Frontend)

Only the **backend** pod reaches in-cluster URLs. The browser talks to `/api/*` on the BFF only.

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
 (items HTTP :3001)   (Horizon mesh :3001)     (:8080)    (:7040)     (optional)
        │
        └── WS :9100 (player presence)
```

## Active Horizon instances (mesh)

**service-resourcesdynamic** orchestrates dynamic Horizon instances per game server. The BFF exposes counts to the UI:

- Client: `resourcesDynamic.client.ts`
- Env: `RESOURCES_DYNAMIC_URL`, `RESOURCES_DYNAMIC_HORIZONS_PATH` (default `/api/servers/{serverId}/horizons/active`)
- API: `GET /api/status` → `activeHorizonCount`, `activeHorizonByServer`, `horizonInstances[]`

Align `RESOURCES_DYNAMIC_HORIZONS_PATH` with the real HTTP routes in `../services/resourcesDynamic`. The client accepts flexible JSON (`count`, `instances[]`, or a raw array).

**Dashboard** shows active Horizon count for the selected server. **Servers & Players** lists counts per server and instance details when available.

## Separation of concerns

### `packages/shared`

Public DTOs only: `ServerPublic`, `StatusResponse`, `ConnectivityResponse`, etc. No internal cluster URLs.

### `packages/backend`

| Layer | Responsibility |
|--------|----------------|
| `config/` | `env`, `SERVERS` parsing |
| `domain/` | `ServerConfig` (internal URLs) |
| `clients/` | persistence, ws, **resourcesDynamic**, http ping |
| `services/` | status aggregation, items, keycloak, missions |
| `routes/` | HTTP handlers by domain |
| `middleware/` | `X-Server-Id`, auth stub |

**`ServerConfig.services`** (backend only):

```ts
{
  persistence: string;      // http://service-persistence:3001
  websocket: string;        // ws://service-persistence:9100
  keycloakRealm: string;
  resourcesDynamic?: string; // http://service-resourcesdynamic:3001
  horizon?: string;
  godotserver?: string;
}
```

**`GET /api/servers`** → `{ id, name, url }` only.

### `packages/frontend`

Single API client, Zustand stores, i18n EN/FR, pages without internal URLs.

## Connectivity checks

`GET /api/connectivity` + `X-Server-Id`:

| Field | Target |
|-------|--------|
| `persistence` | Items HTTP |
| `mesh` | service-resourcesdynamic |
| `auth` | Keycloak realm |
| `realtime` | WebSocket |
| `horizon` | Optional horizon HTTP |

## Kubernetes deployment

- Frontend: nginx + `/api` proxy to backend Service
- Backend: ConfigMap/Secret for `SERVERS`, `RESOURCES_DYNAMIC_*`, `KEYCLOAK_*`
- Helm stub: `deploy/helm/dyingstar-admin/`

Example `SERVERS` entry for `dyingstar-dev-local`:

```json
{
  "id": "sandbox",
  "name": "Sandbox",
  "url": "https://sandbox.dyingstar-game.local",
  "persistenceUrl": "http://service-persistence:3001",
  "wsUrl": "ws://service-persistence:9100",
  "keycloakRealm": "dyingstar-sandbox",
  "resourcesDynamicUrl": "http://service-resourcesdynamic:3001",
  "horizonUrl": "http://horizon:7040"
}
```

## UI internationalization

Default **English**; French in header selector. Strings: `packages/frontend/src/i18n/translations.ts`.

## Documentation

| Language | Path |
|----------|------|
| English | `README.md`, `ONBOARDING.md`, this file, `deploy/SKAFFOLD.md` |
| French | `docs/fr/` |

## License

AGPL-3.0 — see [LICENSE](./LICENSE).
