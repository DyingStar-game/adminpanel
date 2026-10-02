# Architecture — DyingStar Admin

> **Obsolète :** ce document décrit l'ancienne version du panneau (backend Express, Keycloak,
> bannissements…). Il est en cours de réécriture (lot 1, étape 10). En attendant, voir le
> [README](./README.md), [CLAUDE.md](../../CLAUDE.md) et les [ADR](../adr/).

> Documentation en français. Version anglaise : [ARCHITECTURE.md](../../ARCHITECTURE.md)

## Principe BFF (Backend-for-Frontend)

L'application est conçue pour **Minikube / Kubernetes** : seul le pod **backend** peut joindre les services internes du cluster (persistence, WebSocket Godot, Keycloak). Le navigateur ne contacte **jamais** ces URLs.

```
┌─────────────┐     HTTPS (ingress)      ┌──────────────────┐
│   Browser   │ ───────────────────────► │  Frontend (SPA)  │
└─────────────┘                          └────────┬─────────┘
                                                    │ /api/*
                                                    ▼
                                           ┌──────────────────┐
                                           │  Backend (BFF)   │
                                           └────────┬─────────┘
                     ┌──────────────────────────────┼──────────────────────────────┐
                     ▼                              ▼                              ▼
            service-persistence              service-ws:9100                 Keycloak
```

## Séparation des responsabilités

### `packages/shared`

Types **publics** partagés : `ServerPublic`, `ItemResponse`, `ConnectivityResponse`, etc. Aucune URL interne.

### `packages/backend`

| Couche | Rôle |
|--------|------|
| `config/` | Variables d'environnement, parsing `SERVERS` |
| `domain/` | Types internes (`ServerConfig`) |
| `clients/` | Appels HTTP/WS vers services externes |
| `services/` | Logique métier |
| `routes/` | Handlers HTTP par domaine |
| `middleware/` | `X-Server-Id`, auth stub, erreurs |

**`GET /api/servers`** renvoie uniquement `{ id, name, url }`.

### `packages/frontend`

Client API unique, stores Zustand, i18n EN/FR, pages sans URLs internes.

## Déploiement Kubernetes

- Frontend : nginx + proxy `/api` vers le backend
- Backend : ConfigMap/Secret pour `SERVERS`, `KEYCLOAK_*`
- Ingress : exposer le frontend ; backend en `ClusterIP`

## Internationalisation

- Locale UI par défaut : anglais
- Français : sélecteur header
- Docs : [docs/fr/](../fr/) et racine du repo en anglais

## Licence

AGPL-3.0 — voir [LICENSE](../../LICENSE).
