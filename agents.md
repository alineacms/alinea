# Dashboard V2 Rewrite Plan

Find the v2 dashboard in ./src/dashboard, and v1 in ./v1/dashboard.

## Goals and Constraints
- UI toolkit: use `@alinea/components` as the default UI surface.
  It is a theme of react-aria-components, docs are here: https://react-aria.adobe.com/llms.txt
- Core integration: keep using `alinea/core` for config/schema/db/query/policy primitives.
- Field rendering: do not reuse existing dashboard field views; build new v2 field views wired to `@alinea/components`. Do not use Y.js for field state management, but instead use Jotai atoms.
- Styling: use CSS Modules plus `@alinea/styler`.
- Styling ownership: each component should use its own CSS Module file. Do not import another component's CSS Module into a different component.
- Do not export CSS module styler instances or style objects from component modules. Expose named wrapper components for shared layout/styling instead.
- Use `@alinea/styler` for composing and joining class names. Do not introduce custom class name join helpers for this.
- CSS module naming in `src/dashboard`: every selector starts with the exact component name, eg `.ComponentName`; replace `.root` with that component name; nested selectors become `.ComponentName-part`, deeper nesting becomes `.ComponentName-part-subpart`; flatten unused parent segments.
- CSS variable names from v1 will not work in v2
- Bundle all icons into the same file src/dashboard/icons.tsx, download them if needed
  from icones (https://icones.js.org/) using the Google Material Icons set.

## Code style
- Prefer interface over type
- Use function instead of arrow functions when defining React components
- Always name props interfaces with a `Props` suffix
- Do not use the `any` type, unless communicated explicitly in the code review
- Imports should be relative if in same src subdir, otherwise absolute starting
  with 'alinea', eg 'alinea/core/Config'. If relative, include .js extension.
  If absolute do not include any extension.

## Verification
- Run typescript compiler with `bun tsgo` to verify types

## Testability
- Use react-testing-library for testing, and test the public API of components
- Dom implementation is preloaded
- Create a test file for each component, named `ComponentName.test.tsx`
- Use `bun test` for running tests
- Do not mock `@alinea/components` in tests; test using the real components.
- Do not add runtime-only TipTap options such as `immediatelyRender: false` just to silence warnings that only happen under tests.
- If a component is very complex and a browser environment is needed use 
  `@playwright/experimental-ct-react` and name the test file `ComponentName.spec.tsx`


## Known todos
- Link view: pick external links + distinction of files/images/entries
- Link picker in RichTextField
- Path field: slugify, mask and unique validation
