# Questions for the back team

What the admin panel ([`DyingStar-game/adminpanel`](https://github.com/DyingStar-game/adminpanel))
waits for or asks of `DyingStar-game/kubernetes` and `DyingStar-game/services`. Only these
questions are here; the panel's own plan is [`lot-2-plan.md`](./lot-2-plan.md).

- Numbers are stable: code comments and ADRs cite them ("question 21"). A new question takes the
  next number; an answered one moves to [Answered](#answered), keeping its number.
- Each question says where it was seen. Where a README or an OpenAPI differs from the code, the
  panel follows the code meanwhile.
- Last checked: **2026-10-24**, against `services` `develop` `0c14db4`, `kubernetes` `main`
  `0065f37` and the dev-local minikube stack.

## Pending changes

- **`kubernetes`: the panel's missions and inventory** (patch sent 2026-10-23, local branch
  `feat/admin-panel-missions`, commit `2cb5c50`; the maintainer has no push right there):
  `MISSION_URL` / `INVENTORY_URL` in the `dyingstar-admin` chart, client roles `mission:read`,
  `mission:write`, `inventory:read` on the `dyingstar-admin` client (dev and pre-production).
  Not in `main` yet.

## Open

### `kubernetes` — Keycloak and deployment

1. **Who assigns the panel's client roles to people** in pre-production (`dyingstar-admin` ›
   Role mapping)? The client itself is there (see Answered).
2. **`supervisor`**: the realm roles `moderator` < `admin` < `supervisor` exist in dev and
   pre-production. Does `supervisor` have rights of its own beyond `admin`?
5. **`401 Invalid token` in dev-local**: the charts leave `OIDC_JWKS_URL` unset on purpose, so it
   defaults to the issuer's (`http://auth.dyingstar.local/…/certs`), which the pods cannot
   resolve: every service rejects every token. Locally, a CoreDNS line mapping
   `auth.dyingstar.local` and `services.dyingstar.local` to Traefik works around it (lost when
   minikube is recreated). Could the dev scripts set it up?
11. **Persistence and tokens**: will persistence require a token one day? Then `svc-admin` needs
    its audience.
12. **Token lifetime**: pre-production's access tokens last 24 h (realm `accessTokenLifespan`
    86400), the panel's client has no override. Is that the intended lifetime for a staff panel?
29. **The Exploration's roles (ADR 0032)**: the client roles `social:notify:write`,
    `social:player:write` and `inventory:poi:manage` on `dyingstar-admin`, and `svc-admin` holding
    `social:notify:write` and `social:player:write` (it holds `inventory:poi:manage` already),
    in dev and pre-production.

### `services` › `social`

6. A staff account without a profile cannot change reputation (`reputation_events.actor_id` →
   `player_profiles`). And `updateReportStatus` is not atomic: the report is closed and logged
   before the reputation change fails (report 5, 2026-10-08). The panel registers staff in
   `social` at sign-in meanwhile.
7. `social` does not check a report's escalation level against the moderator's role (the panel
   enforces it).
8. The internal API's management records the CEO or the head as the actor, not the person who
   acted: could it take an "actual author" field, or should the panel keep its own log?
9. OpenAPI vs code: revoking an already revoked sanction answers 404 (documented 409);
   escalating above `supervisor` answers 403 (documented 409).
10. An organisation's activity is for members only: should moderators read it (a role bypass, or
    an internal route)? The panel does not show it meanwhile.
26. `POST /api/internal/players/:playerId/notifications` (`social:notify:write`, `{type, title?,
    body?, data?}` → `{delivered, reason?}`) is in the code (`routes/internal.routes.ts`,
    `services/notifications.service.ts`) but neither in the README's Interne table nor in the
    OpenAPI. Could both document it? The panel calls it through a schema written from the code to
    tell a discoverer the decision on their place name (ADR 0032).
27. That notification is lost when the player is offline (nothing stored): the panel also records
    the decision in their activity (`POST …/activity`), which the game does not read back. Could
    `social` keep undelivered notifications and send them at the next sign-in, or should the game
    read the activity history at sign-in?

### `services` › `economie`

14. OpenAPI vs code: `CorporationSettings` lacks `politicalEntityId`; the settings bodies' "one
    field at least" and `mintCeiling`'s 10¹³ maximum are not written; the affiliation body's
    `nullable: true` beside `format: uuid` is lost by generators. And no Interne route lists a
    political entity's tax debts (only an NPC's): could one exist, to show what an assessment
    booked?
