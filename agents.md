# Dashboard Development Notes

The dashboard lives in ./src/dashboard.

## Goals and Constraints
  It is a theme of react-aria-components, docs are here: https://react-aria.adobe.com/llms.txt
- Core integration: keep using `alinea/core` for config/schema/db/query/policy primitives.
- Field rendering: build dashboard field views wired to `src/components`. Do not use Y.js for field state management, but instead use Jotai atoms.
- Styling: use CSS Modules plus `@alinea/styler`.
- Styling ownership: each component should use its own CSS Module file. Do not import another component's CSS Module into a different component.
- Do not export CSS module styler instances or style objects from component modules. Expose named wrapper components for shared layout/styling instead.
- Use `@alinea/styler` for composing and joining class names. Do not introduce custom class name join helpers for this.
- CSS module naming in `src/dashboard`: every selector starts with the exact component name, eg `.ComponentName`; replace `.root` with that component name; nested selectors become `.ComponentName-part`, deeper nesting becomes `.ComponentName-part-subpart`; flatten unused parent segments.
- Do not style child elements with tag selectors such as `> span`, `> p`, or `> li`. Always add and target a named CSS module class instead.
- Use the current dashboard CSS variables; do not bring back variables from the previous dashboard implementation.
- CSS variables should use simple names prefixed with `--alinea-`
- Bundle all icons into the same file src/dashboard/icons.tsx, download them if needed
  from icones (https://icones.js.org/) using the Google Material Icons set.

## Code style
- Prefer interface over type
- Use function instead of arrow functions when defining React components
- Always name props interfaces with a `Props` suffix
- Do not use the `any` type, unless communicated explicitly in the code review
- Reuse shared generic utilities before adding local copies; in particular, use `isRecord` from `alinea/core/util/Objects` instead of defining another local record guard.
- Imports should be relative if in same src subdir, otherwise absolute starting
  with 'alinea', eg 'alinea/core/Config'. If relative, include .js extension.
  If absolute do not include any extension.

## Verify
- `bun test` and `bun lint` are available
