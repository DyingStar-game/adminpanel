# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Golden rule — Git

- **Never commit, amend, tag or push on your own.** The maintainer creates every commit.
- Exception granted by the maintainer: commits are allowed **only on the working branch
  `feature/manage-persistence`**, under the maintainer's git identity. Never on any other branch,
  never amend, never push.
- Never add `Co-Authored-By` or any AI attribution to commits or PR descriptions.
- Allowed otherwise: creating/switching branches and read-only commands (`git status`, `git diff`,
  `git log`).

## Commands — always go through the Makefile

Run everything through `make` (Docker / podman, pinned Node and pnpm); do not call `pnpm`,
`node` or `docker compose` directly on the host.

| Need | Command |
|------|---------|
| Start the dev container | `make up` (then `make down` to stop) |
| Install dependencies | `make install` |
| Any pnpm command | `make pnpm <cmd>` — flags go through `ARGS`, e.g. `make pnpm add zod ARGS="--filter @dyingstar-admin/web"` |
| Dev servers (Vite :5173 + BFF :3000) | `make pnpm dev` |
| Checks before committing | `make pnpm lint`, `make pnpm typecheck`, `make pnpm test`, `make pnpm format:check` |
| Testers profile (build + serve on :3000) | `make start` / `make stop` |
| Production image | `make image` |
| Logs, shell, status | `make logs`, `make shell`, `make status` |

`make help` lists every target.

## Repository layout

- `apps/web` — Vite + React SPA (TanStack Router / Query, Zustand, react-i18next, Tailwind,
  shadcn/ui). Components follow atomic design in `src/components/{ui,atoms,molecules,organisms,templates}`
  and `src/pages`; import rules are enforced by ESLint (ADR 0014).
- `apps/bff` — Hono BFF; the only component holding internal URLs. Serves the built SPA in production.
- `packages/schemas` — shared Zod schemas (persistence contract, BFF API).
- `docker/` — compose file (`app`, `dev` services) and `Dockerfile.prod`.

## Conventions

- Commit messages: Conventional Commits with the step as scope (`feat(bff): …`).
- TypeScript strict; code, comments and contributor docs in English; UI strings in both `en` and
  `fr` (`apps/web/src/i18n/locales/`).
- Tests next to the code (Vitest, Testing Library, MSW) — ADR 0013.
- Persistence test server: my own direct calls (curl, scripts) are **GET only**; the app itself
  does write.

## Way of working

- Analyse the need before coding. Significant decisions are recorded as ADRs in
  [`docs/adr/`](./docs/adr/) (`Proposed` → `Accepted` before implementation).
- The lot 1 plan is in [`docs/lot-1-plan.md`](./docs/lot-1-plan.md).