15. Any political entity may issue money (`allowMinting`) while the README reserves it to
    countries and federations: should `economie` refuse the other levels? The panel offers it to
    those two only.
16. Fiscal homes and political members are `economie`'s own copies, set by the game server: who
    keeps them in step with `social` (a corporation changing its political home, a member
    leaving)? An assessment may tax according to stale data meanwhile.
17. `POST /api/internal/politics/:id/mint` takes no `externalId`, unlike credits and debits: a
    resend after a lost answer issues the money twice. Could it accept one? The panel only
    prevents a double click.

### `services` › `mission`

19. The OpenAPI lists no `required` field (every generated field is optional). Its internal list
    lacks the filters `groupId`, `groupClaimable`, `isEvent`; its creation lacks the objectives'
    `weight`, `isBonus`, `bonusReward` and the mission's `allowPartial`, `autoComplete`,
    `requiresMissionIds`, `assignmentDeadlineHours` (all in `routes/schemas.ts`). (Its 3.0
    `nullable` was fixed by PR #37.)
24. The README still lists `…/objectives/:objectiveId/progress` (player and Interne) while the
    code dropped both routes (sent 2026-10-23).

### `services` › `inventory`

21. `openapi.yaml` is not valid YAML: line 816, `description: Internal-only: geometry fields …`
    holds `: ` in an unquoted value. Nothing can be generated from it. Could it be quoted?
22. A POI's `parentId`: the README and `db/schema/pois.ts` call it "an opaque persistence object
    UUID (no FK)", but the code checks it is another POI (`assertParentValid`:
    `POI_PARENT_NOT_FOUND`, `POI_PARENT_CYCLE`). Which one is meant? The panel's seed notes the
    persistence object in `metadata.persistence` meanwhile.

### `services` › `persistence`

28. `GET /items` filters on `parent_id`, `object_type` and `scenename` only: the Exploration
    section reads every `discovery` to list the names awaiting review (ADR 0032). Could it filter
    on an `object_data` field (`status=pending`), with a sort? Acceptable while discoveries are a
    few thousand.

### `services` › `universesimulator`

23. The publisher (`build_mission`) sends `transport` objectives with `params: { itemId }`, which
    `mission`'s strict `transport` kind refuses (it takes `goodType`, `source`, `zone`), and
    mining legs as `deliver_items`, a kind `mission` no longer has: no simulation mission can be
    published today (sent 2026-10-23).
25. The richer world file shared on 2026-10-23 (30 resources; farm, factory, railway and spaceport
    villages) uses `federation.railSpeedKmh`, `villages.hubs`, `processes`, policies with
    `pushTo` and `routes.links`, which `develop`'s importer refuses (`src/import/mod.rs`,
    `deny_unknown_fields`). Which version reads it, and when is it pushed?

## Answered

- **3.** `svc-admin` for each deployment → pre-production's `svc-admin` holds the 40 capability
  roles and the six audiences; the panel's pod reads `svc-admin-client-secret`
  (`dyingstar-admin/values-preprod.yaml`).
- **4.** `OIDC_AUDIENCE` on pre-production `social` → left unset on purpose, no audience check
  (`service-social/values.yaml`).
- **1** (in part). Pre-production client `dyingstar-admin` → `kubernetes` `440df45`
  (2026-10-09): one redirect URI, `https://admin-preprod.dyingstar-game.space/auth/callback`,
  client roles `persistence:*`, `social:*:write`, `economie:*`. Left open: who assigns them.
- **2** (in part). Realm roles `admin` and `supervisor` → created in dev and pre-production.
  Left open: `supervisor`'s own rights.
- **13.** Minikube's `economie` without `SOCIAL_SERVICE_CLIENT_SECRET` → set;
  `GET /api/admin/players?search=` finds players through `social` (2026-10-24).
- **18.** `mission`'s internal detail route → `GET /api/internal/missions/:missionId`
  (`mission:read`), PR #37 (2026-10-22).
- **20.** `isEvent` not stored on creation → probably the panel's mistake: `createMission` stores
  it since `1f3a252` (2026-10-12). Not sent again; to confirm on minikube.
