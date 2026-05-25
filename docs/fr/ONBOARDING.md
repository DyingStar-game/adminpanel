# Guide d'onboarding — DyingStar Admin

> Documentation en français. Version anglaise : [ONBOARDING.md](../../ONBOARDING.md)

## 1. Prérequis

- Node.js 20+
- pnpm 9+ (`corepack enable` ou `npm i -g pnpm`)
- Git
- Docker / Minikube (optionnel)

## 2. Installation

```bash
git clone <repo>
cd adminpanel
pnpm install
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend BFF | http://localhost:3000 |

## 3. Configuration backend (cluster)

Le fichier `packages/backend/.env` contient **toutes** les URLs de services. Le frontend ne les lit jamais.

| Variable | Description |
|----------|-------------|
| `SERVERS` | JSON : `id`, `name`, `url` (publique), `persistenceUrl`, `wsUrl`, `keycloakRealm` (internes) |
| `KEYCLOAK_BASE_URL` | URL Keycloak (réseau cluster) |
| `KEYCLOAK_ADMIN_SECRET` | Secret admin (vide = données démo) |
| `GITHUB_TOKEN` | Optionnel — prop descriptors |

Exemple Minikube :

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

En dev local : `persistenceUrl` peut pointer vers le mock (`http://localhost:3000/mock-persistence`).

## 4. Architecture

Lire [ARCHITECTURE.md](./ARCHITECTURE.md). Résumé :

- **Frontend** → `VITE_API_URL` + header `X-Server-Id`
- **Backend** → clients HTTP/WS vers persistence, Keycloak, etc.
- **API publique serveurs** → `{ id, name, url }` seulement

## 5. Internationalisation

- Langue par défaut de l'UI : anglais
- Français via le sélecteur du header (Zustand + `localStorage`)
- Fichier : `packages/frontend/src/i18n/translations.ts` — mettre à jour `en` et `fr`

## 6. Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
```

## 7. Endpoints (BFF)

| Route | `X-Server-Id` | Description |
|-------|---------------|-------------|
| `GET /api/health` | — | Santé |
| `GET /api/servers` | — | Liste publique |
| `GET /api/status` | optionnel | Métriques |
| `GET/POST /api/items` | requis | Proxy persistence |
| `GET /api/connectivity` | requis | Ping services |
| `GET /api/admin/users` | requis | Proxy Keycloak |

## 8. Pull requests

Branches : `feature/`, `fix/`, `docs/`

## 9. Licence

AGPL-3.0 — contributions sous la même licence.
