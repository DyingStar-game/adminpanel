# 0013. Testing strategy: Vitest, Testing Library, MSW

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The rewrite ([ADR 0007](./0007-rewrite-admin-from-design.md)) must ship with tests. Stack:
Vite + React + TypeScript frontend, Hono BFF, shared Zod schemas, pnpm monorepo
([ADR 0010](./0010-frontend-stack.md), [ADR 0011](./0011-bff-hono.md)). Most risk sits in logic
that the persistence API does not provide and we implement ourselves: 409 on existing UUID,
field-level merge before PUT, import validation and ordering, UUID reference detection,
property grouping by channel, polling diffs.

## Options considered

- **Jest** — mature, but needs extra transforms for ESM / TypeScript / Vite config.
- **Vitest** — reuses the Vite config and transforms, Jest-compatible API, native ESM and
  TypeScript, workspace support for monorepos. Hono apps are tested in-process with
  `app.request()`, no server to start.
- **E2E: Playwright vs Cypress** — Playwright is faster, multi-browser, runs headless in Docker.

## Decision

| Level | Tool | Covers |
|-------|------|--------|
| Unit | **Vitest** | Shared Zod schemas, pure logic (merge, diff, reference detection, channel grouping, import validation / ordering) |
| BFF | **Vitest** + Hono `app.request()` + **MSW** (mocks persistence and GitHub over HTTP) | Routes, 409, merge-before-PUT, error mapping, poll coalescing |
| Frontend components | **Vitest** + **Testing Library** (`@testing-library/react`, `user-event`, `jest-dom`) + **MSW** (mocks the BFF) in **jsdom** | Views, forms, live highlight, import preview |
| End-to-end | **Playwright** — later lot, a few smoke journeys against the full stack with a mocked persistence | Navigation explorer → object page → orbit, edit, import |

- One Vitest workspace at the root; `make pnpm test` runs everything in the `dev` container.
- MSW handlers and fixtures are **built from the OpenAPI contract and real data shapes**
  (roots with `parent_id: ""`, quaternion `rotations`, `components` keyed by slot, dangling
  references), so mocks behave like the service (exact-match filters, upserts, DELETE 204).
- Coverage is measured (`@vitest/coverage-v8`), no blocking threshold for now.

## Consequences

- No separate test runner config: Vitest reads `vite.config.ts`.
- MSW fixtures double as documentation of the persistence behaviour.
- Playwright adds browser images to the Docker tooling when it is introduced.
