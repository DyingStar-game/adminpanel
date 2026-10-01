# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Golden rule — Git

- **Never commit, amend, tag or push on your own.** The maintainer creates every commit.
- Exception granted by the maintainer: commits are allowed **only on the working branch
  `feature/manage-persistence`**, under the maintainer's git identity. Never on any other branch,
  never amend, never push.
- Never add `Co-Authored-By` or any AI attribution to commits or PR descriptions.
- Allowed: creating/switching branches and read-only commands (`git status`, `git diff`, `git log`). Staging is left to the maintainer.

## Conventions

- Branches: `feature/…`, `fix/…`, `docs/…` (see `ONBOARDING.md` §10).
- Commit messages: Conventional Commits (`feat: …`, `fix: …`, `docs: …`) — to suggest, not to run.
- Code, comments and contributor docs in English; UI strings in both `en` and `fr`
  (`packages/frontend/src/i18n/translations.ts`).
- Read `README.md`, `ONBOARDING.md` and `ARCHITECTURE.md` before changing architecture.

## Way of working

- Analyse the need before coding. Significant decisions are recorded as ADRs in
  [`docs/adr/`](./docs/adr/) (`Proposed` → `Accepted` before implementation).
