# Dashboard V2 Rewrite Plan

## Goals and Constraints
- State management: use plain React hooks (`useState`, `useReducer`, `useMemo`, `useContext`, custom hooks). Avoid atom/state libraries in v2.
- React 19 UX primitives: use transitions for navigation/loading/update flows (`startTransition`, `useTransition`, `useDeferredValue`, `useOptimistic` where it adds value).
- Testability first: establish fast component tests with React Testing Library and a Playwright end-to-end suite.
- UI toolkit: use `@alinea/components` as the default UI surface.
- Core integration: keep using `alinea/core` for config/schema/db/query/policy primitives.
- Field rendering: do not reuse existing dashboard field views; build new v2 field views wired to `@alinea/components`.
- Styling: use CSS Modules plus `@alinea/styler`.

## Current Dashboard (v1) Condensed Map

### Runtime and Data Flow
- Bootstraps via `src/dashboard/boot/Boot.tsx` with a shared worker (fallback local worker), then renders `src/dashboard/App.tsx`.
- Global state is mostly Jotai atoms (`src/dashboard/atoms/*`) plus React Query for async query caching.
- Router is a custom hash router + atom-based route matching (`src/dashboard/atoms/LocationAtoms.ts`, `src/dashboard/atoms/RouterAtoms.tsx`).
- DB sync/event updates are driven by `WorkerDB` + `IndexEvent` listeners (`src/dashboard/atoms/DbAtoms.ts`).
- Entry editing state is centralized in `entryEditorAtoms` with transitions (save/publish/discard/delete/restore), revisions, preview payload, and draft tracking (`src/dashboard/atoms/EntryEditorAtoms.ts`).

### Routes
- Defined in `src/dashboard/Routes.tsx`.
- `"/edit"`: resolves entry by URL query params (`url`, optional `workspace`, `root`) then redirects to canonical entry route.
- `"*"` fallback route: renders content/editor/root views depending on selected entry/root.
- Navigation URL shape comes from `src/dashboard/DashboardNav.ts`:
  - Entry: `#/entry/:workspace/:root?/:id?` where root may include locale as `root:locale`.
  - Create modal is query-based: `?new` on entry URL.

### Primary Views
- `ContentView` orchestrates main split layout: search, tree, create button, root overview vs entry editor (`src/dashboard/pages/ContentView.tsx`).
- `EntryTree` provides async tree loading, selection, DnD move/reorder, status badges, locale-aware labels (`src/dashboard/view/EntryTree.tsx`).
- `SearchBox` uses explorer query + row/thumb switcher in popover (`src/dashboard/view/SearchBox.tsx`).
- `EntryEdit` is the core editor surface (`src/dashboard/view/EntryEdit.tsx`):
  - Header/title/status actions.
  - Edit vs diff mode.
  - Draft/publish/translation workflows.
  - Unsaved-change route blocker.
  - Keyboard save shortcut.
  - History/revision preview.
  - Optional live preview pane.
- New entry creation is modal + dynamic form (`src/dashboard/view/entry/NewEntry.tsx`), including parent/type constraints and optional copy-from.
- Media explorer + uploader exists as separate flow (`src/dashboard/view/MediaExplorer.tsx`, `src/dashboard/view/media/*`).

### Key Features
- Workspace/root/locale switching with policy-gated visibility.
- Entry CRUD, ordering/move, status workflows (draft/published/archived).
- Translation flow with untranslated state and parent-translation dependency.
- Diff view and revision history browsing.
- Live preview integration.
- User/session controls and preferences (theme/font/workspace).

## V2 Rewrite Architecture (Target)

### 1. Foundation
- Keep `src/v2` as isolated app entry (`bun dev` already works).
- Establish directories:
  - `src/v2/app` (shell + providers)
  - `src/v2/routing` (URL state + route matching + transitions)
  - `src/v2/data` (db/client adapters + query hooks)
  - `src/v2/features/*` (tree, editor, create, media, preview)
  - `src/v2/fields/*` (new field view registry and inputs)
  - `src/v2/styles/*` (tokens, shared module patterns)
- Add strict module boundaries: UI components read from feature hooks, feature hooks read from `alinea/core` adapters.

### 2. State Model (Hooks-only)
- App-level context should expose stable services: `config`, `db`, `client`, `policy`, session/user.
- Route state: derive from URL + parser in a custom hook (`useRouteState`), with transition-based navigation (`startTransition` wrapped `navigate`).
- Feature-local reducers for complex workflows:
  - Entry editor reducer: selected status, mode, pending transition, optimistic UI.
  - Tree reducer: expanded nodes, selection, drag target.
  - Create modal reducer: type/parent/options loading state.
- Keep async data in hooks with explicit loading/error/value states; no hidden global atom graph.

### 3. React 19 Transition Usage
- Route changes and heavy data refetch run inside transitions to preserve UI responsiveness.
- Use `useTransition` around:
  - entry navigation
  - root/locale switches
  - opening heavy panels (history/diff/preview)
- Use `useDeferredValue` for search input to avoid blocking while typing.
- Use `useOptimistic` for immediate status/action feedback where mutation latency is noticeable (publish/save ordering updates).

### 4. View and Route Migration Order
- Phase A: shell + route parser + minimal content layout (toolbar/sidebar/viewport).
- Phase B: root overview + entry tree + search navigation.
- Phase C: entry editor core (header, form surface, save/publish actions, route blocking).
- Phase D: new-entry modal flow.
- Phase E: history/diff/preview.
- Phase F: media explorer/uploader.
- At each phase, keep old dashboard untouched and validate parity in v2.

### 5. Field System Rewrite (No Reuse of v1 Views)
- Build v2 field registry mapped from schema field kinds to new React components using `@alinea/components`.
- Implement shared field contract:
  - `value`, `onChange`, `onBlur`, validation/error display, disabled/readOnly, localization context.
- Start with high-frequency fields first: text, number, select, check, path, object/list, rich text wrappers.
- Add compatibility layer for custom schema views by mapping `view` keys to v2 components (separate from v1 registry).

### 6. Styling System
- Use CSS Modules for all feature styling.
- Use `@alinea/styler` for class composition and variants.
- Define a small v2 token layer (`spacing`, `radius`, `surface`, `text`, `accent`) to keep modules consistent.
- Keep component styling close to feature folders; avoid global CSS except reset/base primitives.

### 7. Test Plan
- Unit/component tests (React Testing Library):
  - route parser + navigation hook behavior.
  - tree interactions (selection, expand/collapse, keyboard).
  - editor actions (save/publish/discard blockers).
  - field components (value flow, validation, accessibility roles).
- Playwright e2e smoke suite:
  - open root, navigate to entry, edit and save.
  - create new entry and verify it appears in tree.
  - switch locale/workspace and preserve navigation correctness.
  - preview/history visibility toggles.
- Add deterministic fixtures from `apps/dev/content` for stable assertions.

### 8. Definition of Done (Per Feature)
- Feature implemented in v2 with hook-only state.
- Transition states visible and non-blocking.
- RTL coverage for critical interactions.
- Playwright path covering happy flow.
- No dependency on v1 dashboard-specific atoms/views.
- Uses `@alinea/components` UI primitives + CSS Modules/`@alinea/styler`.

## Recommended Immediate Next Steps
1. Scaffold v2 folder structure and base providers/router hooks.
2. Implement route-state + URL transition layer and cover with RTL tests.
3. Build tree + root overview first to establish navigation and parity baseline.
