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

Cette application permet aux opérateurs, modérateurs et contributeurs d'inspecter et de corriger
l'état persistant de l'univers du jeu (items stockés par le service de persistance : planètes,
bâtiments, véhicules, joueurs…) pendant que le jeu tourne, de modérer les joueurs, et de gérer
les organisations et l'économie au travers des services de jeu (`social`, `economie`).

Tous les appels vers les services du cluster passent par le **BFF** (`apps/bff`), seul composant à
connaître leurs URL internes. Le navigateur ne parle qu'au BFF, qui connecte les personnes via
Keycloak, vérifie leurs droits à chaque appel et valide les écritures d'après les définitions des
types d'objets.

## Capture d'écran

> Placeholder — ajoutez une capture dans `docs/screenshot.png` et liez-la ici.

## Fonctionnalités

Items de persistance (lot 1) :

- **Navigation combinée** : arbre de la hiérarchie, un tableau par type d'objet avec des colonnes
  adaptées (véhicules, joueurs, planètes, étoiles…), un inspecteur, et une page objet avec un graphe
  orbital cliquable de ses relations.
- **Carte planétaire** : tout ce qui est posé sur un corps céleste, types affichés ou masqués,
  recherche, regroupements, dernier déplacement de l'item sélectionné
  ([ADR 0018](../adr/0018-planetary-map.md)).
- **Live** : l'objet ouvert et les listes se rafraîchissent toutes les 5 s, les compteurs toutes
  les 15 s ; mise en pause possible.
- **Schémas de scène** : un dessin vu de dessus par modèle d'objet (`scenename`), lié aux
  données live : sièges et occupants, compartiments, portes, jauges (le camion d'abord ; chaque
  nouveau modèle est un fichier déclaratif, voir l'[ADR 0016](../adr/0016-scene-schematics.md)).
- **Édition** : propriétés validées d'après les définitions de types et contrôlées en cohérence ;
  seules les clés modifiées sont envoyées, et une valeur changée entre-temps par le jeu demande
  confirmation avant d'être écrasée.
- **Créer, dupliquer, supprimer** : création à partir des définitions avec choix de la scène ;
  apparition ou duplication (avec les enfants) à côté d'un joueur ou de n'importe quel item, posé
  droit sur les planètes ; la suppression prévient des orphelins. Les types d'objets inconnus sont
  refusés, et les écritures sur un serveur de production demandent confirmation.
- **Import en masse** : un tableau JSON collé ou déposé, contrôlé item par item, puis envoyé
  parents d'abord, avec un rapport ([ADR 0019](../adr/0019-bulk-import-validation.md)).

Connexion et services de jeu (lot 2, en cours, [docs/lot-2-plan.md](../lot-2-plan.md)) :

- **Connexion Keycloak**, chaque action ouverte par les rôles de la personne
  ([ADR 0023](../adr/0023-keycloak-authentication.md)).
- **Modération** (`social`) : vue d'ensemble, signalements (prise en charge, confirmation,
  classement, escalade), sanctions, réputation ; fiches joueur liées à leur item de persistance.
- **Organisations** (`social`) : corporations et entités politiques, consultées et gérées.
- **Économie** (`economie`) : tableau de bord, portefeuilles et trésoreries, réglages d'impôts et
  d'émission, calcul des impôts, crédits, débits et émission de monnaie.
- Ensuite : `inventory`, `mission`, `market`.

Partout : boutons copier sur les UUID, positions et rotations ; l'apparence du premier panneau
DyingStar (sombre, accent or, ADR 0020) ; anglais et français.

## Stack

