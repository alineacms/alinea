# Dashboard V2 Rewrite Plan

## Goals and Constraints
- UI toolkit: use `@alinea/components` as the default UI surface.
- Core integration: keep using `alinea/core` for config/schema/db/query/policy primitives.
- Field rendering: do not reuse existing dashboard field views; build new v2 field views wired to `@alinea/components`.
- Styling: use CSS Modules plus `@alinea/styler`.
