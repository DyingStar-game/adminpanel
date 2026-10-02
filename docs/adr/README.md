# Architecture Decision Records

This folder records the significant decisions taken on the DyingStar Admin Panel,
using lightweight ADRs ([Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

## Conventions

- One file per decision: `NNNN-short-title-in-kebab-case.md` (4-digit sequence, never reused).
- Start from [`template.md`](./template.md).
- Statuses: `Proposed` → `Accepted` | `Rejected`; later `Deprecated` or `Superseded by NNNN`.
- An accepted ADR is not rewritten: write a new ADR that supersedes it.
- Written in English, like the rest of the contributor documentation.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-01 |
| [0002](./0002-no-admin-authentication.md) | No authentication on the admin panel | Accepted | 2026-10-01 |
| [0003](./0003-persistence-lot-1-items-scope.md) | Manage persistence — lot 1 scope: items | Accepted | 2026-10-01 |
| [0004](./0004-bulk-import-unit-posts.md) | Bulk import: JSON array sent as unit POSTs | Accepted | 2026-10-01 |
| [0005](./0005-hierarchy-lazy-navigation.md) | Item hierarchy: lazy, paginated navigation | Accepted | 2026-10-01 |
| [0006](./0006-object-type-definitions.md) | Object type definitions drive the editor | Accepted | 2026-10-01 |
| [0007](./0007-rewrite-admin-from-design.md) | Rewrite the admin from scratch, styled after the mock-up | Accepted (style superseded by 0020) | 2026-10-01 |
| [0008](./0008-combined-navigation-type-aware-views.md) | Combined navigation with type-aware views | Accepted | 2026-10-01 |
| [0009](./0009-live-refresh-by-polling.md) | Live refresh by polling the persistence REST API | Accepted | 2026-10-01 |
| [0010](./0010-frontend-stack.md) | Frontend stack: React, Vite, TypeScript, Tailwind | Accepted | 2026-10-01 |
| [0011](./0011-bff-hono.md) | BFF: a lightweight Hono server alongside the Vite app | Accepted | 2026-10-01 |
| [0012](./0012-docker-makefile-tooling.md) | Local tooling and Docker: Makefile + compose | Accepted | 2026-10-01 |
| [0013](./0013-testing-strategy.md) | Testing strategy: Vitest, Testing Library, MSW | Accepted | 2026-10-01 |
| [0014](./0014-atomic-design-shadcn.md) | Frontend components: atomic design on top of shadcn/ui | Accepted | 2026-10-01 |
| [0015](./0015-unknown-object-types-refused-on-write.md) | Unknown object types are refused on write | Accepted | 2026-10-01 |
| [0016](./0016-scene-schematics.md) | Scene schematics: declarative views per `scenename` | Accepted | 2026-10-02 |
| [0017](./0017-duplicate-items.md) | Duplicating an item, with its children, next to a player | Accepted | 2026-10-02 |
| [0018](./0018-planetary-map.md) | Planetary map: a 2D view of everything placed on a celestial body | Accepted | 2026-10-02 |
| [0019](./0019-bulk-import-validation.md) | Bulk import: input and per-item format and coherence checks | Accepted | 2026-10-02 |
| [0020](./0020-visual-identity-first-panel.md) | Visual identity: back to the first DyingStar panel's look | Accepted | 2026-10-02 |
