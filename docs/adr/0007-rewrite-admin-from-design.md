# 0007. Rewrite the admin from scratch, styled after the Claude Design mock-up

- **Status:** Accepted — visual style superseded by [ADR 0020](./0020-visual-identity-first-panel.md)
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The repository contains a first implementation (commits `fb7970d`, `e2e67a9`): React SPA +
Express BFF, Docker images that do not build as-is. A Claude Design mock-up
([`docs/design/persistence/`](../design/persistence/)) explores item navigation: radial graph
(1a "Orbite"), lazy tree + paginated table + inspector (1b "Explorateur"), object page
(1c "Fiche"), creation form, live refresh, properties grouped by replication channel.
The mock-up is **an inspiration**, not a specification; its visual style is liked.

## Decision

- The admin is **rewritten from scratch**. The existing code is neither a base nor a constraint; it may be consulted only as a
  record of past intents.
- The **visual style** of the mock-up is the reference (typography, density, monochrome
  palette with per-type colours, light/dark, inspector layout).
- **Features are bounded by what the APIs allow** (persistence OpenAPI, `*_def.json`), see
  the feasibility table below. Anything beyond requires a request to the services team or a
  documented BFF-side workaround.
- Docker / local tooling is redone too, starting from a Makefile provided by the maintainer
  (separate ADR).

## Feasibility of the mock-up against the API

| Mock-up feature | Feasible? | How / limit |
|-----------------|-----------|-------------|
| Children of an item, paginated | Yes | `GET /items?parent_id=<uuid>&page&page_size` (full scan per call) |
| Children filtered by type | Yes | `parent_id` + `object_type` combined |
| Child counts per type | Costly | 1 call `page_size=1` per known type → ~17 full scans per item; alternative: one children listing grouped client-side when small |
| Roots | Yes | `parent_id=""` (empty string, not null) |
| Ancestors breadcrumb | Yes | Walk `GET /items/{parent_id}` up, depth guard |
| Go to UUID | Yes | `GET /items/{uuid}` (404 if absent) |
| Search by name / substring | **No** | No such filter; needs a BFF-side index or a service change |
| UUID fields as links | Yes | Detect UUID values, resolve with `GET /items/{uuid}` |
| Properties grouped by channel | Yes | From `*_def.json`; undeclared keys listed apart |
| Live refresh | Yes | Polling `GET /items/{uuid}`; no push channel on the REST API |
| Edit | Yes | `PUT` full replace: whole `object_data` sent; complex values need a JSON editor |
| Delete | Yes | `DELETE` always 204; children are not deleted (orphans) |
| Create with definition props | Yes | Client-assigned UUID; whether Horizon accepts `null` values is **unknown** |
| Global list by type | Yes | `GET /items?object_type=…` paginated |
| Bulk import | Yes | Unit POSTs, see [ADR 0004](./0004-bulk-import-unit-posts.md) |
| Show internal service URL (`localhost:3001` badge) | **Not allowed** | Internal URLs stay in the BFF; show the server name instead |

## Open questions

- ~~Which navigation to keep~~ → combination, see [ADR 0008](./0008-combined-navigation-type-aware-views.md).
- ~~Is live refresh a real need~~ → yes, see [ADR 0009](./0009-live-refresh-by-polling.md).
- ~~Scope beyond persistence~~ → dropped for now (dashboard, Keycloak accounts, bans,
  missions…). Work is organised **by lots**; lot 1 = items ([ADR 0003](./0003-persistence-lot-1-items-scope.md)).
- ~~Stack~~ → React, Vite, TypeScript, Tailwind, see [ADR 0010](./0010-frontend-stack.md).
- ~~UI languages~~ → EN + FR.
- ~~Existing code~~ → removed in one go.

### Update (2026-10-04): search within a level, through the BFF

Filtering only the page on screen was too limiting (a player among 1,263, a building among
605). The explorer's field now searches the **whole listed level** by a piece of name or UUID,
case-insensitive: `GET /api/items?…&q=` (BFF contract, `ItemsSearchSchema`). As persistence
has no such filter yet, one BFF function (`searchLevel`) reads the level whole — kept 30 s like
the map's listings, sharing a body's children with it — filters and pages the matches. When
persistence offers a search by a piece of name (ADR 0021, item 4), only that function changes;
the route, the web app and the route tests stay. First search of a large level: about 4–5 s for
SandBox's 20,000 children when not already cached, about 1 s for the 1,263 players.

## Consequences

- ADRs 0003–0006 describe the target, not fixes to the existing code.
- An import screen and other screens absent from the mock-up must be designed in its style.
- README / ONBOARDING / ARCHITECTURE will have to be rewritten once the stack is decided.
