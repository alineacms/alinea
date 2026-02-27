# Dashboard V2 Rewrite Plan

Find the v2 dashboard in src/v2

## Goals and Constraints
- UI toolkit: use `@alinea/components` as the default UI surface.
  It is a theme of react-aria-components, docs are here: https://react-aria.adobe.com/llms.txt
- Core integration: keep using `alinea/core` for config/schema/db/query/policy primitives.
- Field rendering: do not reuse existing dashboard field views; build new v2 field views wired to `@alinea/components`.
- Styling: use CSS Modules plus `@alinea/styler`.

## Code style
- Prefer interface over type
- Use function instead of arrow functions for components and hooks
- Always name props interfaces with a `Props` suffix