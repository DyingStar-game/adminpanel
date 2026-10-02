# Panneau d'administration DyingStar

> Documentation en français. Version anglaise (référence pour les contributions) : [README.md](../../README.md)

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

Panneau d'administration web pour les serveurs de jeu du projet communautaire open-source **DyingStar** (MMO spatial, Godot 4).

## Rôle dans l'écosystème

Cette application permet aux opérateurs et contributeurs de :

- Superviser l'état des serveurs Godot et des joueurs connectés
- Gérer la persistence (items, import JSON en masse)
- Administrer les comptes Keycloak (rôles, activation)
- Modérer les bannissements
- Configurer et tester la connectivité des services

Tous les appels vers la persistence, Keycloak et les WebSockets passent par le **backend BFF** — seul point d'accès aux services du cluster (Minikube/Kubernetes). Le frontend n'expose aucune URL interne.

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour le découpage des responsabilités.

## Capture d'écran

> Placeholder — ajoutez une capture dans `docs/screenshot.png` et liez-la ici.

## Fonctionnalités

- Dashboard temps réel (polling 10s)
- CRUD items persistence avec éditeur JSON enrichi
- Import JSON en masse avec validation et résolution des conflits
- Missions (stockage fichier temporaire, WIP)
- Comptes & droits Keycloak (dégradation gracieuse si non configuré)
- Bannissements et historique de modération
- Paramètres et tests de connectivité

## Stack

| Couche | Technologies |
|--------|----------------|
| Frontend (`apps/web`) | React 19, Vite 8, TypeScript 6 (strict), Tailwind CSS 4, shadcn/ui (Radix) en atomic design, TanStack Router, Query et Table, Zustand, React Hook Form + Zod, React Flow, react-i18next (EN/FR) |
| BFF (`apps/bff`) | Node 24, Hono, validation Zod ; seul composant à connaître les URL internes, il sert aussi la SPA buildée en production |
| Partagé (`packages/schemas`) | Schémas Zod du contrat de persistance et de l'API du BFF |
| Tests | Vitest, Testing Library, MSW ; les tests frontend utilisent le vrai BFF en mémoire |
| Outillage | Workspaces pnpm 12, ESLint (règles d'import atomic design), Prettier, Makefile sur Docker ou Podman |

Les décisions techniques sont consignées dans [docs/adr/](../adr/).

## Démarrage rapide

Prérequis : **Docker** (avec Compose) ou **Podman**, et `make`. Node et pnpm tournent dans le
conteneur, en versions figées : rien à installer sur la machine.

### Tester (testeurs)

```bash
make start   # installe, builde et sert l'application
```

Ouvrez **http://localhost:3000**. Arrêt : `make stop`.

### Développer

```bash
make up            # démarre le conteneur de dev
make install       # installe les dépendances
make pnpm dev      # Vite (:5173) + BFF (:3000), rechargement à chaud
```

Ouvrez **http://localhost:5173** pour l'interface (le port 3000 est l'API du BFF). Arrêt :
`make down`.

Avant de commiter :

```bash
make pnpm lint && make pnpm typecheck && make pnpm test && make pnpm format:check
```

### Configuration

Le premier `make up` ou `make start` crée `.env.local` à partir de [`.env.sample`](../../.env.sample).
Modifiez-le pour choisir les serveurs de jeu ciblés (`SERVERS` : id, nom, environnement, URL de
persistance) et l'origine des définitions de types d'objets (`DEFINITIONS_*`).

### Image de production

```bash
make image IMAGE=dyingstar-admin:local
docker run -p 3000:3000 \
  -e SERVERS='[{"id":"universe-testing","name":"Universe Testing","environment":"testing","persistenceUrl":"http://46.231.240.213:31001"}]' \
  dyingstar-admin:local
```

Passez les variables de [`.env.sample`](../../.env.sample) avec `-e` (au moins `SERVERS`).

`make help` liste toutes les cibles.

## Documentation

- [Guide d'onboarding](./ONBOARDING.md)
- [Architecture](./ARCHITECTURE.md)
- [Documentation anglaise](../../README.md)

L'interface propose l'**anglais** (par défaut) et le **français** via le sélecteur de langue dans le header.

## Licence

AGPL-3.0 — voir [LICENSE](../../LICENSE)

## Liens

- GitHub : https://github.com/DyingStar-game
- Discord : https://discord.gg/dyingstar (à adapter)
