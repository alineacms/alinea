# Changelog

## [Unreleased]

- Added the step property to the number fields. It specifies the interval
  between legal numbers in the input field. Default is 1.

## [0.3.2]

- Fixed the TypeScript type of the Select input (#282)
- Moved the `Preview` and `BrowserPreview` exports from the `alinea` package
  to `@alinea/preview`. This should help import the alinea config within in
  restrictive environments such as Next 13 which will throw a compile error if
  any browser code is imported. This will likely be tweaked in future releases.

## [0.3.1]

- Fix the `@alinea/preview/remix` preview hook

## [0.3.0]

- Generate types (#271)

  Up until now the TypeScript definitions that were available for the content
  schema were fully inferred using the TypeScript compiler. While this had some
  advantages it also came with stability issues and overall did not prove to be
  the best solution. TypeScript definitions are now generated from the schema at
  build time. The runtime type information should prove useful for the upcoming
  GraphQL support as well. Since GrapQL does not come with namespacing we've
  introduced a few breaking changes:

  - The config file now supports a single schema at the root level, meaning
    the schema is used for every workspace.
  - The generated package structure in turn became simpler because the workspace
    distinction is no longer needed:

    ```ts
    // Init pages now available from /pages
    import {initPages} from '@alinea/generated/pages'

    // The Page type describes every content type of the schema
    // type Page = Page.TypeA | Page.TypeB
    import {Page} from '@alinea/generated'
    ```

- Remix run support (#273)

  A few changes were necessary to get started with Remix. These changes should
  make it easier to work with other frameworks as well.

  - An example starter was added
  - The local backend connects to the `serve` instance if it is running. Since
    Remix does not watch file changes in node modules this should make sure
    you're always viewing the latest changes.
  - Export pages/backend as CJS (#270)

## [0.2.14]

- The dashboard router was not picking up wildcard routes, which resulted in
  non-working links (#265)
- Bundle yjs instead of requiring it as a dependency.
- Re-use the esbuild watcher in order to remove the chokidar dependency.

## [0.2.13]

- Improved stability of the `serve` and `generate` commands by avoiding race
  conditions while publishing
- Removed react-router dependency

## [0.2.12]

- Public env variables may be used in alinea.config. Currently supported are
  variables with a key prefix of either `NEXT_PUBLIC_`, `PUBLIC_`, `VITE_`
  or `GATSBY_`.

## [0.2.11]

- The workaround released in 0.2.10 was not stable. Node modules ended up being
  bundled in the generated Javascript.

## [0.2.10]

- Workaround [evanw/esbuild#2460](https://github.com/evanw/esbuild/issues/2460).
  Newer esbuild versions support the new "automatic" react jsx feature. This can
  be enabled from the build options, but also overwritten in tsconfig.json.
  Alinea depends on this feature but had problems generating correct output
  when the tsconfig has another jsx setting.
  Previously the workaround was supplying a blank tsconfig file.
  However other directives such as paths that the user might supply in their own
  tsconfig were ignored. With this change alinea will write out a
  tsconfig.alinea.json that extends the user supplied tsconfig.json
  and overrides the jsx property.

## [0.2.9]

- The `alinea serve` command will apply publish actions directly to the memory
  store instead of relying on the file watcher. This should result in better
  performance.

## [0.2.8]

- Fix rich text undo/redo [yjs/y-prosemirror#114](https://github.com/yjs/y-prosemirror/issues/114)

## [0.2.7]

- UI tweaks

## [0.2.6]

- Fix the `Pages.whereRoot` method which did not use the new `alinea.root`
  location

## [0.2.5]

- Add a `--fix` option to the generate command, which will write back any
  missing or incorrect properties to disk.

## [0.2.4]

- The previous release was missing the generated css file in the `@alinea/css`
  package. Build outputs are now cached in the ci step using wireit but this
  file was not included.

## [0.2.3]

- The `url` property of entries can now be controlled using the `entryUrl`
  function in the type options. Urls are computed during generation and this can
  help to keep them constant if you're using a web framework that does file
  system routing. The available paramters are `path`, `parentPaths` and
  `locale`.
  For example: making sure a doc page always has an url in
  the form of `/doc/$path` you can specify `entryUrl` as the following:

  ```tsx
  type('Doc', {...fields}).configure({
    entryUrl({path}) {
      return `/doc/${path}`
    }
  })
  ```

- The iframe used in the `BrowserPreview` component now supports top level
  navigation so it becomes possible to link the user to a cms route from within.
  (#246)

- The index of newly created entries will be based on the first child of parent.
  This makes them consistently sortable when published. (#241)

## [0.2.2]

- Alinea cloud handshake now automatically includes git information when hosted
  on Vercel, to allow for a prefilled project setup

## [0.2.1]

- Alinea cloud connection now sends the shortKey part of API key during
  authentication to uniquely identify project

## [0.2.0]

- The exports of the alinea package are restructured. This is a breaking change
  because the input fields are no longer exposed directly but bundled in the
  "alinea" namespace. A few less used exports were removed and can be
  found in the @alinea packages.
- Client code is shielded from being included server side when compiling with
  the "worker" condition enabled.
- Initial support for selecting external links in the link field. The RichText
  ui component is adjusted to correctly render links. A custom component or tag
  can be passed to render links.

  ```tsx
  <RichText a={<a className="custom-link" />} doc={doc} />
  <RichText a={CustomLinkComponent} doc={doc} />
  ```

## [0.1.19]

- Added a new field type for raw json data

## [0.1.18]

- Minor fix in the handshake procedure between Alinea and Alinea cloud

## [0.1.17]

- The alinea serve command will try another port if the chosen port is in use
  (#179)
- Avoid duplicate entries after publishing in the development server (#214)
- The generated types for pages depended on a type that would be namespaced
  when using `typeNamespace`. It did not take the namespace into account, but
  does now.
- The connection with Alinea Cloud should now handle previewing drafts
  correctly.

## [0.1.16]

- Alinea Cloud can now handle relative urls & authentication is automatically
  redirected.

## [0.1.15]

- The alinea cli will now forward commands placed after the serve or generate
  commands. It will wait until the alinea package is generated before doing so
  to make sure userland code can always depend on the package being available.
  It also simplifies running the dashboard and development server without
  requiring tools like npm-run-all. In practice, for a next.js website, this
  means one can configure scripts like so:

  ```js
  {
    "scripts": {
      "dev": "alinea serve -- next dev",
      "build": "alinea generate -- next build"
    }
  }
  ```

## [0.1.14]

- Fix missing dependencies in the dashboard package

## [0.1.13]

- Added a button to mark text as small within the rich text editor
- New UI buttons to insert rows in any position in a list field
- User preferences get a dedicated popover
- Previews can register a listener and implement their own refetch mechanism.
  The communication happens via messages which work cross-origin.

  ```ts
  // For any environment
  import {registerPreview} from 'alinea/preview'
  registerPreview({
    refetch() {
      // Reload server data
    }
  })
  ```

  ```ts
  // A react hook is available
  import {usePreview} from 'alinea/preview/react'
  const {isPreviewing} = usePreview({
    refetch() {
      // Reload server data & redraw
    }
  })
  ```

  ```ts
  // A hook specifically for next.js, which refetches static/server props
  import {useNextPreview} from 'alinea/preview/next'
  const {isPreviewing} = useNextPreview()
  ```

## [0.1.12]

- Previous release contained a few debug logs which are removed.
- Hard breaks (shift + enter) will be rendered as break in the RichText
  component.

## [0.1.11]

- Tested and fixed the integration with Alinea Cloud for drafts and publishing
  content.

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

- The alinea package now exports an `alinea` object that bundles the previously
  exported config functions.
- Vendor in selected dependencies (#175). Selected dependencies will be compiled
  and packaged with the alinea packages. This reduces install size and amount of
  dependencies which would typically not be shared with any userland code.
- Added a hidden option to fields, which hides the field in the dashboard UI
  (#169)

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
- Add an initial implementation of a date field (@alinea/input/date).
  It currently uses the native browser input which represents dates as ISO8601.
- The number field had an update to make it functional again.
