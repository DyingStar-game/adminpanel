# Contributor onboarding — DyingStar Admin

Welcome! This guide gets the panel running on your machine and tells you where things are and
how we work. French: [docs/fr/ONBOARDING.md](./docs/fr/ONBOARDING.md).

Read next: [ARCHITECTURE.md](./ARCHITECTURE.md) (the map), the [ADRs](./docs/adr/) (the rules)
and [CLAUDE.md](./CLAUDE.md) (working rules, extension points, data sources).

## 1. Prerequisites

- **Docker** (with Compose) or **Podman**, and **make**. Node and pnpm run in a container with
  pinned versions: nothing else to install.
- **Git**.
- Optional, to work on the game services (`social`, `economie`): the back team's minikube stack
  (their [`kubernetes`](https://github.com/DyingStar-game/kubernetes) repository).

## 2. First start

```bash
git clone https://github.com/DyingStar-game/adminpanel.git   # or your fork
cd adminpanel
make up            # dev container + local Keycloak (:8080); creates .env.local from .env.sample
make install       # dependencies
make pnpm dev      # Vite (:5173) + BFF (:3000), hot reload
```

Open **http://localhost:5173** and sign in with a test user (password = user name), for instance
`dev-editor` (persistence, read and write) or `dev-admin` (everything). The list and the roles
of each: [docker/keycloak/README.md](./docker/keycloak/README.md).

By default the panel reads the **pre-production persistence** (`PERSISTENCE_URL` in
`.env.local`): real data, shared with the game. Your edits there are real; be careful, and use
the test items.

Stop with `make down`. `make help` lists every target.

## 3. With the game services (minikube)

`social` and `economie` only run in the back team's stack. With it started (see their README and
[docker/keycloak/README.md](./docker/keycloak/README.md) › Adding the panel to the back
team's minikube Keycloak):

```bash
make up K8S=1      # signs in to minikube's Keycloak, sets SOCIAL_URL and ECONOMIE_URL,
                   # reads svc-admin's secret from the cluster
make seed-social   # test players, organisations, reports, wallets (safe to rerun)
make pnpm dev
```

`make reset-social` empties minikube's `social` and seeds it again. After switching between
`make up` and `make up K8S=1`, run `make pnpm dev` again.

## 4. Configuration

Everything is in `.env.local` (created from [`.env.sample`](./.env.sample), whose comments
describe each variable): the environment and its game server, the services' URLs (unset = the
module is hidden), Keycloak, `svc-admin`, the definitions' source. The browser never sees these
values: only the BFF reads them.

## 5. Where things are

| You want to… | Look in |
|---|---|
| Change a screen | `apps/web/src/pages/` (a page = a template + data), its organisms and molecules in `components/` |
| Show a new object type better | a profile in `apps/web/src/lib/profiles/` (ADR 0008) |
| Draw a new model (vehicle, building…) | a schematic in `apps/web/src/lib/schematics/` (ADR 0016) |
| Add a BFF route | `apps/bff/src/routes/`, its schemas in `packages/schemas`, its permission in `permissions.ts` |
| Add a game service | CLAUDE.md › Extension points › Game service (ADR 0024) |
| Translate | `apps/web/src/i18n/locales/en.ts` and `fr.ts`: always both |
| Mock a service in tests | `packages/testing` (built from the contract and the service's code) |

BFF routes and their permissions: [docs/bff-api.md](./docs/bff-api.md).

## 6. Conventions

- TypeScript strict; code, comments and contributor docs in **English**; UI strings in English
  and French.
- **Accepted ADRs are rules**: reread those of the area before coding, check them before saying
  it is done. Lint checks only part of them; `apps/web/src/conventions.test.ts` checks more —
  fix the code, never that test.
- Tests next to the code (Vitest, Testing Library, MSW), mocks shaped like the real data.
- Look at the real data before guessing a shape (CLAUDE.md › Data sources); game rules and names
  come from the [dev wiki](https://developer.dyingstar-game.com/).
- Every command goes through `make` (`make pnpm <cmd>` for pnpm), never `pnpm` or `node` on the
  host.

## 7. Before committing

```bash
make check   # format, lint, typecheck, test, format check
```

Commit only when it passes. Messages follow
[Conventional Commits](https://www.conventionalcommits.org/) with the area as scope:
`feat(social): …`, `fix(web): …`, `docs: …`.

## 8. Pull requests

- Branches: `feature/…`, `fix/…`, `docs/…`.
- Say what changed and how you tried it (screens, the service and the data used).
- A significant decision comes with an ADR (`docs/adr/template.md`, status `Proposed`).

## 9. License

AGPL-3.0: by contributing, you agree that your contributions are licensed under the same terms.
