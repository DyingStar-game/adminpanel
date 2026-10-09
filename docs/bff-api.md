# BFF API

The SPA's only backend: `apps/bff` ([ADR 0011](./adr/0011-bff-hono.md)). It holds the internal
URLs of the game services, signs people in ([ADR 0023](./adr/0023-keycloak-authentication.md))
and checks every call against their permissions. Request and response shapes are the Zod schemas
of `packages/schemas` (persistence, panel) and `packages/contracts` (game services); the routes
are in `apps/bff/src/app.ts` and `apps/bff/src/routes/`.

## Rules common to every route

- **Session**: every `/api/*` route needs the `ds_admin_session` cookie, set by `/auth/callback`.
  Without it: `401 UNAUTHENTICATED`; signed in without any panel role: `403 ACCESS_DENIED`.
- **Permission**: each route needs one panel permission (`packages/schemas/src/permissions.ts`),
  derived from the person's Keycloak roles; missing: `403 FORBIDDEN`. The SPA hides what the
  person may not do, the BFF refuses it.
- **Origin**: writes coming from another origin than the panel's (`PUBLIC_URL`, else the
  request's own) are refused: `403 FORBIDDEN_ORIGIN`.
- **A service not configured** (`PERSISTENCE_URL`, `SOCIAL_URL`, `ECONOMIE_URL` unset) has no
  routes: they answer `404 NOT_FOUND`, like any unknown `/api/*` path.
- **Errors** are `{ error, message, details? }`, `error` among `ErrorCode`
  (`packages/schemas/src/common.ts`): `VALIDATION_ERROR` (400, with the Zod issues),
  `NOT_FOUND`, `ALREADY_EXISTS`, `EDIT_CONFLICT`, `UNKNOWN_OBJECT_TYPE`, `UPSTREAM_REJECTED`
  (the service refused: its status and message are passed on), `UPSTREAM_ERROR`,
  `UPSTREAM_TIMEOUT`, `UPSTREAM_UNREACHABLE`…
- **Writes to the game services** (`social`, `economie`) are each recorded as a JSON line on
  stdout, refused ones included: who, route, status (`lib/audit.ts`).

## Health and sign-in

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/health` | `{ status, version }`, no session (Docker, Kubernetes probes) |
| GET | `/auth/login` | Redirects to Keycloak (authorization code + PKCE); `?returnTo=` a panel path |
| GET | `/auth/callback` | Keycloak's return: opens the session, sets the cookie |
| POST | `/auth/logout` | Ends the session; answers `{ redirect }`, Keycloak's sign-out URL |

## Panel

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/me` | session | The person, their roles and permissions, `access` |
| GET | `/api/panel` | session | `environment`, `gameServerName`, `services` (`persistence`, `social`, `social-management`, `economie`, `economie-wallets`): the SPA shows the modules listed |
| GET | `/api/definitions` | session | Object type definitions (`*_def.json`, ADR 0006) |
| GET | `/api/definitions/:type` | session | One definition, 404 if unknown |

## Persistence (items)

