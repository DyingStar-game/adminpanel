# Contributor onboarding — DyingStar Admin

Welcome! This guide helps you set up a local environment and understand how to contribute.

## 1. Prerequisites

- **Node.js 20+**
- **pnpm 9+** — install with `npm i -g pnpm` or `corepack enable && corepack prepare pnpm@9 --activate`
- **Git**
- **Docker / Minikube** (optional)

## 2. Clone and install

```bash
git clone <your-fork-or-upstream-url>
cd adminpanel
pnpm install
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend (UI) | http://localhost:5173 |
| Backend (BFF API) | http://localhost:3000 |

## 3. Backend configuration (cluster)

All service URLs live in `packages/backend/.env`. The frontend **never** reads them.

| Variable | Description |
|----------|-------------|
| `SERVERS` | JSON array: `id`, `name`, `url` (public), `persistenceUrl`, `wsUrl`, `keycloakRealm` (internal) |
| `KEYCLOAK_BASE_URL` | Keycloak base URL (cluster network) |
| `KEYCLOAK_ADMIN_SECRET` | Admin client secret (empty = demo users) |
| `GITHUB_TOKEN` | Optional — higher GitHub API rate limit for prop descriptors |
| `CORS_ORIGIN` | Frontend origin (default `http://localhost:5173`) |

### Minikube example

```json
{
  "id": "srv1",
  "name": "Sandbox",
  "url": "https://sandbox.dyingstar-game.local",
  "persistenceUrl": "http://service-persistence.default.svc.cluster.local",
  "wsUrl": "ws://service-ws.default.svc.cluster.local:9100",
  "keycloakRealm": "dyingstar-sandbox"
}
```

For local dev without a real persistence service, use the mock URL:

`http://localhost:3000/mock-persistence`

## 4. Architecture overview

Read [ARCHITECTURE.md](./ARCHITECTURE.md) in full. Short summary:

- **Frontend** → only `VITE_API_URL` + `X-Server-Id` header on scoped routes
- **Backend** → HTTP/WebSocket clients to persistence, Keycloak, etc.
- **Public server API** → `{ id, name, url }` only

## 5. Internationalization (UI)

- Default locale: **English**
- French available in the header language selector
- Persisted with Zustand (`dyingstar-locale`)
- Translation strings: `packages/frontend/src/i18n/translations.ts`

When adding UI copy, update **both** `en` and `fr` keys in that file.

## 6. npm scripts

```bash
pnpm dev          # frontend + backend (concurrently)
pnpm build        # build all workspace packages
pnpm lint         # ESLint
pnpm format       # Prettier
```

## 7. Project layout

```
adminpanel/
├── packages/
│   ├── shared/       # Shared TypeScript DTOs
│   ├── backend/      # Express BFF
│   │   └── src/
│   │       ├── config/     # env, server registry
│   │       ├── domain/     # internal types
│   │       ├── clients/    # outbound HTTP/WS
│   │       ├── services/   # business logic
│   │       ├── routes/     # HTTP handlers
│   │       └── middleware/
│   └── frontend/     # React SPA
│       └── src/
│           ├── i18n/
│           ├── pages/
│           ├── components/
│           └── stores/
├── ARCHITECTURE.md
├── ONBOARDING.md
└── README.md
```

## 8. Code conventions

- TypeScript **strict**, no `any`
- **English** for all code comments and JSDoc
- Tailwind-only UI (no third-party component libraries)
- Icons: Lucide React only
- API errors surfaced via the global toast system

```bash
pnpm lint
pnpm format
```

## 9. BFF API endpoints

| Method | Route | `X-Server-Id` | Description |
|--------|-------|---------------|-------------|
| GET | `/api/health` | — | Health check |
| GET | `/api/servers` | — | Public server list |
| GET | `/api/status` | optional | Metrics |
| GET/POST/PUT/DELETE | `/api/items` | required | Persistence proxy |
| GET | `/api/connectivity` | required | Ping persistence / auth / realtime |
| GET | `/api/admin/users` | required | Keycloak proxy |
| GET/POST/PUT/DELETE | `/api/missions` | required | Missions (file storage, WIP) |
| GET/POST/DELETE | `/api/bans` | required | In-memory bans |
| GET | `/api/activity-log` | — | Admin activity ring buffer |
| POST | `/api/cache/clear` | — | Clear in-memory activity log |

## 10. Pull requests

- Branch naming: `feature/…`, `fix/…`, `docs/…`
- Describe changes and manual test steps
- Link related issues when applicable
- Ensure `pnpm build` passes

## 11. Roadmap (contributions welcome)

- [ ] Admin authentication (middleware stub in place)
- [ ] Official missions backend
- [ ] Real dashboard metrics (replace sparkline mock data)
- [ ] Accurate WebSocket player counts from Godot
- [ ] Production Keycloak integration

## 12. License

AGPL-3.0 — by contributing, you agree that your contributions are licensed under the same terms.

## Other languages

- [French documentation](../docs/fr/)
