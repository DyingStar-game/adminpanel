# 0023. Keycloak authentication and role-based access

- **Status:** Proposed
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

### What exists (services `develop`, checked 2026-10-08, GET only)

- Keycloak 26.6, realm `dyingstar`, defined in `services/keycloak/` (image
  `harbor.dyingstar-game.space/dyingstar/keycloak:develop`, public). Login with a Keycloak
  account or Discord; `en` / `fr`; brute-force protection; RS256.
- **Pre-production** (our `universe-testing`): issuer
  `https://auth-preprod.dyingstar-game.com/realms/dyingstar` answers; authorization code,
  PKCE S256, refresh token and client credentials are enabled. **Production**
  (`auth.dyingstar-game.com`) does not answer yet.
- Clients: `dyingstar-launcher` (public, `dyingstar://auth/callback`) and the `svc-*` service
  accounts. **No client for the admin.** Clients and roles are managed in the Keycloak UI, not in
  the realm JSON.
- Access token 24 h, SSO session 30 days.
- **The realm is the players' realm: registration is open.** Anyone can sign in with Discord;
  being signed in proves nothing about admin rights.
- Roles: `social` reads the realm roles `moderator` < `admin` < `supervisor`
  (`realm_access.roles`; each implies the ones below). Services call each other with
  `client_credentials` and client roles (`social:profile:read`, …). `social` skips the
  audience check on player tokens unless `OIDC_AUDIENCE` is set.
- Persistence has no authentication.

## Options considered

1. **Keep ADR 0002** — no login, network isolation. Ruled out: the panel is to be exposed, and
   `social`'s moderation API needs a user token.
2. **Tokens in the browser** (the SPA is a public OIDC client, sends the bearer to the BFF) —
   simple on the server, but access and refresh tokens live in JavaScript reach (XSS), and the
   SPA has to talk to Keycloak directly.
3. **The BFF is a confidential OIDC client; the browser holds only a session cookie** — the
   BFF runs the authorization code + PKCE flow, keeps the tokens server side, checks roles on
   every route and forwards the user's access token to `social`. Consistent with
   [ADR 0011](./0011-bff-hono.md) (the BFF holds everything internal).

## Decision

We will implement option 3.

### Flow

1. Every page and every `/api/*` route needs a session. Without one, the SPA shows a sign-in
   page whose button sends the user to `GET /auth/login`; `/api/*` answers `401`.
2. `/auth/login` redirects to Keycloak's login page (authorization code, PKCE S256, `state`,
   `nonce`). The admin never sees a password.
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
8. Calls to `social` carry the user's access token, so moderation actions are attributed to the
   real moderator. Persistence is called as today (no token) until it requires one.

Mutating routes also check the `Origin` header against the panel's own origin (CSRF, on top of
`SameSite=Lax`).

### Roles

- **Moderation**: the realm roles `moderator`, `admin`, `supervisor`, as they are. `social`
  already defines and enforces them; the panel only mirrors them.
- **Admin-specific rights**: client roles on the admin's own Keycloak client, kept apart from
  game roles. Names below are a proposal.
- Each environment has its own Keycloak, so "who may write on production" is decided by the
  role assignments in the production Keycloak, not in the panel.

### Roles × actions matrix — draft, to be completed with the back team (not validated)

Proposed client roles on `dyingstar-admin`: `persistence:read`, `persistence:write`,
`persistence:delete`. ✅ allowed · ❌ refused · ❓ to decide.

