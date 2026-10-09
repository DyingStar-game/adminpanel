# 0011. BFF: a lightweight Hono server alongside the Vite app

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The browser cannot reach cluster services (`service-persistence` is only resolvable inside
the namespace) and internal URLs must never reach the frontend (`ARCHITECTURE.md`).
Several decisions also need server-side logic that the persistence API does not provide:

- existence check before `POST` → 409 ([ADR 0004](./0004-bulk-import-unit-posts.md));
- re-read + field-level merge before `PUT` ([ADR 0009](./0009-live-refresh-by-polling.md));
- coalescing identical polls from several viewers ([ADR 0009](./0009-live-refresh-by-polling.md));
- fetching and caching `*_def.json` from GitHub ([ADR 0006](./0006-object-type-definitions.md));
- per-game-server configuration (`universe`, `universe-testing`…);
- possibly later: a name index for search, a WebSocket to Horizon.

The frontend stays on Vite ([ADR 0010](./0010-frontend-stack.md)).

## Options considered

1. **Reverse proxy only (nginx)** — hides URLs but carries none of the logic above.
2. **Next.js (Route Handlers as BFF)** — one app, but SSR is useless for a client-heavy live
   admin, replaces Vite, and its caching model is risky for live data; awkward for long-lived
   connections or background jobs.
3. **Vite SPA + lightweight Node BFF** — explicit control over caching and polling, natural
   home for future WebSocket / background jobs, keeps Vite.

## Decision

- Option 3, with **[Hono](https://hono.dev/)** on Node (TypeScript, strict).
- The BFF **also serves the built SPA** in production: one container, one port.
  In development, Vite runs its own dev server and proxies `/api` to the BFF.
- **Monorepo** with a shared package holding the **Zod schemas** of the persistence contract
  and the BFF API, used by both sides (validation of requests, responses, forms, imports).
- The BFF is the only component holding internal URLs and secrets.
- No authentication ([ADR 0002](./0002-no-admin-authentication.md)).

## Open questions

- ~~Package manager / runtime~~ → pnpm workspaces, Node 24, see [ADR 0012](./0012-docker-makefile-tooling.md).
- Hono validation helper (`@hono/zod-validator`) and typed client (`hono/client` RPC) to
  share route types with the frontend?

## Consequences

- One image to build and deploy; the Makefile-based tooling (to come) targets it.
- The BFF API is our own contract (not a raw proxy of persistence): it must be documented.
