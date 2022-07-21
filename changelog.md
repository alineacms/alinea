# Changelog

## [Unreleased]

- Tested and fixed the integration with Alinea Cloud for drafts and publishing content.

## [0.1.10]

- Avoid errors during the serve command that would stop the process with
  "memory access out of bounds".
- Detect if we're serving a preview cross origin and cannot use the iframe's
  history. If so we adjust the UI to hide the back/forward buttons and change
  the reload button to refresh the iframe source instead of a history reload.

## [0.1.9]

- Log errors during CLI builds
- Use a more stable local drafts implementation

## [0.1.8]

- Add the MIT license
- Use internal router, removing the Express.js dependency for the CLI, reducing
  the overall install size

## [0.1.7]

- Backend can be compiled to a static html file, using the dashboard.staticFile
  config setting
- For uploaded images the correct width and height is saved in metadata

## [0.1.6]

- Externalized backend implementation packages.

## [0.1.5]

- The alinea package now export an `alinea` object that bundles the previously
  exported config functions.
- Vendor in selected dependencies (#175). Selected dependencies will be compiled
  and packaged with the alinea packages. This reduces install size and amount of
  dependencies which would typically not be shared with any userland code.
- Added a hidden option to fields, which hides the field in the dashboard UI (#169)

## [0.1.4]

- Replace CJS dependencies to pure ESM (#161)
- Added blockquote option to the rich text field

## [0.1.3]

- The drafts of the default development backend are now placed with the
  generated code which means draft changes will result in browser reloads.

## [0.1.2]

- A RichText react component is exposed from @alinea/ui to render rich text
  values
- Auto-close navigation sidebar only for small screens (< 768px)
- Update number field styles to use updated css variable names
- Select fields configuration can now be set using the `configure` method. This
  helps type inference for the initial value.

  ```ts
  select('Level', {
    info: 'Info',
    warning: 'Warning'
  }).configure({
    initialValue: 'info'
  })
  ```

## [0.1.1]

- Fix subtle crypto import for node versions that ship it natively (> v15)

## [0.1.0]

- The backend implementation now uses the web fetch api instead of relying on
  express. This maximises compatibility with existing Javascript runtimes that
  are not node based (service worker, Cloudflare workers, deno, bun.js).
  Actually deploying the backend to platforms other than node has not been
  tested yet and might require a few additional changes. The fetch api is
  polyfilled for node using @remix-run/web-fetch. Eventually node will support
  this natively.
- Add an initial implementation of a date field (@alinea/input.date).
  It currently uses the native browser input which represents dates as ISO8601.
- The number field had an update to make it functional again.