| Action (route) | no role | `persistence:read` | `persistence:write` | `persistence:delete` | `moderator` | `admin` | `supervisor` |
|---|---|---|---|---|---|---|---|
| Sign in to the panel | ❌ access denied | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Persistence** | | | | | | | |
| Browse items, object page, orbit view, map (`GET /api/items…`, `/bodies`, `/definitions`) | ❌ | ✅ | ✅ | ✅ | ❓ | ❓ | ❓ |
| Run the import / form checks (`POST /items/check`, `/import/check`, `/exists`) | ❌ | ❓ | ✅ | ❓ | ❌ | ❌ | ❌ |
| Create an item (`POST /api/items`) | ❌ | ❌ | ✅ | ❓ | ❌ | ❌ | ❌ |
| Edit an item (`PUT /api/items/:uuid`) | ❌ | ❌ | ✅ | ❓ | ❌ | ❌ | ❌ |
| Duplicate an item and its children (`POST /:uuid/duplicate`) | ❌ | ❌ | ✅ | ❓ | ❌ | ❌ | ❌ |
| Teleport a player or vehicle from the map (`PUT`) | ❌ | ❌ | ✅ | ❓ | ❌ | ❌ | ❌ |
| Bulk import (unit `POST`s) | ❌ | ❌ | ❓ | ❓ | ❌ | ❌ | ❌ |
| Delete an item (`DELETE /api/items/:uuid`) | ❌ | ❌ | ❓ | ✅ | ❌ | ❌ | ❌ |
| **Social — moderation (`/api/admin/*`, enforced by `social`)** | | | | | | | |
| Community stats, moderation log (`GET /stats`, `/log`) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Report queue, report detail, change status, escalate (`/reports…`) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Player moderation sheet (`GET /players/:id`) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Sanction: warning or mute (`POST /players/:id/sanctions`) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Sanction: suspension or ban (same route) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Adjust reputation (`POST /players/:id/reputation`) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Sanctions list, lift a sanction (`GET /sanctions`, `DELETE /sanctions/:id`) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Social — management (`/api/internal/*` only today)** | | | | | | | |
| Create, edit, transfer, delete corporations and political entities; NPC memberships | ❌ | ❌ | ❌ | ❌ | ❓ | ❓ | ❓ |

The social rows follow `social/src/routes/admin.routes.ts` as merged; the panel must not grant
more than `social` does. Whether `supervisor` has rights of its own (beyond `admin`) is not
visible in the code yet.

### Local development

The services repository is not needed locally:

- `docker/docker-compose.yml` gains a `keycloak` service (`quay.io/keycloak/keycloak:26.6`,
  same version as the services image, `start-dev --import-realm`), importing
  `docker/keycloak/dyingstar-realm.json`: the services realm plus the `dyingstar-admin` client
  (secret for dev only, redirects on `localhost:3000` and `localhost:5173`) and one test user
  per role. No Discord locally.
- Tests do not need Keycloak: the BFF's OIDC and JWT checks run against a JWKS generated by the
  test harness.
- For `social` later: its image `harbor.dyingstar-game.space/dyingstar/social` is public; run it
  against the local Keycloak, or use pre-production.

### Configuration

New BFF settings (`.env.sample`): `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
`PUBLIC_URL` (to build the redirect URI), `SESSION_SECRET`. One Keycloak per panel deployment
(see the open questions). Libraries: `openid-client` (OIDC flow) and `jose` (JWT, the library
`social` uses); the choice against `@hono/oidc-auth` is made at implementation.

## Consequences

- Every BFF route gains a permission; every visible action in the SPA reads `/api/me`. New
  strings (sign-in page, access denied, signed-in user, sign-out) in `en` and `fr`.
- The activity of each user can be attributed (`preferred_username`) instead of a generic
  `admin`.
- Deployment: a public Ingress becomes acceptable; the client secret goes in a Kubernetes Secret.
- Local development needs one more container; `make up` starts it.
- The panel depends on Keycloak being up: no sign-in when it is down.

### Open questions (back team)

1. Create the confidential client `dyingstar-admin` in pre-production: redirect URI on the
   panel's pre-production URL, the client roles of the matrix, and who assigns them.
2. The panel's public URL in pre-production (and later in production).
3. The final matrix: names and split of the persistence roles; what moderators may see of
   persistence; whether `supervisor` has its own rights.
4. Corporation and political entity management exists only under `/api/internal/*`
   (service accounts, the real author is lost): expose it under `/api/admin`, or give the panel
   a service account `svc-admin`?
5. If `social` sets `OIDC_AUDIENCE`, the admin client needs an audience mapper.
6. Will persistence require a token? Then the BFF needs a service account.
7. One panel deployment per environment with its own Keycloak, or one panel targeting several
   environments (one issuer per entry of `SERVERS`)?
8. Access token lifetime: 24 h is long for an admin tool; a shorter lifetime for the admin
   client is possible in Keycloak.
