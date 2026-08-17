# CSS
- Use CSS Modules plus `@alinea/styler`.
- Styling ownership: each component should use its own CSS Module file. 
- Do not import another component's CSS Module into a different component.
- Do not export CSS module styler instances or style objects from component modules. 
  Expose named wrapper components for shared layout/styling instead.
- Use `@alinea/styler` for composing and joining class names. Do not introduce custom class name join helpers for this.
- CSS module naming in `src/dashboard`: every selector starts with the exact component name, eg `.ComponentName`; replace `.root` with that component name; nested selectors become `.ComponentName-part`, deeper nesting becomes `.ComponentName-part-subpart`; flatten unused parent segments.
- Do not style child elements with tag selectors such as `> span`, `> p`, or `> li`. 
  Always add and target a named CSS module class instead.
- CSS variables should use simple names prefixed with `--alinea-`
- Bundle all icons into the same file src/dashboard/icons.tsx, download them if needed
  from icones (https://icones.js.org/) using the Google Material Icons set.

## Code style
- Prefer interface over type
- Use function instead of arrow functions when defining React components
- Always name props interfaces with a `Props` suffix
- Do not use the `any` type, unless communicated explicitly in the code review
- Reuse shared generic utilities before adding local copies; in particular, 
  use `isRecord` from `#/core/util/Objects.js` instead of defining another local record guard.
- Imports should be relative if in same src subdir, otherwise absolute starting
  with '#/', eg '#/core/Config.js'. Include .js extension.
- When finished run `bun format`

## Verify
- `bun test` and `bun lint` are available
- `bun spec` runs a playwright test suite

## Atoms
- Use Jotai atoms for dashboard state and derive state by reading dependencies
  with `get`. Use memoized atom families for state scoped to an identity such as
  an entry id.
- Prefer exposing inline atoms and atom families over forwarding methods or
  single-use helpers. For example, define `treeReady = dispense(...)` directly
  instead of forwarding through a private `treeReadyAtoms` family.
- Async page atoms are the loading boundary for navigation and view-state changes.
  They must await exactly the data required by the UI state that is about to be
  shown before returning the next page.
- Keep the currently rendered page static while its replacement is loading, then
  swap to the fully ready page. Do not initiate required data loads from newly
  mounted view components, or show loaders and temporary empty states during the
  swap.
- Store view state that determines required data (for example selected tabs and
  expanded disclosures) in atoms so the page atom can include those dependencies.
- Separate requested state from ready state: views write requested state, the page
  atom loads its dependencies, and the resolved page passes ready state down as
  synchronous props or already-loaded atoms. Views render that ready state until
  the replacement page is complete.
- `unwrap` may preserve already-loaded atom data during recomputation, but do not
  rely on mounting a component that reads an unwrapped atom to begin a required
  load.
