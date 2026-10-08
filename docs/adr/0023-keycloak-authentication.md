# 0023. Keycloak authentication and role-based access

- **Status:** Accepted in part (2026-10-08): the sign-in flow, local development, one panel per
  environment, and an interim permission matrix. Calling the services and the final roles and
  matrix stay Proposed.
- **Date:** 2026-10-08
- **Deciders:** maintainer, back team (Keycloak clients and roles)
- **Scope:** Project-wide
- **Supersedes (once accepted):** [ADR 0002](./0002-no-admin-authentication.md)

## Context

ADR 0002 left the panel without authentication, relying on network isolation. Two things
change that:

- the panel is to be reachable from outside its environment, behind a login page;
- the next service to manage, `social`
  ([OpenAPI](https://github.com/DyingStar-game/services/blob/develop/social/openapi.yaml)),
  exposes its moderation dashboard (`/api/admin/*`) only to **players carrying a Keycloak
  role** and records each moderation action under the caller's identity.

### What exists (checked 2026-10-08, GET only)

Keycloak is run by the upstream Keycloak Operator 26.7 (dev-local on the stock 26.7.0 image,
pre-production on the custom 26.6 image of `services/keycloak/`, which adds Discord). **The source of truth for the realm of
each environment is the `kubernetes` repository**,
[`keycloak-managed/dev/`](https://github.com/DyingStar-game/kubernetes/tree/main/keycloak-managed/dev)
and [`keycloak-managed/preprod/`](https://github.com/DyingStar-game/kubernetes/tree/main/keycloak-managed/preprod)
(`04-realm-import.yaml`, `06-service-clients.yaml`). `services/keycloak/` holds the custom image
(Discord provider) and an older realm JSON that no longer describes the deployed realms.

| | Dev-local (minikube) | Pre-production (our `universe-testing`) |
|---|---|---|
| Issuer | `http://auth.dyingstar.local/realms/dyingstar` | `https://auth-preprod.dyingstar-game.com/realms/dyingstar` (answers) |
| Sign-in | Keycloak accounts; registration closed; test user `devplayer` | Keycloak accounts or Discord; **registration open** |
| Access token / SSO session | 5 min / 10 years | 24 h / 30 days |
| Realm roles of people | `player`, `moderator` | `player`, `moderator` |
| Clients | `dyingstar-game` (public, PKCE), `dyingstar-service`, `dyingstar-dev`, `svc-*` | `dyingstar-launcher` (public, PKCE), `dyingstar-service`, `svc-*` |

Production (`auth.dyingstar-game.com`) does not answer yet.

- **`svc-admin` already exists** in dev and pre-production: a confidential client,
  `client_credentials` only, "reserved to an admin console", granted **all 33 capability
  roles** (`social:*`, `economie:*`, `inventory:*`, `mission:*`, `market:*`) and the audiences of
  the five APIs. It opens the internal routes (`/api/internal/*`) of every service. It cannot
  sign a person in, and calls made with it carry no user identity.
- **No client lets a person sign in to the panel.**
- **`social` checks the realm roles `moderator` < `admin` < `supervisor`**
  (`realm_access.roles`, each implying the ones below), but **`admin` and `supervisor` exist in
  neither realm**: only `moderator` can be granted today. `social` skips the audience check on
  player tokens unless `OIDC_AUDIENCE` is set.
- **The realm is the players' realm.** In pre-production anyone can sign up with Discord:
  being signed in proves nothing about admin rights.
- Persistence has no authentication.

## Options considered

How a person signs in:

1. **Keep ADR 0002** — no login, network isolation. Ruled out: the panel is to be exposed, and
   `social`'s moderation API needs a user token.
2. **Tokens in the browser** (the SPA is a public OIDC client, sends the bearer to the BFF) —
   simple on the server, but access and refresh tokens live in JavaScript reach (XSS), and the
   SPA has to talk to Keycloak directly.
3. **The BFF is a confidential OIDC client; the browser holds only a session cookie** — the
   BFF runs the authorization code + PKCE flow, keeps the tokens server side and checks roles on
   every route. Consistent with [ADR 0011](./0011-bff-hono.md) (the BFF holds everything
   internal).

How the BFF calls the services:

- **A. The user's token everywhere** — every action is attributed to the person by the
  service, but `/api/internal/*` refuses player tokens, so corporation, political entity,
  economy or mission management would be out of reach.
- **B. `svc-admin` everywhere** — every route open, but `social`'s moderation log would record
  a robot, and the person's moderation role would no longer be checked by `social`.
- **C. Both, by route** — the user's token on the routes made for people (`/api/admin/*`),
  `svc-admin` on the internal routes, the BFF checking the person's rights before using it.

## Decision

We will implement option 3, calling the services as in C.

### One panel per environment

**Decided 2026-10-08 (maintainer):** one panel is deployed per environment, each on its own URL
and signed in to that environment's Keycloak (pre-production → `auth-preprod…`, production →
`auth…`). The environment is chosen by the URL, before signing in; a session never spans two
environments, and a production secret only lives in the production deployment.

- The BFF's `ENVIRONMENT` names the environment it serves, with its one game server
  (`GAME_SERVER_NAME`, `PERSISTENCE_URL`; formerly the `SERVERS` list, removed 2026-10-08).
- **One game server per environment** (maintainer, 2026-10-08: pre-production → one server,
  production → one server). There is nothing to choose: the server selector is gone, the top
  bar shows the environment and its server; production writes still ask for the extra
  confirmation, now from the panel's environment.
- Follow-up, done 2026-10-08 (ADR 0024, lot 2 step L): `SERVERS` and the `X-Server-Id` header
  gave way to the panel's own service URLs (`PERSISTENCE_URL`, `SOCIAL_URL`…).
- Locally, `make up` or `make up K8S=1` chooses the Keycloak the same way.

### Flow

1. Every page and every `/api/*` route needs a session. Without one, the SPA shows a sign-in
   page whose button sends the user to `GET /auth/login`; `/api/*` answers `401`.
2. `/auth/login` redirects to Keycloak's login page (authorization code, PKCE S256, `state`,
   `nonce`) through a new confidential client, `dyingstar-admin`. The panel never sees a
   password.
3. Keycloak redirects to `/auth/callback`; the BFF exchanges the code, validates the ID token
   and creates a session: an opaque id in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; the
   tokens stay in the BFF (in memory: a restart signs users out, and Keycloak's SSO session
   signs them back in without a password).
4. **A session needs at least one admin role** (see the matrix). A signed-in player without
   one gets an "access denied" page and no API access.
5. `GET /api/me` returns the user (`sub`, `preferred_username`) and the permissions derived
   from their roles; the SPA shows or hides menus, buttons and actions from it.
6. **The BFF enforces the same permissions on every route** (`403` otherwise): hiding a
   button is not a security measure.
7. The BFF refreshes the access token before it expires; `/auth/logout` ends the BFF session
   and Keycloak's (`end_session_endpoint`).

Mutating routes also check the `Origin` header against the panel's own origin (CSRF, on top of
`SameSite=Lax`).

### Calling the services

- **`social` moderation (`/api/admin/*`)**: the user's access token, so `social` checks the
  moderation role itself and records the real moderator.
- **Internal routes of any service (`/api/internal/*`)**: a `svc-admin` token
  (`client_credentials`, cached until it expires), **only after the BFF has checked the
  person's permission** for that action. `svc-admin` holds every capability: the panel's
  matrix is what restricts it, so the BFF records who did what (`preferred_username`, action,
  target) since the service will not.
- **Persistence**: no token, as today, until it requires one.
- The `svc-admin` secret lives only in the BFF (Kubernetes Secret), never in the browser.

### Roles

- **Moderation**: the realm roles `moderator`, `admin`, `supervisor`, as `social` defines them.
  The panel only mirrors them. `admin` and `supervisor` have to be created in the realms first.
- **Admin-specific rights**: client roles on `dyingstar-admin`, kept apart from game roles.
  Names below are a proposal.
- Each environment has its own Keycloak, so "who may write on production" is decided by the
  role assignments in the production Keycloak, not in the panel.

### Interim permissions, while the panel is in test

**Decided 2026-10-08 (maintainer):** the persistence rows of the draft matrix below apply now,
**with their undecided cells (🟡) allowed**, so testing is not blocked. They live in one shared
place, `packages/schemas/src/permissions.ts` (roles → `persistence.read`, `.check`, `.write`,
`.delete`), returned by `GET /api/me`:

- the BFF checks the permission of every persistence route (`requirePersistencePermission`:
  reads, the import and form checks, deletions, every other write) and answers 403 otherwise;
- the SPA hides what the user may not do: create, edit, duplicate, delete, teleport and move on
  the map, the import (menu entry and page);
- in effect: `persistence:read` browses and runs the checks; `persistence:write` and
  `persistence:delete` do everything on persistence; the moderation roles open nothing of it.
  Until the `social` moderation is built, an account without a `persistence:*` role (a player,
  a moderator) gets "access denied".

The final matrix replaces this one once decided with the back team.

### Roles × actions matrix — draft, per service, to be completed with the back team (not validated)

✅ allowed · ❌ refused · 🟡 undecided, **allowed for now** (interim, see above) · ❓ undecided, not
built yet. Roles not listed in a table are refused (❌) everywhere in it.

#### Access to the panel

| | no role (e.g. `player`) | any role below |
|---|---|---|
| Sign in | ❌ "access denied" page | ✅ |

#### Persistence — calls sent without a token

Client roles on `dyingstar-admin` (proposed names). **Only these open persistence** (maintainer,
2026-10-08): the moderation roles of `social` add nothing to it, so a moderator does on
persistence what their `persistence:*` role allows, and nothing without one.

| Action (route) | `persistence:read` | `persistence:write` | `persistence:delete` |
| --- | --- | --- | --- |
| Browse: items, object page, orbit view, map (`GET /api/items…`, `/bodies`, `/definitions`) | ✅ | ✅ | ✅ |
| Run the import and form checks (`POST /items/check`, `/import/check`, `/exists`) | 🟡 | ✅ | 🟡 |
| Create an item (`POST /api/items`) | ❌ | ✅ | 🟡 |
| Edit an item, move it on the map (`PUT /api/items/:uuid`) | ❌ | ✅ | 🟡 |
| Duplicate an item and its children (`POST /:uuid/duplicate`) | ❌ | ✅ | 🟡 |
| Teleport a player or vehicle from the map (`PUT`) | ❌ | ✅ | 🟡 |
| Bulk import (unit `POST`s) | ❌ | 🟡 | 🟡 |
| Delete an item (`DELETE /api/items/:uuid`) | ❌ | 🟡 | ✅ |

#### Social — moderation (`/api/admin/*`, user token, enforced by `social` itself)

Realm roles, each implying the ones before it. The persistence roles open nothing here.

| Action (route) | `moderator` | `admin` ¹ | `supervisor` ¹ |
|---|---|---|---|
| Community stats, moderation log (`GET /stats`, `/log`) | ✅ | ✅ | ✅ |
| Report queue, report detail (`GET /reports…`) | ✅ | ✅ | ✅ |
| Change the status of, or escalate, a report at the `moderator` level (`PATCH /reports/:id`, `POST …/escalate`) | ✅ | ✅ | ✅ |
| Same, on a report at the `admin` level | ❌ ² | ✅ | ✅ |
| Same, on a report at the `supervisor` level | ❌ ² | ❌ ² | ✅ |
| Player moderation sheet (`GET /players/:id`) | ✅ | ✅ | ✅ |
| Sanction: warning or mute (`POST /players/:id/sanctions`) | ✅ | ✅ | ✅ |
| Sanction: suspension or ban (same route) | ❌ | ✅ | ✅ |
| Adjust reputation (`POST /players/:id/reputation`) | ❌ | ✅ | ✅ |
| Sanctions list, lift a sanction (`GET /sanctions`, `DELETE /sanctions/:id`) | ✅ | ✅ | ✅ |

These rows follow `social/src/routes/admin.routes.ts` as merged; the panel must not grant more
than `social` does. ² Refused by the panel, not by `social`, which lets any `moderator` act at
any level (ADR 0024 › Update 2026-10-08, raised with the back team). Whether `supervisor` has rights of its own (beyond `admin`) is not visible in
the code yet.

#### Social — management (`/api/internal/*`, sent as `svc-admin`, checked by the panel only)

`social`'s internal API takes service-account tokens only, and its required roles
(`social:corporation:write`…) are **capability roles of the calling service**: called as
`svc-admin`, `social` cannot tell which person acts. The panel decides.

**Decided 2026-10-08 (maintainer):** a person gets **the capability roles of `social`'s
README** (› Interne), under the same names, as client roles on `dyingstar-admin`; the panel
checks them, then calls as `svc-admin`. The rights thus follow `social`'s own documentation,
like the `persistence:*` roles.

| Action (internal route) | Client role of the person on `dyingstar-admin` |
|---|---|
| Create, edit, transfer, delete a corporation; change or remove a member; NPC memberships (`/api/internal/corporations…`, `/players/:id/corporation`) | `social:corporation:write` |
| Create, edit, transfer, delete a political entity; NPC memberships (`/api/internal/politics…`, `/players/:id/politics`) | `social:politics:write` |

The moderation roles add nothing here, but the organisation pages sit in the moderation section,
opened by `social.moderate`: managing takes a moderation role and the capability role. Without
`svc-admin`'s secret (`SVC_ADMIN_CLIENT_SECRET`), organisations stay readable only. Still open
with the back team: the panel's use of
`svc-admin` and how its pre-production secret is handed over; `social` records the CEO or the
head as the actor, not the person (an "actual author" field, or the panel's own log).

#### Economie, inventory, mission, market — later lots (sent as `svc-admin`)

One table per service, written when the service is integrated, from its OpenAPI and its
capability roles (`economie:*`, `inventory:*`, `mission:*`, `market:*`). Until then: ❓.

¹ Not created in the back team's realms yet (added in our local realms only).

### Local development

**The shared Keycloaks never accept a `localhost` redirect URI** (back team's decision,
2026-10-08, for security): the pre-production `dyingstar-admin` only redirects to the panel's
pre-production URL. A panel running on a developer's machine therefore always signs in against
a **local Keycloak**.

Two ways to sign in locally, side by side:

- **Local mode, the default (`make up`, `make start`)**: a `keycloak` service in
  `docker/docker-compose.yml` (`quay.io/keycloak/keycloak:26.7.0`, the operator's version,
  `start-dev --import-realm`, on `localhost:8080`), importing
  `docker/keycloak/dyingstar-realm.json`: **derived from the back team's
  `keycloak-managed/dev/04-realm-import.yaml`** (roles, scopes, `svc-admin`), plus
  `dyingstar-admin` (secret for dev only, redirects on `http://localhost:5173/auth/callback` and
  `http://localhost:3000/auth/callback`, client-role mapper), the realm roles `admin` and
  `supervisor`, and one test user per role. No Discord. The browser reaches it on
  `localhost:8080`, the BFF as `keycloak:8080` (`OIDC_DISCOVERY_URL`).
- **Minikube mode (`make up K8S=1`)**: the back team's full game stack on minikube + ArgoCD
  (`kubernetes` repository, `scripts_linux/start-dev.sh`: Keycloak, persistence, every service,
  Horizon, Godot; 10 to 25 minutes to start, `minikube tunnel`, `*.dyingstar.local` → `127.0.0.1`
  in the hosts files of WSL **and** Windows). `docker/docker-compose.k8s.yml` puts the dev
  container on minikube's Docker network and points the BFF at
  `http://auth.dyingstar.local/realms/dyingstar` (back channel through Traefik's node port).
  The panel's additions exist in their realm only through a manual partial import
  (`docker/keycloak/k8s-partial-import.json`), lost when their Keycloak database is recreated.
  This is the mode for working on the services, which only accept their own Keycloak's tokens.

**Our compose Keycloak stays for now (maintainer's decision, 2026-10-08) and must be
reconsidered** — it duplicates the back team's realm and drifts from it. Remove it only when all
three hold:

1. the panel's additions (client `dyingstar-admin`, its roles, `admin` / `supervisor`, test
   users) are **merged in the back team's `kubernetes` repository** (realm import **and** the
   role bootstrap job, since the import is create-only), so every install has them;
2. the panel **manages services**, so working on it needs minikube anyway;
3. **testers** have another way to run the panel than `make start` (the back team's stack, or a
   deployed pre-production panel).

Until then, keep `dyingstar-realm.json` in step with the back team's dev realm
(`docker/keycloak/README.md`).

Common to both modes:

- The Vite dev server proxies `/api` and `/auth` to the BFF **without rewriting the Host**
  (`changeOrigin: false`): the BFF builds the callback from it and checks the Origin of writes
  against it; the testers profile (`make start`) serves everything on `localhost:3000`.
- Signed in either way, the panel can still target the pre-production persistence
  (`universe-testing`), which has no authentication.
- Tests do not need Keycloak: the BFF's sign-in runs against a fake provider, and `openid-client`
  against a Keycloak stand-in served by MSW.

### Configuration

BFF settings (`.env.sample`), required since there is no unauthenticated mode:
`OIDC_ISSUER` (as the browser sees it), `OIDC_DISCOVERY_URL` (where the BFF reads it, when it
reaches Keycloak by another name), `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (`dyingstar-admin`),
`ENVIRONMENT` (the environment this panel serves), `PUBLIC_URL` (deployments; defaults to each request's origin),
`SESSION_TTL_MS`. Sessions and pending sign-ins are kept in memory behind random ids, so no
signing secret is needed. Later, with the service calls: `SERVICE_CLIENT_ID`,
`SERVICE_CLIENT_SECRET` (`svc-admin`). One Keycloak per panel deployment, one panel per
environment. What roles allow is code, not configuration: `permissions.ts`. Libraries: `openid-client` (OIDC flow) and `jose` (reading the access token's
roles).

## Consequences

- Every BFF route gains a permission; every visible action in the SPA reads `/api/me`. New
  strings (sign-in page, access denied, signed-in user, sign-out) in `en` and `fr`.
- The activity of each user can be attributed (`preferred_username`) instead of a generic
  `admin`; for `svc-admin` calls, the BFF's own record is the only one.
- The BFF holds the realm's most privileged machine secret: a flaw in its permission checks
  would expose every capability of every service. Those checks need tests per route.
- Deployment: a public Ingress becomes acceptable; both client secrets go in Kubernetes Secrets.
- Local development needs one more container; `make up` starts it. Its realm has to follow the
  back team's dev realm when it changes.
- The panel depends on Keycloak being up: no sign-in when it is down.

### Open questions (back team)

1. Create the confidential client `dyingstar-admin` (standard flow) in pre-production, with the
   panel's pre-production URL as its only redirect URI (no `localhost`, decided 2026-10-08), the
   client roles of the matrix, and say who assigns them. In the dev-local realm too, if the
   panel is to run inside the back team's stack.
2. Create the realm roles `admin` and `supervisor` that `social` checks, or say how `social`'s
   roles are meant to be granted.
3. Confirm `svc-admin` is meant for this panel, used as above (behind the panel's own
   permission checks), and how its pre-production secret is handed over.
4. The panel's public URL in pre-production (and later in production).
5. The final matrix: names and split of the persistence roles; what moderators may see of
   persistence; whether `supervisor` has its own rights; which rights open the internal routes.
6. If `social` sets `OIDC_AUDIENCE`, `dyingstar-admin` needs an audience mapper for
   `social-api`.
7. Will persistence require a token? Then `svc-admin` would need a persistence audience.
8. ~~One panel per environment, or one panel for several?~~ Decided 2026-10-08: one panel per
   environment, each on its own URL (see "One panel per environment").
9. Access token lifetime: 24 h in pre-production is long for an admin tool; Keycloak can set a
   shorter lifetime on `dyingstar-admin` alone.
