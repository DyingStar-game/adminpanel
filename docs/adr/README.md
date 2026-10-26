# Architecture Decision Records

This folder records the significant decisions taken on the DyingStar Admin Panel,
using lightweight ADRs ([Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

## Conventions

- One file per decision: `NNNN-short-title-in-kebab-case.md` (4-digit sequence, never reused).
- Start from [`template.md`](./template.md).
- Statuses: `Proposed` → `Accepted` | `Rejected`; later `Deprecated` or `Superseded by NNNN`.
- An accepted ADR is not rewritten: write a new ADR that supersedes it.
- **An accepted ADR is binding, to the letter.** Reread the ADRs of an area before working in
  it and check each of their rules before calling the work done: lint enforces only part of
  them. `apps/web/src/conventions.test.ts` checks the frontend rules lint cannot (ADR 0010,
  0014, 0020); when it fails, fix the code, not the test.
- Written in English, like the rest of the contributor documentation.

## Index

Grouped by domain; each ADR appears once, under its main domain. Numbers stay global and files
stay flat in this folder, so links never move.

### Read first

The rules applied every day: [0010](./0010-frontend-stack.md) (frontend stack, forms),
[0014](./0014-atomic-design-shadcn.md) (atomic design, tables, a test per component),
[0020](./0020-visual-identity-first-panel.md) (look), [0013](./0013-testing-strategy.md) (tests),
[0023](./0023-keycloak-authentication.md) (sign-in and rights),
[0024](./0024-game-services-social-first.md) (how a game service enters the panel).

### Foundations — tooling, stack, BFF, tests, design system

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-01 |
| [0010](./0010-frontend-stack.md) | Frontend stack: React, Vite, TypeScript, Tailwind | Accepted | 2026-10-01 |
| [0011](./0011-bff-hono.md) | BFF: a lightweight Hono server alongside the Vite app | Accepted | 2026-10-01 |
| [0012](./0012-docker-makefile-tooling.md) | Local tooling and Docker: Makefile + compose | Accepted | 2026-10-01 |
| [0013](./0013-testing-strategy.md) | Testing strategy: Vitest, Testing Library, MSW | Accepted | 2026-10-01 |
| [0014](./0014-atomic-design-shadcn.md) | Frontend components: atomic design on top of shadcn/ui | Accepted | 2026-10-01 |
| [0020](./0020-visual-identity-first-panel.md) | Visual identity: back to the first DyingStar panel's look | Accepted | 2026-10-02 |

### Access — sign-in and rights

| # | Title | Status | Date |
|---|-------|--------|------|
| [0023](./0023-keycloak-authentication.md) | Keycloak authentication and role-based access | Accepted in part (sign-in, local dev) | 2026-10-08 |

### Persistence — items, navigation, views, map, import

| # | Title | Status | Date |
|---|-------|--------|------|
| [0003](./0003-persistence-lot-1-items-scope.md) | Manage persistence — lot 1 scope: items | Accepted | 2026-10-01 |
| [0004](./0004-bulk-import-unit-posts.md) | Bulk import: JSON array sent as unit POSTs | Accepted | 2026-10-01 |
| [0005](./0005-hierarchy-lazy-navigation.md) | Item hierarchy: lazy, paginated navigation | Accepted | 2026-10-01 |
| [0006](./0006-object-type-definitions.md) | Object type definitions drive the editor | Accepted | 2026-10-01 |
| [0008](./0008-combined-navigation-type-aware-views.md) | Combined navigation with type-aware views | Accepted | 2026-10-01 |
| [0009](./0009-live-refresh-by-polling.md) | Live refresh by polling the persistence REST API | Accepted | 2026-10-01 |
| [0015](./0015-unknown-object-types-refused-on-write.md) | Unknown object types are refused on write | Accepted | 2026-10-01 |
| [0016](./0016-scene-schematics.md) | Scene schematics: declarative views per `scenename` | Accepted | 2026-10-02 |
| [0017](./0017-duplicate-items.md) | Duplicating an item, with its children, next to a player | Accepted | 2026-10-02 |
| [0018](./0018-planetary-map.md) | Planetary map: a 2D view of everything placed on a celestial body | Accepted | 2026-10-02 |
| [0019](./0019-bulk-import-validation.md) | Bulk import: input and per-item format and coherence checks | Accepted | 2026-10-02 |
| [0022](./0022-item-form-coherence-checks.md) | Coherence checks on the create and edit forms, for every type | Accepted | 2026-10-07 |
| [0029](./0029-crate-contents.md) | What a crate holds: its page, its schematic and the contents of what carries it | Accepted | 2026-10-23 |
| [0021](./0021-persistence-query-needs-at-scale.md) | Persistence query needs for the admin at game scale (a request to the back team) | Proposed | 2026-10-04 |

### Game services

| # | Service | Title | Status | Date |
|---|---------|-------|--------|------|
| [0024](./0024-game-services-social-first.md) | all, `social` | Game services in the panel, social moderation first | Accepted | 2026-10-08 |
| [0025](./0025-universe-simulation-section.md) | `universesimulator` | Universe simulation section: `universesimulator` in the panel | Accepted | 2026-10-11 |
| [0026](./0026-mission-objective-schematics.md) | `mission` | Mission objective schematics: a declarative view per objective kind | Accepted | 2026-10-23 |
| [0027](./0027-mission-places-map.md) | `mission` | A mission's places on a map | Accepted | 2026-10-23 |
| [0028](./0028-cancelling-a-mission.md) | `mission` | Cancelling a mission, and the simulation's missions in the mission views | Accepted | 2026-10-23 |
| [0030](./0030-holder-inventory.md) | `inventory` | What a holder owns: reading `inventory` where the panel shows the holder | Proposed | 2026-10-24 |
| [0031](./0031-npc-section.md) | `npc` | NPCs section: the `npc` service in the panel | Proposed | 2026-10-25 |

`social` and `economie` have no ADR of their own: their steps follow 0023 (rights) and 0024.

### History — superseded or done once

Kept for the record; no longer rules.

| # | Title | Status | Date |
|---|-------|--------|------|
| [0002](./0002-no-admin-authentication.md) | No authentication on the admin panel | Superseded by 0023 | 2026-10-01 |
| [0007](./0007-rewrite-admin-from-design.md) | Rewrite the admin from scratch, styled after the mock-up | Accepted, done (style superseded by 0020) | 2026-10-01 |
