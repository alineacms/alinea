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
- Use JavaScript `#private` class fields instead of TypeScript's `private` modifier.
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
- Read atoms made with `unwrap` (including `atomWithPending`) with
  `useAtomValueRawSync`. Their first read returns the fallback and they update
  once the promise settles, which `useAtomValueRaw` misses when that happens
  before its effect subscribes. Use `useAtomValueRaw` for other atoms so their
  updates keep rendering concurrently.

## Public components (`alinea/components`)
Components exported from `src/components.ts` are a long-term public API that
must not expose react-aria. `bun run build` fails when a public declaration
file reaches `react-aria-components`, `react-aria`, `react-stately`,
`@react-types/*` or `@internationalized/*`.
- Implement with react-aria internally, but write every exported props
  interface by hand from `src/components/types.ts` (`StyleProps`, `AriaProps`,
  `DataProps`, `OpenStateProps`, `PositionProps`, `SelectionProps`,
  `FieldSharedProps`, ...). Never `extends` a react-aria type, never re-export
  one, no render-prop `className`/`children` functions.
- Follow shadcn/ui and Radix naming unless impractical: compound parts named
  `ThingTrigger`, `ThingContent`, `ThingItem`, `ThingHeader`, ...; props
  `open`/`defaultOpen`/`onOpenChange`, `value`/`defaultValue`/`onValueChange`,
  `checked`/`onCheckedChange`, `pressed`/`onPressedChange`, `disabled`,
  `required`, `readOnly`, `side`/`align`/`sideOffset`, `asChild`,
  `onSelect` for menu items, `onClick` for buttons, `variant`/`size`.
- Form controls extend `FieldSharedProps` (`label`, `description`, `error`,
  `required`, `disabled`, `readOnly`, `icon`, `shared`) and render their
  chrome with `Field` from `./Field.js`.
- Dates and times are ISO strings (`2026-09-23`, `14:30`), keys are
  `string | number`, selections use `Selection`.
- Every rendered part sets `data-slot="thing-part"`; variants are exposed as
  `data-variant`/`data-size`/`data-color`. Style interaction state with native
  pseudo-classes and ARIA attributes (`:hover`, `:focus-visible`,
  `:disabled`, `[aria-expanded]`, `[aria-checked]`, `[aria-selected]`), not
  react-aria's `data-*` state attributes, so the implementation can change.
- Keep CSS custom properties to a minimum: use the global semantic tokens
  from `src/theme.css` and derive hover/disabled/subtle shades with
  `color-mix()` and opacity (disabled is `opacity: 0.5`) instead of defining
  per-state variables.
- Helpers that are only for our own components live in
  `src/components/internal/` and are not exported. Dashboard and field code
  may use react-aria directly where the public API cannot express something.
- Finished components get a Ladle story under `title: 'Pure components / X'`
  and a Playwright spec (`X.spec.tsx`) mounting those stories.
