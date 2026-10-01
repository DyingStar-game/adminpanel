# 0014. Frontend components: atomic design on top of shadcn/ui

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Frontend

## Context

The Claude Design mock-up repeats the same building blocks across its three views (top bar,
inspector, property rows, breadcrumbs, pagination, type dots…), see
[ADR 0008](./0008-combined-navigation-type-aware-views.md). Two rules are required:

1. components are organised following **atomic design**, each one existing **once** and
   being reused everywhere (no local copies or near-duplicates);
2. we **do not rebuild** what the ecosystem already provides well (accessible dialogs,
   menus, tabs, tooltips, tables…).

## Decision

### Base library: shadcn/ui (Radix primitives)

- Components are added with the shadcn CLI into the repo (owned code, not a dependency),
  then **restyled to the mock-up**: its colour tokens (`--bg`, `--fg`, `--line`, `--acc`…)
  are mapped onto shadcn CSS variables, light / dark through the `dark` class, Geist / Geist Mono.
- It already relies on Tailwind, `clsx` + `tailwind-merge` through `cn()`
  ([ADR 0010](./0010-frontend-stack.md)) and **lucide-react** for icons (settles the icon question).
- Accessibility (keyboard, focus, ARIA) comes from Radix.
- Heavier needs use specialised headless libraries rather than custom code:
  **TanStack Table** (paginated tables), **TanStack Virtual** (long trees / lists).
  **React Flow (`@xyflow/react`)** for the orbit view: it must be navigable as in the mock-up
  (click = inspect, double-click = re-centre, "load more" clusters, pan / zoom). Nodes are our
  own React components (atoms / molecules), the radial layout is computed by us.

### Atomic levels

```
src/components/
├── ui/          # shadcn/ui primitives (generated, restyled) — act as atoms / molecules
├── atoms/       # our own atoms when shadcn has none: TypeDot, MonoText, Kbd, LiveDot…
├── molecules/   # SearchBar, LiveToggle, Breadcrumb, Pagination, PropertyRow, UuidLink, ConfirmBox…
├── organisms/   # TopBar, HierarchyTree, ItemsTable, Inspector, PropertyChannelSection, OrbitGraph, ImportPreview…
└── templates/   # ExplorerLayout, ObjectPageLayout, OrbitLayout (layout only, no data)
src/pages/       # ExplorerPage, ObjectPage, OrbitPage, ImportPage (templates + data)
```

### Rules

- A level imports only from **lower** levels (`ui` / `atoms` → `molecules` → `organisms` →
  `templates` → `pages`); never sideways into a sibling feature's internals, never upwards.
- **No data fetching below organisms**: atoms and molecules are pure (props in, events out);
  organisms may use hooks (TanStack Query, Zustand); pages wire templates to data.
- Before creating a component: reuse an existing one, extend it with a variant
  (e.g. `class-variance-authority`, as shadcn does), or add a shadcn primitive.
  A new component must not duplicate an existing one.
- Business-specific rendering (type profiles, value renderers from ADR 0008) lives in
  organisms / molecules, never in `ui/`.
- Import rules are **enforced by lint** (e.g. `eslint-plugin-boundaries`).
- Each component has its tests next to it ([ADR 0013](./0013-testing-strategy.md)).

## Open questions

- ~~Storybook~~ → not for now.
- ~~Orbit rendering~~ → React Flow.

## Consequences

- One visual language across views; changing the style of an atom changes it everywhere.
- shadcn code is ours: updates from upstream are pulled manually, on purpose.
