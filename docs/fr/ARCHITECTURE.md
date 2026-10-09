# Architecture — DyingStar Admin

> Documentation en français. Version anglaise (référence) : [ARCHITECTURE.md](../../ARCHITECTURE.md)

Comment le panneau est construit et comment il parle au jeu. Le **pourquoi** de chaque choix est
dans les [ADR](../adr/) ; cette page est la carte.

## Place dans la plateforme DyingStar

Un panneau sert **un environnement** (pré-production, production…), avec le Keycloak de cet
environnement et son **unique serveur de jeu** (ADR 0023, 0024). Les services de jeu qu'il gère
sont ceux de l'équipe back, déployés depuis leur dépôt
[`kubernetes`](https://github.com/DyingStar-game/kubernetes) :

| Service | Ce que le panneau en fait | Réglage |
|---------|---------------------------|---------|
| `persistence` | Items de l'univers (planètes, bâtiments, véhicules, joueurs…) : parcourir, modifier, créer, dupliquer, supprimer, importer | `PERSISTENCE_URL` |
| `social` | Modération (signalements, sanctions, réputation), joueurs, organisations | `SOCIAL_URL` |
| `economie` | Tableau de bord, portefeuilles et trésoreries, réglages et impôts, mouvements d'argent | `ECONOMIE_URL` |
| Keycloak | Connexion et rôles ; le compte de service `svc-admin` pour les API internes des services | `OIDC_*`, `SVC_ADMIN_*` |
| GitHub | Définitions des types d'objets (`*_def.json` de `horizonserver`), avec une copie embarquée | `DEFINITIONS_*` |

Un service non renseigné est masqué : ses routes répondent 404 et la SPA n'affiche pas son module.

## Principe du BFF

Le navigateur ne parle qu'au **BFF** (`apps/bff`, Hono). Le BFF est le seul à connaître les URL
internes des services, à être client OIDC et à détenir le secret de `svc-admin` ; en production
il sert aussi la SPA buildée : le panneau est **une image, un port** (3000).

```
┌────────────┐  /auth/*, /api/*   ┌─────────────────────────────┐
│ Navigateur │ ─────────────────► │ BFF (Hono, Node 24)         │
│   (SPA)    │  cookie de session │  session, permissions,      │
└────────────┘                    │  validation, fusion         │
                                  └──┬──────┬──────┬──────┬─────┘
                                     │      │      │      │
                         persistence ◄┘      │      │      └► Keycloak (OIDC, svc-admin)
                         (REST /items)       │      │
                                    social ◄─┘      └─► economie
                  jeton de la personne : API Admin · svc-admin : API Interne
```

- **Connexion** (ADR 0023) : le BFF est un client OIDC confidentiel (code d'autorisation +
  PKCE). Les sessions vivent en mémoire du BFF, le navigateur ne garde qu'un cookie opaque
  `ds_admin_session` ; les jetons sont rafraîchis par le BFF et n'atteignent jamais le
  navigateur.
- **Permissions** : les rôles Keycloak de la personne (rôles de realm et rôles client sur
  `dyingstar-admin`) donnent des permissions du panneau (`packages/schemas/src/permissions.ts`).
  Le BFF les vérifie sur chaque route ; la SPA masque seulement ce que la personne ne peut pas
  faire.
- **Appeler un service de jeu** suit son README section par section : routes *Admin* avec le
  jeton de la personne (le service vérifie lui-même `moderator` < `admin` < `supervisor` et
  journalise l'auteur) ; routes *Interne* en tant que `svc-admin`, ouvertes dans le panneau par le
  rôle de capacité du README détenu par la personne. Chaque écriture vers un service est tracée
  sur la sortie standard (qui, route, statut).
- **La persistance** n'a pas d'authentification et fait des upserts sur `POST` / `PUT` : le BFF
  ajoute un 409 à la création, une fusion champ par champ à l'enregistrement (409 quand le jeu a
  changé la même clé entre-temps), refuse les types d'objets inconnus et mutualise les lectures
  identiques (ADR 0009, 0015).
- **Le live** est du polling (ADR 0009) : l'item ouvert toutes les 5 s, les listes toutes les
  5 s, les compteurs toutes les 15 s. Le jeu enregistre un item environ toutes les 60 s : le
  panneau ne peut pas être plus frais.

Toutes les routes, avec leur permission : [docs/bff-api.md](../bff-api.md).

## Organisation du dépôt

```
.
├── apps/
│   ├── web/                  # SPA Vite + React
│   │   └── src/
│   │       ├── components/   # ui (shadcn) → atoms → molecules → organisms → templates
│   │       ├── pages/        # templates + données (ADR 0014)
│   │       ├── routes/       # routes fichiers TanStack Router
│   │       ├── hooks/        # lectures et écritures TanStack Query, session, permissions
│   │       ├── lib/          # utilitaires, profiles/ (par type), schematics/ (par modèle)
│   │       ├── stores/       # Zustand : préférences, explorateur, brouillon d'import
│   │       └── i18n/locales/ # en.ts, fr.ts
│   └── bff/                  # BFF Hono
│       └── src/
│           ├── auth/         # OIDC, sessions, contrôles de permission, jeton svc-admin
│           ├── clients/      # persistence, social, economie (upstream.ts : délais, erreurs)
│           ├── services/     # items (fusion, contrôles, duplication, carte), définitions
│           ├── routes/       # items, bodies, social, economie
│           └── definitions/  # fallback.json (copie des définitions)
├── packages/
│   ├── schemas/              # Zod : contrat de persistance, API du BFF, permissions, géométrie
│   ├── contracts/            # OpenAPI figées des services de jeu et Zod généré
│   └── testing/              # fixtures et mocks MSW (persistence, social, economie)
├── docker/                   # compose (dev, app, keycloak), Dockerfile.prod, keycloak/
├── docs/                     # adr/, design/, fr/, plans des lots, bff-api.md
└── Makefile                  # toutes les commandes (Docker ou Podman, Node et pnpm figés)
```

## Frontend

- **Stack** (ADR 0010) : React, Vite, TypeScript strict, Tailwind, TanStack Router / Query /
  Table, Zustand, React Hook Form + Zod, React Flow, react-i18next (anglais et français).
- **Composants** (ADR 0014) : atomic design sur shadcn/ui ; ESLint impose les niveaux d'import,
  `apps/web/src/conventions.test.ts` les règles que le lint ne voit pas (un test à côté de chaque
  composant, pages faites de templates, TanStack Table, React Hook Form, tailles de texte).
- **Apparence** (ADR 0020) : celle du premier panneau DyingStar (sombre, accent or, Poppins et
  JetBrains Mono).
- **Les vues s'adaptent aux données** par des fichiers déclaratifs validés avec Zod : un profil
  par `object_type` (`lib/profiles/`, ADR 0008), un schéma par modèle `scenename`
  (`lib/schematics/`, ADR 0016). Comment en ajouter : [CLAUDE.md](../../CLAUDE.md) › Extension
  points.
- **Vues de persistance** : explorateur (arbre, tableau par type, inspecteur), page objet, graphe
  orbital (ADR 0008), carte planétaire (ADR 0018), import (ADR 0004, 0019).
- **Vues des services** : modération, joueurs, organisations, économie ; affichées quand le
  service est listé par `GET /api/panel` et que la personne a le droit de les voir.

## Tests

Vitest, Testing Library et MSW, à côté du code (ADR 0013). Les tests de la SPA font tourner le
**vrai BFF en mémoire** face à des mocks MSW des services, construits d'après leur contrat et des
données réelles (`packages/testing`). Des tests de synchronisation préviennent quand les
définitions de GitHub ou l'OpenAPI d'un service s'écartent des copies figées. `make check` lance
tout.

## Local et production

- **Développement** : `make up` (notre Keycloak compose sur :8080, persistance de
  pré-production) ou `make up K8S=1` (le minikube de l'équipe back : leur Keycloak, `social`,
  `economie`), puis `make pnpm dev` (Vite :5173 qui relaie vers le BFF :3000).
  [ONBOARDING.md](./ONBOARDING.md).
- **Testeurs** : `make start` builde et sert le panneau sur :3000.
- **Image de production** : `make image` (`docker/Dockerfile.prod`) ; configurée par les
  variables de [`.env.sample`](../../.env.sample), ses deux secrets venant d'un coffre à secrets
  ([README anglais](../../README.md) › Secrets of a deployment).
- **Sur les serveurs de l'équipe** : comme les services de jeu, l'image est poussée sur Harbor par
  la CI et installée depuis le dépôt `kubernetes` de l'équipe back (un chart par service, déployé
  par ArgoCD), qui porte les réglages, les secrets et l'adresse publique du panneau. Le dossier
  `deploy/` de l'ancien panneau a été supprimé (2026-10-09).
  - **CI** (`.github/workflows/`, même `_build-push.yaml` réutilisable que les services) : une
    pull request builde l'image sans la pousser ; un push sur `develop` pousse
    `harbor.dyingstar-game.space/dyingstar/dyingstar-admin:develop` et redémarre le déploiement
    de préproduction ; un tag `vX.Y.Z` pousse `:vX.Y.Z` et `:latest`. Secrets du dépôt :
    `HARBOR_USERNAME`, `HARBOR_PASSWORD`, `KUBERNETES_REPO_TOKEN`.
  - **Chart** `dyingstar-admin` dans `kubernetes` : préproduction sur
    `https://admin-preprod.dyingstar-game.space`, minikube sur `http://admin.dyingstar.local` ;
    le client Keycloak `dyingstar-admin` et ses rôles sont dans son `keycloak-managed/`.
