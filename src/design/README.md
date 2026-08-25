# Alinea design foundation

This folder is a clean-room reconstruction of the Alinea dashboard design system. It exists to expose the smallest useful set of primitives before those primitives are composed into the entry editor, overview, users pages, and their dialogs.

## Goals

- Match the current Alinea dashboard closely. New visual language should not be invented while an existing product decision can be extracted.
- Keep every component in its own CSS Module and author source selectors as `.alinea-Component-part`.
- Style through classes, `data-*` state, pseudo states such as `:hover` and `:focus-visible`, and `--alinea-*` variable inputs. Do not target content by element name.
- Keep selectors flat and predictable. Use `@scope` where ownership or nesting is the behavior being modeled.
- Keep component DOM independent from the production components while the foundation is being discovered. The design canvas imports only the new files in this folder.
- Support light and dark themes from the same rules. Semantic colors use `light-dark()` and are exercised by the canvas theme switch.
- Preserve the canvas workflow: fixed authored widths, CSS scaling, click-to-center, Ctrl+wheel zoom, Space+drag pan, scrollbars, and Ctrl+0 reset.

## Token policy

Core tokens are limited to decisions shared by several unrelated components. A value used only by one component stays a component input such as `--alinea-Button-padding`; it does not become a global token.

### Core groups

- Raw color ramps: gray, blue, red, orange, and green. Components never consume these unless a semantic token cannot express the intent.
- Semantic surfaces: `--alinea-backdrop`, `--alinea-bg`, `--alinea-bg-muted`, `--alinea-input`, `--alinea-overlay`, and `--alinea-scrim`.
- Semantic foregrounds: `--alinea-fg`, `--alinea-fg-muted`, `--alinea-fg-subtle`, `--alinea-fg-disabled`, and `--alinea-fg-strong`.
- Interaction: border, ring, primary, danger, muted-control, hover, and overlay variants.
- Status: published, draft, unpublished, and archived foreground/background pairs.
- Spacing: 4, 8, 16, and 24px. Intermediate values remain component-level until repeated usage proves otherwise.
- Typography: 12, 13, 14, and 18px with regular, medium, and semibold weights.
- Shape and elevation: an 8px control radius, round radius, raised/muted/modal shadows, 30px controls, and 40px rows.

Before adding a token, record at least two independent consumers. Prefer a semantic alias over exposing a raw palette value to components.

## Component conventions

- Components are functions and props use an exported `*Props` interface.
- CSS Modules are joined with `@alinea/styler`.
- State belongs on the component root where possible: `data-selected`, `data-invalid`, `data-disabled`, `data-depth`, and similar attributes.
- Native interaction remains available in the canvas. Story-only state attributes may demonstrate hover and focus without replacing the real pseudo states.
- Explicit variants override automatic context. For example, an unqualified Surface nested inside another Surface becomes muted through `@scope`, while `data-depth="base"` opts out.

## Roadmap

1. Foundations: tokens, Button, Field, Checkbox, Surface, Badge, Tabs, and Dialog.
2. Shared page structure: typography, toolbar/search, data rows/table, empty states, app shell, rail, and page header.
3. Page compositions: overview first, then users, then entry editor.
4. Modal compositions: create entry, user editing/invitation, confirmation, and explorer dialogs.
5. Fidelity pass against the real dashboard in light and dark themes, including narrow layouts and long content.

The canvas should always show the current token set before component stories so token growth and theme drift remain visible.

## Current status

- Foundations and shared page structure are implemented as isolated design-folder components.
- Overview, users, and entry editor compositions are available on the canvas at their authored widths and heights.
- Light and dark themes, long content, nested muted surfaces, interaction states, and true-size canvas navigation are represented and ready for fidelity work.
- Modal compositions remain the next layer; they should reuse the existing Dialog, Field, Checkbox, Toolbar, Badge, and Button primitives before introducing new tokens.
