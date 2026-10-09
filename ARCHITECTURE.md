# Architecture — DyingStar Admin Panel

How the panel is built and how it talks to the game. The **why** of each choice is in the
[ADRs](./docs/adr/); this page is the map. French: [docs/fr/ARCHITECTURE.md](./docs/fr/ARCHITECTURE.md).

## Place in the DyingStar platform

One panel serves **one environment** (pre-production, production…), with that environment's
Keycloak and its **one game server** (ADR 0023, 0024). The game services it manages are the back
team's, deployed from their [`kubernetes`](https://github.com/DyingStar-game/kubernetes)
repository:

| Service | What the panel does with it | Setting |
|---------|-----------------------------|---------|
| `persistence` | Items of the universe (planets, buildings, vehicles, players…): browse, edit, create, duplicate, delete, import | `PERSISTENCE_URL` |
| `social` | Moderation (reports, sanctions, reputation), players, organisations | `SOCIAL_URL` |
| `economie` | Economy dashboard, wallets and treasuries, settings and taxes, money movements | `ECONOMIE_URL` |
| Keycloak | Sign-in and roles; the `svc-admin` service account for the services' internal APIs | `OIDC_*`, `SVC_ADMIN_*` |
| GitHub | Object type definitions (`*_def.json` of `horizonserver`), with a bundled fallback | `DEFINITIONS_*` |

A service left unset is hidden: its routes answer 404 and the SPA does not show its module.

## BFF principle

The browser only talks to the **BFF** (`apps/bff`, Hono). The BFF is the only component holding
the services' internal URLs, the OIDC client and `svc-admin`'s secret; in production it also
serves the built SPA, so the panel is **one image, one port** (3000).

```
┌─────────┐  /auth/*, /api/*   ┌─────────────────────────────┐
│ Browser │ ─────────────────► │ BFF (Hono, Node 24)         │
│  (SPA)  │  session cookie    │  session, permissions,      │
└─────────┘                    │  validation, merge-on-save  │
                               └──┬──────┬──────┬──────┬─────┘
                                  │      │      │      │
                      persistence ◄┘      │      │      └► Keycloak (OIDC, svc-admin)
                      (REST /items)       │      │
                                 social ◄─┘      └─► economie
                       person's token: Admin API · svc-admin: Interne API
```

- **Sign-in** (ADR 0023): the BFF is a confidential OIDC client (authorization code + PKCE).
  Sessions live in the BFF's memory, the browser holds an opaque `ds_admin_session` cookie;
  tokens are refreshed by the BFF and never reach the browser.
- **Permissions**: the person's Keycloak roles (realm roles and client roles on
  `dyingstar-admin`) give panel permissions (`packages/schemas/src/permissions.ts`). The BFF
  checks them on every route; the SPA only hides what the person may not do.
- **Calling a game service** follows its README section by section: *Admin* routes with the
  person's token (the service checks `moderator` < `admin` < `supervisor` itself and logs the
  actor); *Interne* routes as `svc-admin`, opened in the panel by the README's capability role
  held by the person. Each write to a service is recorded on stdout (who, route, status).
- **Persistence** has no authentication and upserts on `POST` / `PUT`: the BFF adds a 409 on
  create, a field-level merge on save (409 when the game changed the same key meanwhile),
  refuses unknown object types and coalesces identical reads (ADR 0009, 0015).
- **Live** is polling (ADR 0009): the open item every 5 s, lists every 5 s, counts every 15 s.
  The game saves an item about every 60 s, so the panel cannot be fresher than that.

Every route, with its permission: [docs/bff-api.md](./docs/bff-api.md).

## Repository layout

```
.
├── apps/
│   ├── web/                  # Vite + React SPA
│   │   └── src/
│   │       ├── components/   # ui (shadcn) → atoms → molecules → organisms → templates
│   │       ├── pages/        # templates + data (ADR 0014)
│   │       ├── routes/       # TanStack Router file routes
│   │       ├── hooks/        # TanStack Query reads and writes, session, permissions
│   │       ├── lib/          # helpers, profiles/ (per type), schematics/ (per model)
│   │       ├── stores/       # Zustand: preferences, explorer, import draft
│   │       └── i18n/locales/ # en.ts, fr.ts
│   └── bff/                  # Hono BFF
│       └── src/
│           ├── auth/         # OIDC, sessions, permission guards, svc-admin token
│           ├── clients/      # persistence, social, economie (upstream.ts: timeouts, errors)
│           ├── services/     # items (merge, checks, duplicate, map), definitions
│           ├── routes/       # items, bodies, social, economie
│           └── definitions/  # fallback.json (definitions snapshot)
├── packages/
│   ├── schemas/              # Zod: persistence contract, BFF API, permissions, geometry
│   ├── contracts/            # game services' pinned OpenAPI and generated Zod
│   └── testing/              # fixtures and MSW mocks (persistence, social, economie)
├── docker/                   # compose (dev, app, keycloak), Dockerfile.prod, keycloak/
├── docs/                     # adr/, design/, fr/, lot plans, bff-api.md
└── Makefile                  # every command (Docker or Podman, pinned Node and pnpm)
```

`deploy/` is left from the previous panel and does not work; how the panel is deployed on the
team's servers is to be decided with the back team when it goes online.

## Frontend

- **Stack** (ADR 0010): React, Vite, TypeScript strict, Tailwind, TanStack Router / Query /
  Table, Zustand, React Hook Form + Zod, React Flow, react-i18next (English and French).
- **Components** (ADR 0014): atomic design on top of shadcn/ui; ESLint enforces the import
  levels, `apps/web/src/conventions.test.ts` the rules lint cannot (a test next to each
  component, pages made of templates, TanStack Table, React Hook Form, text sizes).
- **Look** (ADR 0020): the first DyingStar panel's (dark, gold accent, Poppins and JetBrains
  Mono).
- **Views adapt to the data** through declarative files validated with Zod: a profile per
  `object_type` (`lib/profiles/`, ADR 0008), a schematic per model `scenename`
  (`lib/schematics/`, ADR 0016). How to add one: [CLAUDE.md](./CLAUDE.md) › Extension points.
- **Persistence views**: explorer (tree, table per type, inspector), object page, orbit graph
  (ADR 0008), planetary map (ADR 0018), import (ADR 0004, 0019).
- **Service views**: moderation, players, organisations, economy; shown when the service is
  listed by `GET /api/panel` and the person may see them.

## Tests

Vitest, Testing Library and MSW, next to the code (ADR 0013). The SPA's tests run the **real
BFF in-process** against MSW mocks of the services, built from their contract and real data
(`packages/testing`). Sync tests warn when GitHub's definitions or a service's OpenAPI drift
from the pinned copies. `make check` runs everything.

## Local and production

- **Development**: `make up` (our compose Keycloak on :8080, pre-production persistence) or
  `make up K8S=1` (the back team's minikube: their Keycloak, `social`, `economie`), then
  `make pnpm dev` (Vite :5173 proxying to the BFF :3000). [ONBOARDING.md](./ONBOARDING.md).
- **Testers**: `make start` builds and serves the panel on :3000.
- **Production image**: `make image` (`docker/Dockerfile.prod`); configured by the variables of
  [`.env.sample`](./.env.sample), its two secrets from a secret store (README › Secrets of a
  deployment).
