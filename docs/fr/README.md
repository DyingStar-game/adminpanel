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
![Node](https://img.shields.io/badge/node-%3E%3D20-green)

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
| Frontend | React 18, Vite, TypeScript, TailwindCSS v3, React Query, Zustand, React Hook Form + Zod |
| Backend | Node 20, Express, TypeScript, node-fetch |
| Monorepo | pnpm workspaces |

## Démarrage rapide

```bash
corepack enable
pnpm install
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
pnpm dev
```

Avec Docker : `docker compose up --build`

Ouvrez **http://localhost:5173** pour l'interface (le port 3000 est l'API uniquement).

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