| Couche | Technologies |
|--------|----------------|
| Frontend (`apps/web`) | React 19, Vite 8, TypeScript 6 (strict), Tailwind CSS 4, shadcn/ui (Radix) en atomic design, TanStack Router, Query et Table, Zustand, React Hook Form + Zod, React Flow, react-i18next (EN/FR) |
| BFF (`apps/bff`) | Node 24, Hono, validation Zod, OpenID Connect (Keycloak) ; seul composant à connaître les URL internes, il sert aussi la SPA buildée en production |
| Partagé (`packages/*`) | `schemas` : schémas Zod du contrat de persistance, de l'API du BFF et des permissions ; `contracts` : OpenAPI figées des services de jeu et leur Zod généré ; `testing` : fixtures et mocks MSW |
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
make up            # démarre le conteneur de dev et le Keycloak local (:8080)
make install       # installe les dépendances
make pnpm dev      # Vite (:5173) + BFF (:3000), rechargement à chaud
```

Ouvrez **http://localhost:5173** pour l'interface (le port 3000 est l'API du BFF). Arrêt :
`make down`. Utilisateurs de test : [docker/keycloak/README.md](../../docker/keycloak/README.md).
Avec les services de jeu de la stack minikube de l'équipe back : `make up K8S=1` (voir
[ONBOARDING](./ONBOARDING.md)).

Avant de commiter :

```bash
make check   # formatage, lint, typecheck, tests, vérification du format
```

### Configuration

Le premier `make up` ou `make start` crée `.env.local` à partir de [`.env.sample`](../../.env.sample).
Un panneau sert un environnement et son unique serveur de jeu (ADR 0023, 0024) : son nom
(`GAME_SERVER_NAME`), les URL des services de jeu qu'il gère (`PERSISTENCE_URL`, `SOCIAL_URL`,
`ECONOMIE_URL` ; non renseignée, le service est masqué), son Keycloak (`OIDC_*`) et l'origine
des définitions de types d'objets (`DEFINITIONS_*`).

`SERVERS` et l'en-tête `X-Server-Id` n'existent plus (2026-10-08) : le BFF refuse de démarrer
tant que `SERVERS` est défini. Remplacez-le par le `name` et le `persistenceUrl` de son entrée
(`GAME_SERVER_NAME`, `PERSISTENCE_URL`) ; détails dans le [README anglais](../../README.md) ›
Migrating from `SERVERS`.

### Image de production

```bash
make image IMAGE=dyingstar-admin:local
docker run -p 3000:3000 \
  -e GAME_SERVER_NAME='Universe Testing' -e PERSISTENCE_URL=http://46.231.240.213:31001 \
  dyingstar-admin:local
```

Passez les variables de [`.env.sample`](../../.env.sample) avec `-e` (au moins `PERSISTENCE_URL`
et les réglages `OIDC_*`). Deux secrets viennent du Keycloak de l'environnement, jamais du dépôt
ni de l'image : `OIDC_CLIENT_SECRET` (le client `dyingstar-admin`) et `SVC_ADMIN_CLIENT_SECRET`
(le compte de service `svc-admin`, pour les API internes des services) ; voir le
[README anglais](../../README.md) › Secrets of a deployment.

`make help` liste toutes les cibles.

## Documentation

- [ONBOARDING.md](./ONBOARDING.md) — premier démarrage, où sont les choses, comment on travaille
- [ARCHITECTURE.md](./ARCHITECTURE.md) — comment le panneau est construit et parle au jeu
- [docs/bff-api.md](../bff-api.md) — les routes du BFF et leurs permissions (en anglais)
- [docs/adr/](../adr/) — décisions d'architecture (contraignantes une fois acceptées)
- [docs/lot-1-plan.md](../lot-1-plan.md), [docs/lot-2-plan.md](../lot-2-plan.md) — plans et avancement
- [docs/design/](../design/) — la maquette qui structure les vues (leur apparence est celle du premier panneau, ADR 0020)
- [CLAUDE.md](../../CLAUDE.md) — règles de travail (git, Makefile, conventions, points d'extension)
- [Documentation anglaise](../../README.md)
- Déploiement sur les serveurs de l'équipe : l'image de `docker/Dockerfile.prod`, installée
  depuis le dépôt [`kubernetes`](https://github.com/DyingStar-game/kubernetes) de l'équipe back
  comme les services de jeu (voir [ARCHITECTURE.md](./ARCHITECTURE.md) › Local et production).

L'interface propose l'**anglais** (par défaut) et le **français** via le sélecteur de langue.

## Licence

AGPL-3.0 — voir [LICENSE](../../LICENSE)

## Liens

- GitHub : https://github.com/DyingStar-game
- Discord : https://discord.gg/dyingstar (à adapter)