Shown when `PERSISTENCE_URL` is set. Permissions by method: `GET` = `persistence.read`; the
checks (`POST /items/check`, `/items/import/check`, `/items/exists`) = `persistence.check`;
`DELETE` = `persistence.delete`; other writes = `persistence.write`. Identical reads arriving
together are coalesced for `READ_CACHE_TTL_MS` (ADR 0009).

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/api/items` | `parent_id` (roots: empty), `object_type` (a known type), `scenename`, `page`, `page_size` |
| GET | `/api/items/scenes` | Scenes in use (the create form's scene picker), kept 5 min |
| GET | `/api/items/:uuid` | 404 mapped from persistence |
| GET | `/api/items/:uuid/ancestors` | Walks `parent_id` up, depth guard (ADR 0005) |
| GET | `/api/items/:uuid/children-counts` | Count per known type (ADR 0005, 0008) |
| POST | `/api/items/check` | Coherence checks of one item before saving (ADR 0022) |
| POST | `/api/items/import/check` | Checks of an import's items (ADR 0019) |
| POST | `/api/items/exists` | `{ uuids[] }` → the existing ones (ADR 0004) |
| POST | `/api/items` | Create; **409 `ALREADY_EXISTS`** when the UUID exists (persistence would upsert); unknown types refused (ADR 0015) |
| POST | `/api/items/:uuid/duplicate` | With its children, next to a player or an item (ADR 0017); 201 with what was created |
| PUT | `/api/items/:uuid` | `{ object_type, base, changes, removed, force }`: re-read and field-level merge, **409 `EDIT_CONFLICT`** with the keys the game changed meanwhile (ADR 0009); 404 if unknown (no upsert) |
| DELETE | `/api/items/:uuid` | 204; persistence does not notify the game |
| GET | `/api/bodies/:uuid/map` | Everything placed on a celestial body (ADR 0018); `hide` (types counted, not loaded), `include` (one item loaded anyway) |

## `social`

Shown when `SOCIAL_URL` is set; every route needs `social.moderate` (`moderator`, `admin`,
`supervisor`) on top of its own. Reading and moderation call `social` **with the person's
token** (its Admin API, which checks the roles again and logs the actor); organisation
management calls its Interne API **as `svc-admin`**, listed as `social-management` when
`SVC_ADMIN_CLIENT_SECRET` is set (ADR 0023 › Social — management).

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/social/stats` | `social.moderate` | Moderation overview |
| GET | `/api/social/log` | same | Moderation log |
| GET | `/api/social/reports` · `/reports/:id` | same | Reports |
| PATCH | `/api/social/reports/:id` | the report's level¹ | `{ status, note? }`: claim (`reviewing`) first, then `resolved` or `dismissed`; 409 otherwise |
| POST | `/api/social/reports/:id/escalate` | the report's level¹ | One level up, back to `open` |
| GET | `/api/social/sanctions` | `social.moderate` | Sanctions |
| POST | `/api/social/players/:playerId/sanctions` | `social.moderate`; `social.sanctionSevere` for a suspension or ban | Warn, mute, suspend, ban |
| DELETE | `/api/social/sanctions/:id` | `social.moderate` | Lift |
| POST | `/api/social/players/:playerId/reputation` | `social.reputation` | `{ delta, reason }` |
| GET | `/api/social/players` · `/players/:playerId` · `/players/:playerId/profile` | `social.moderate` | Search, player sheet, profile |
| GET | `/api/social/corporations` · `/:corporationId` · `/:corporationId/members` · `/:corporationId/subsidiaries` | same | Corporations |
| GET | `/api/social/politics` · `/:entityId` · `/:entityId/members` · `/:entityId/children` | same | Political entities |
| POST · PATCH · DELETE | `/api/social/corporations`, `/corporations/:corporationId` | `social.corporationWrite` | Create, edit, disband (as `svc-admin`) |
| POST | `/api/social/corporations/:corporationId/transfer` | same | Transfer the CEO |
| PATCH · DELETE | `/api/social/corporations/:corporationId/members/:playerId` | same | Change a member's rank, remove them |
| POST · PATCH · DELETE | `/api/social/politics`, `/politics/:entityId` | `social.politicsWrite` | Create, edit, disband (as `svc-admin`) |
| POST | `/api/social/politics/:entityId/transfer` | same | Transfer the head office |

¹ `social.moderate` for a report at the `moderator` level, `social.reportsAdmin` at `admin`,
`social.reportsSupervisor` at `supervisor` (the panel's rule, ADR 0024 › Update).

## `economie`

Shown when `ECONOMIE_URL` is set. The dashboard calls its Admin API with the person's token;
everything else its Interne API **as `svc-admin`** (listed as `economie-wallets`), each route
opened by the capability role of `economie`'s README held by the person (ADR 0023 › Economie).
`:holder` is `players`, `npcs`, `corporations` or `politics`. Ledger ids (`int64`) are sent back
as strings.

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/api/economie/stats` | `economie.dashboard` | Money supply, volume, taxes, richest |
| GET | `/api/economie/wallets/:holder/:id` · `…/transactions` | `economie.walletRead`; `economie.politicsRead` for `politics` | A wallet or treasury, its ledger |
| POST | `/api/economie/wallets/:holder/:id/credit` · `…/debit` | `economie.walletCredit` / `economie.walletDebit`; `economie.politicsManage` for `politics` | `{ amount, type, reference, externalId }`; types split by direction (`code.ts` › `MOVEMENT_TYPES`) |
| POST | `/api/economie/politics/:id/mint` | `economie.moneyIssue` | Issue money into a country's or federation's treasury |
| GET · PUT | `/api/economie/politics/:id/settings` | `economie.politicsRead` / `economie.politicsManage` | Tax rates, minting policy and ceiling |
| POST | `/api/economie/politics/:id/taxes/assess` | `economie.politicsManage` | Book a tax assessment |
| GET · PUT | `/api/economie/corporations/:id/settings` | `economie.corporationRead` / `economie.corporationManage` | Internal tax on donations, donations allowed, fiscal home |
| PUT | `/api/economie/corporations/:id/affiliation` | `economie.corporationManage` | `{ politicalEntityId \| null }`: the fiscal home |
