# 0010. Frontend stack: React, Vite, TypeScript, Tailwind

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The admin is rewritten from scratch ([ADR 0007](./0007-rewrite-admin-from-design.md)).
The team is used to the React ecosystem and wants to keep it.

## Decision

- **Core:** React, Vite, TypeScript (strict), Tailwind CSS.
- **Libraries:**
  - Zustand — client state (selection, view mode, live pause, theme, locale);
  - Zod — schemas and validation, shared with the BFF ([ADR 0011](./0011-bff-hono.md));
  - TanStack Query — server state and polling ([ADR 0009](./0009-live-refresh-by-polling.md));
  - React Hook Form (+ `@hookform/resolvers/zod`) — forms;
  - tailwind-merge (+ `clsx`, through a `cn()` helper) — class composition.
- **Tests:** see [ADR 0013](./0013-testing-strategy.md).
- **UI languages:** English (default) and French.
- **Existing code:** removed in one go when the rewrite starts (no lot-by-lot migration).

## Open questions

- ~~Routing~~ → **TanStack Router**: type-safe routes and search params (selected UUID,
  page, view, filters), so any entity / view is addressable and shareable by URL.
- ~~Icons / component library~~ → shadcn/ui + lucide-react, atomic design, see [ADR 0014](./0014-atomic-design-shadcn.md).
- Folder layout, lint / format conventions.
- ~~BFF stack / monorepo~~ → Hono on Node, monorepo with shared Zod schemas, see [ADR 0011](./0011-bff-hono.md).

## Consequences

- Zod schemas can describe the persistence contract once and be reused for validation of
  forms, import files and API responses.
- TanStack Query covers polling, pause on hidden tab and cache invalidation natively.
