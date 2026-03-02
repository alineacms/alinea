# Dashboard V2 Rewrite Plan

Find the v2 dashboard in src/v2, and v1 in src/dashboard.

## Goals and Constraints
- UI toolkit: use `@alinea/components` as the default UI surface.
  It is a theme of react-aria-components, docs are here: https://react-aria.adobe.com/llms.txt
- Core integration: keep using `alinea/core` for config/schema/db/query/policy primitives.
- Field rendering: do not reuse existing dashboard field views; build new v2 field views wired to `@alinea/components`.
- Styling: use CSS Modules plus `@alinea/styler`.
- Bundle all icons into the same file src/v2/icons.tsx, download them if needed
  from icones (https://icones.js.org/) using the Google Material Icons set.

## Code style
- Prefer interface over type
- Use function instead of arrow functions for components and hooks, but anonymous ok for atoms
- Always name props interfaces with a `Props` suffix
- Do not use any type, unless communicated explicitly in the code review
- Imports should be relative if in same src subdir, otherwise absolute starting
  with 'alinea', eg 'alinea/core/Config'. If relative, include .js extension.
  If absolute do not include any extension.

## Testability
- Use react-testing-library for testing, and test the public API of components
- Dom implementation is preloaded
- Create a test file for each component, named `ComponentName.test.tsx`
- Use `bun test` for running tests
- If a component is very complex and a browser environment is needed use 
  `@playwright/experimental-ct-react` and name the test file `ComponentName.spec.tsx`