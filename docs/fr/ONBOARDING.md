# Guide d'onboarding — DyingStar Admin

> Documentation en français. Version anglaise (référence) : [ONBOARDING.md](../../ONBOARDING.md)

Bienvenue ! Ce guide fait tourner le panneau sur votre machine, dit où sont les choses et
comment on travaille.

À lire ensuite : [ARCHITECTURE.md](./ARCHITECTURE.md) (la carte), les [ADR](../adr/) (les
règles) et [CLAUDE.md](../../CLAUDE.md) (règles de travail, points d'extension, sources de
données).

## 1. Prérequis

- **Docker** (avec Compose) ou **Podman**, et **make**. Node et pnpm tournent dans un conteneur,
  en versions figées : rien d'autre à installer.
- **Git**.
- Facultatif, pour travailler sur les services de jeu (`social`, `economie`) : la stack minikube
  de l'équipe back (leur dépôt [`kubernetes`](https://github.com/DyingStar-game/kubernetes)).

## 2. Premier démarrage

```bash
git clone https://github.com/DyingStar-game/adminpanel.git   # ou votre fork
cd adminpanel
make up            # conteneur de dev + Keycloak local (:8080) ; crée .env.local depuis .env.sample
make install       # dépendances
make pnpm dev      # Vite (:5173) + BFF (:3000), rechargement à chaud
```

Ouvrez **http://localhost:5173** et connectez-vous avec un utilisateur de test (mot de passe =
nom d'utilisateur), par exemple `dev-editor` (persistance, lecture et écriture) ou `dev-admin`
(tout). La liste et les rôles de chacun : [docker/keycloak/README.md](../../docker/keycloak/README.md).

Par défaut le panneau lit la **persistance de pré-production** (`PERSISTENCE_URL` dans
`.env.local`) : des données réelles, partagées avec le jeu. Vos modifications y sont réelles ;
prudence, utilisez les items de test.

Arrêt : `make down`. `make help` liste toutes les cibles.

## 3. Avec les services de jeu (minikube)

`social` et `economie` ne tournent que dans la stack de l'équipe back. Une fois celle-ci démarrée
(voir leur README et [docker/keycloak/README.md](../../docker/keycloak/README.md) › Adding the
panel to the back team's minikube Keycloak) :

```bash
make up K8S=1      # connexion au Keycloak de minikube, SOCIAL_URL et ECONOMIE_URL renseignées,
                   # secret de svc-admin lu dans le cluster
make seed-social   # joueurs, organisations, signalements, portefeuilles de test (rejouable)
make pnpm dev
```

`make reset-social` vide le `social` de minikube puis le remplit à nouveau. Après être passé de
`make up` à `make up K8S=1` (ou l'inverse), relancez `make pnpm dev`.

## 4. Configuration

Tout est dans `.env.local` (créé depuis [`.env.sample`](../../.env.sample), dont les
commentaires décrivent chaque variable) : l'environnement et son serveur de jeu, les URL des
services (non renseignée = module masqué), Keycloak, `svc-admin`, la source des définitions. Le
navigateur ne voit jamais ces valeurs : seul le BFF les lit.

## 5. Où sont les choses

| Vous voulez… | Regardez dans |
|---|---|
| Modifier un écran | `apps/web/src/pages/` (une page = un template + des données), ses organisms et molecules dans `components/` |
| Mieux afficher un type d'objet | un profil dans `apps/web/src/lib/profiles/` (ADR 0008) |
| Dessiner un nouveau modèle (véhicule, bâtiment…) | un schéma dans `apps/web/src/lib/schematics/` (ADR 0016) |
| Ajouter une route au BFF | `apps/bff/src/routes/`, ses schémas dans `packages/schemas`, sa permission dans `permissions.ts` |
| Ajouter un service de jeu | CLAUDE.md › Extension points › Game service (ADR 0024) |
| Traduire | `apps/web/src/i18n/locales/en.ts` et `fr.ts` : toujours les deux |
| Simuler un service dans les tests | `packages/testing` (construit d'après le contrat et le code du service) |

Les routes du BFF et leurs permissions : [docs/bff-api.md](../bff-api.md).

## 6. Conventions

- TypeScript strict ; code, commentaires et documentation contributeur en **anglais** ; textes de
  l'interface en anglais et en français.
- **Les ADR acceptés sont des règles** : relisez ceux du domaine avant de coder, vérifiez-les
  avant de dire que c'est fini. Le lint n'en contrôle qu'une partie ;
  `apps/web/src/conventions.test.ts` en contrôle d'autres — corrigez le code, jamais ce test.
- Tests à côté du code (Vitest, Testing Library, MSW), mocks à la forme des vraies données.
- Regardez les vraies données avant de deviner une forme (CLAUDE.md › Data sources) ; règles et
  noms du jeu viennent du [wiki dev](https://developer.dyingstar-game.com/).
- Toute commande passe par `make` (`make pnpm <cmd>` pour pnpm), jamais `pnpm` ou `node` sur la
  machine.

## 7. Avant de commiter

```bash
make check   # formatage, lint, typecheck, tests, vérification du format
```

Commitez seulement quand il passe. Messages en
[Conventional Commits](https://www.conventionalcommits.org/) avec le domaine en scope :
`feat(social): …`, `fix(web): …`, `docs: …`.

## 8. Pull requests

- Branches : `feature/…`, `fix/…`, `docs/…`.
- Dites ce qui a changé et comment vous l'avez essayé (écrans, service et données utilisés).
- Une décision importante s'accompagne d'un ADR (`docs/adr/template.md`, statut `Proposed`).

## 9. Licence

AGPL-3.0 : en contribuant, vous acceptez que vos contributions soient sous la même licence.
