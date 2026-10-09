# 0020. Visual identity: back to the first DyingStar panel's look

- **Status:** Accepted
- **Date:** 2026-10-02
- **Scope:** Project-wide
- **Supersedes:** the visual style part of [ADR 0007](./0007-rewrite-admin-from-design.md)

## Context

ADR 0007 took the visual style of the Claude Design mock-up as the reference: monochrome light
and dark themes, Geist fonts, a top bar. Once lot 1 was built, the project lead asked for the look
of the **first panel** (removed in `e13450e`, kept in git history at `ec27df9:packages/frontend`)
— the same colours and style — while keeping everything built since: views, live, writes,
schematics, map, import.

The first panel's look, read from its sources:

- palette `ds-*`: background `#0d0d14`, surface `#16161f`, border `#2a2a3a`, gold accent
  `rgb(255,186,8)`, muted text `#6b6b80`, success `#22c55e`, danger `#ef4444`; dark only;
- Poppins for text, JetBrains Mono for identifiers;
- a fixed left **sidebar** (brand ★ DyingStar / Admin Panel, active server, sections
  Supervision / Game world / Administration / Configuration, version and GitHub at the bottom),
  a header with the breadcrumb, the language and the active server;
- pages with a large gold title and their main action on the right (« Ajouter un item »), the
  content in a rounded card;
- gold translucent primary buttons with a glow on hover, quiet secondary buttons, translucent
  red for danger, rounded cards, tinted badges.

## Decision

- The first panel's palette, fonts and components replace the mock-up's, **dark only**: the
  tokens are set once in `apps/web/src/index.css` (the `dark` class is always on `<html>`; the
  theme switch and preference are removed). Fonts are bundled (`@fontsource`), not loaded from
  Google, so the panel works offline.
- The shell is the first panel's: sidebar on the left (only built pages are clickable, the
  others are shown as « bientôt »), header with breadcrumb, UUID search, live switch, language
  and active server. Page titles carry their main action (Add an item on Persistence — Items).
- Monospace is kept for technical values only (UUIDs, coordinates, JSON, property paths); type
  names, labels and column headers use Poppins, column headers in spaced capitals.
- The **layouts of the views** (explorer columns, orbit graph, object page, map, import) and the
  per-type colours stay as they are: only their skin changes.
- Sizes come from the Tailwind scale and two theme text sizes (`text-3xs` 10 px, `text-2xs`
  11 px); ESLint refuses arbitrary pixel values in class names (composite values such as
  `clamp(…)` stay possible).
- The mock-up in `docs/design/` remains the reference for the views' structure, not their look.

### Update (2026-10-04): lighter muted text, adding from the canvases

At the maintainer's request, muted text goes from `#6b6b80` (3.1 to 3.7:1 on the backgrounds)
to `#8a8aa0` (4.8 to 5.7:1, WCAG AA for small text), still apart from the secondary `#a6a6ba`.
The orbit view and the map gain an "Add an item" action (child of the centre / of the body).

## Consequences

- One visual identity across the DyingStar admin, the one the team knows.
- No light theme any more.
- The first panel's muted text `#6b6b80` is kept as is although it is below a 4.5:1 contrast on
  the background for small text; it can be lightened later if needed.
- The orbit view and the map have no title bar (full-screen canvases): creating an item is done
  from Persistence — Items.
