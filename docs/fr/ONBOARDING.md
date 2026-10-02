# Guide d'onboarding — DyingStar Admin

> **Obsolète :** ce document décrit l'ancienne version du panneau (backend Express, Keycloak,
> bannissements…). Il est en cours de réécriture (lot 1, étape 10). En attendant, voir le
> [README](./README.md), [CLAUDE.md](../../CLAUDE.md) et les [ADR](../adr/).

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
| `SERVERS` | JSON : `id`, `name`, `environment` (`production` \| `testing`), `url`, `persistenceUrl`, `wsUrl`, `keycloakRealm`. Voir `packages/backend/config/servers.example.json` |
| `KEYCLOAK_BASE_URL` | URL Keycloak (réseau cluster) |
| `KEYCLOAK_ADMIN_SECRET` | Secret admin (vide = données démo) |
| `GITHUB_TOKEN` | Optionnel — prop descriptors |

Serveurs DyingStar (ids launcher) :

| Id | Nom | Environnement |
|----|-----|---------------|
| `universe` | Universe | production (hors ligne actuellement) |
| `universe-testing` | Universe Testing | test (actif — sélection par défaut) |

```json
{
  "id": "universe-testing",
  "name": "Universe Testing",
  "environment": "testing",
  "url": "https://dyingstar-game.com",
  "persistenceUrl": "http://service-persistence:3001",
  "wsUrl": "ws://service-persistence:9100",
  "keycloakRealm": "dyingstar"
}
```

En dev local : `persistenceUrl` peut pointer vers le mock (`http://localhost:3000/mock-persistence`).

## 4. Architecture

Lire [ARCHITECTURE.md](./ARCHITECTURE.md). Résumé :

- **Frontend** → `VITE_API_URL` + header `X-Server-Id`
- **Backend** → clients HTTP/WS vers persistence, Keycloak, etc.
- **API publique serveurs** → `{ id, name, url, environment? }` seulement

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
