# Changelog

## [1.4.0]
- Better support for drafts in Alinea. Drafts can be enabled using the config
  option `enableDrafts: true`. Drafts and archived entries will now show their
  status in the sidebar as well. Workflows are adjusted to be able to create a
  draft entry, including draft children. These will show up as "unpublished" and
  can be published in one go. Further stability improvements were made to 
  updating entry statuses.

## [1.3.1]
- Fix usage of cms.user() in api routes

## [1.3.0]
- Stability improvements.

## [1.2.2]
- Fix use of the readOnly field property which was overwritten from context
- Minor fixes to path field
- Make sure the editor widget doesn't interfere with pointer events of 
  underlying elements

## [1.2.1]
- Added a preview property to TypeConfig to disable the preview on Type level 
  (#407)
- UI tweaks

## [1.2.0]
- Archiving an entry results in archived children entries as well.

## [1.1.2]
- Adjust the inferred results of `cms.find` and `cms.get` so they work reliable
  in non-strict Typescript codebases as well.

## [1.1.1]
- Fix the query result type of `Query.parent`, `Query.next` and `Query.previous`
  which were incorrectly typed as an `Array`.

## [1.1.0]
- Add a copy and paste button to List field blocks
- Update link properties condition and location to be dynamic. The contents
  can be set by using a function.
  
## [1.0.11]
- Fix navigation tree in link picker
- Set the default depth of querying children to 1

## [1.0.10]
- Fix handling mutation retries based on the http status code received.

## [1.0.9]
- Fix skip/take for queries which were not used
- Disable navigation in the internal link picker if a condition is used

## [1.0.8]
- Fix live previews for translated entries

## [1.0.7]
- Fix querying linked entries without locale

## [1.0.6]
- Fix querying linked entries - the requested locale was not passed

## [1.0.5]
- Alinea will now fail if linked entries cannot be resolved during querying.
  Before it would log the error but continue - but this is rarely desired.

## [1.0.4]
- Fix removing field contents in `Edit.update`. Pass an undefined value to remove
  field contents: 

  ````tsx
  await cms.commit(
    Edit.update({
      id: '...',
      set: {removeMe: undefined}
    })
  )
  ````
- Fix processing link data correctly even it contains legacy data

## [1.0.3]
- Only access normalized config in next cms adapter. This fixes an error
  in production builds which would prevent you from querying media files.

## [1.0.2]
- Tweak the withAlinea config function to work in all environments including 
  Next 14.

## [1.0.1]
- Add the Infer.Entry and Infer.ListItem types which can be used to infer the 
  type of an entry or list item from a query.

  ```tsx
  type Entry = Infer.Entry<typeof EntryType>
  const entry: Entry = await cms.get({type: MyType})
  type ListItem = Infer.ListItem<typeof ListType>
  const list: Array<ListItem> = await cms.get({select: MyType.list})
  ````

## [1.0.0]

- Add support for Next.js 15 and Turbopack.
- Removed all previously deprecated options.
- Next.js config changes are now bundled in a `withAlinea` export found in 
  'alinea/next'.
- Querying via `cms.find/get` is rewritten to take a single query object.
  Have a look at the docs to see how to use the new query api.
- Creating custom fields can now be done through `Field.create`.
- Entries now have a single id. If you are upgrading and were using i18n you
  can stabilize your ids by running `npx alinea build --fix`.

## [0.11.2]

- Querying data in a Next.js edge route or middleware will forward the request
  to your CMS handler. This will keep the code size of the edge route to a 
  minimum.

## [0.11.1]

- Fix RichTextEditor.addHtml not parsing marks correctly
- Fix index on entry creation

## [0.11.0]

- The cms handler has been rewritten to handle both backend and previews. This 
  requires updating your handler route. In the case of Next.js you can replace
  both `app/api/cms/[...slug]/route.ts` and `/app/api/preview.ts` with the 
  following:

  ```tsx
  // app/api/cms/route.ts
  import {cms} from '@/cms'
  import {createHandler} from 'alinea/next'

  const handler = createHandler(cms)

  export const GET = handler
  export const POST = handler
  ```

  This release also requires you to restructure your Alinea config file.
  The dashboard property is replaced by the `baseUrl`, `handlerUrl` and 
  `dashboardFile` properties.

  ```tsx
  // cms.tsx

  // Previously:
  const cms = createCMS({
    // ... schema and workspaces
    dashboard: {
      dashboardUrl: '/admin.html',
      handlerUrl: '/api/cms',
      staticFile: 'public/admin.html'
    },
    preview:
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/api/preview'
        : '/api/preview'
  })

  // Becomes:
  const cms = createCMS({
    // ... schema and workspaces
    baseUrl: {
      // Point this to your local frontend
      development: 'http://localhost:3000'
      // If hosting on vercel you can use: process.env.VERCEL_URL
      production: 'http://example.com'
    },
    handlerUrl: '/api/cms',
    dashboardFile: 'admin.html',
    // Optionally supply the public folder with
    publicDir: 'public',
    // Enable previews which are handled via handlerUrl
    preview: true
  })
  ```


## [0.10.1]

- Use buffer-to-base64 to compress store data written to disk
- Improve live previews, fetch data only when needed

## [0.10.0]

- Removed deprecated `createNextCMS` and `createCMS` from the `alinea` package
  root. Instead use the `createCMS` function from `alinea/core` or
  `alinea/next`.

## [0.9.14]

- Avoid importing the 'next' package if we're not using next

## [0.9.13]

- Introduced share previews from metadata fields which are fetched live from the preview iframe window

## [0.9.12]

- Media browser display UI fix
- Media uploads now work correctly when extension is in caps
- Fixed buggy behaviour of rearranging entries
- Preview url generated by the alinea preview widget should now be handled correct

## [0.9.11]

- Minor dashboard layout changes

## [0.9.10]

- Fix the ctrl+s shortkey to publish changes

## [0.9.9]

- Use AND to separate search terms so the order of terms does not matter

## [0.9.8]

- Add support for tables in Rich Text Fields. This can be enabled using the
  `enableTables` option.

## [0.9.7]

- Add `Edit.link` and `Edit.links` to create link values in the Edit api. These
  are currently not optimally typed and will be improved in the future.

  ```tsx
  const imageField = Field.link('Image', {
    fields: {
      alt: Field.text('Alt text')
    }
  })
  const imageValue = Edit.link(imageField)
    .addImage(imageId, {alt: 'An image'})
    .value()
  ```

## [0.9.6]

- Fix double language in urls for entries created through the Edit api

## [0.9.5]

- Entries in the dashboard sidebar can now be ordered by a field value.
  Use the `orderChildrenBy` configuration option to set which field to order by.

  ```tsx
  const Type = Config.type('Type', {
    orderChildrenBy: Query.title.asc() // Order by Entry title
    // ...
  })
  ```

- Add subscript and superscript options to rich text Fields.
- Stop using the porter stemming FTS5 tokenizer in search queries. The algorithm
  does not work well with non-english languages and so is not a good default.
- Fix select box not showing a checkmark in the explorer while replacing file or
  image links.
- Unset validation errors when fields are no longer used.

## [0.9.4]

- Remove 'use server' directive from the Next.js driver because it does not
  contain server actions at all and newer Next.js version will throw an error
  when it is included.

## [0.9.3]

- Fix empty path names resulting in an extra slash at the end of entry urls
  after publish

## [0.9.2]

- Fix inserting blocks in rich text fields causing issues after trying to
  publish

## [0.9.1]

- Fix whereId on Cursor typed as returning a single result but actually
  returning multiple
- Fix inserting blocks in rich text fields

## [0.9.0]

- Reserve Alinea generated properties (#378)

  Until now Alinea generated properties that define the content structure as
  normal identifiers. This means that in a list a row would contain a "type",
  "id" and "index" property while also containing user defined fields. This
  had a lot of potential for name clashes: you could choose to name a field
  "type" for example. It is also not future-proof as Alinea might want to add
  more properties later on. To solve this issue Alinea now reserves all
  properties starting with an underscore as internal. It's not needed to
  upgrade content files manually. The old format will automatically be picked up
  for some time. It's possible to upgrade all files in one go by running the
  following, which will write any changes in content back to disk.

  ```sh
  npx alinea build --fix
  ```

  When querying content please pay mind that those internal properties are now
  accessed by the underscored property and will need to be updated.
  This becomes most apparent in getting results out of the Link field.

  ```tsx
  const MyType = Config.type('MyType', {
    link: Field.link('Link', {
      fields: {
        label: Field.text('Label')
      }
    })
  })
  const result = await cms.get(Query(MyType).select(MyType.link))
  // before:
  //   EntryReference & {label: string}
  //   ^? {id: string, type: string, ..., url: string, label: string}
  // after:
  //   EntryLink<{label: string}>
  //   ^? {_id: string, _type: string, ..., url: string, fields: {label: string}}
  ```

- Use of Type.isContainer is now deprecated, use a list of types in contains
  instead.
- Use of Type.isHidden is now deprecated, use `hidden` instead.

## [0.8.4]

- Fix select field not using field options such as width or required.

## [0.8.3]

- Fix publishing shared fields when the parent paths are not the same.

## [0.8.2]

- Fix entries showing up under the wrong parent if they had a parent with the
  same path name in another root.
- Add the option to remove media folders.

## [0.8.1]

- Export `Entry` from `alinea/core` which was missing in the previous release.
- Fix the `includeSelf` option when querying translations.

## [0.8.0]

- Two changes that impact how to write config files:

  - Bundle configuration function in `Config`, and fields in a `Field` namespace
    which is exported from the `alinea` package (this is optional).
  - Deprecate `alinea.meta` style configuration.
    This change is applied to `Schema` (`types`), `Workspace` (`roots`),
    `Root` (`entries`), `Type` (`fields`), `Document` (`fields`), `Select`
    fields (`options`), `Tab` fields (`fields`).

    To upgrade your config files:

    ```tsx
    // Before
    import alinea from 'alinea'
    const Type = alinea.type('Name', {
      field: alinea.text('Field'),
      [alinea.meta]: {
        contains: ['Page']
      }
    })
    // After
    import {Config, Field} from 'alinea'
    const Type = Config.type('Name', {
      contains: ['Page'],
      fields: {
        field: Field.text('Field')
      }
    })
    ```

- Add the [mutation API](https://alinea.sh/docs/content/editing-content) (#374)

  This introduces a commit method on CMS instances that can be used to mutate
  cms content. It can be used to create, update and delete Entries.

- Add the [Query namespace](https://alinea.sh/docs/content/query)

## [0.7.1]

- Support entries that were seeded in versions prior to 0.6.4 for backward
  compatibility.

## [0.7.0]

- File and image titles can be edited. A focus point can be chosen for images.
- The exports of the alinea package are restructured. Unless you were using the
  now removed named `alinea` exports this should not be a breaking change.
- The `createNextCMS` function is now deprecated and it is recommended to
  import it as `{createCMS} from 'alinea/next'` instead.
- The local database which stores content for editors is now rebuilt on `alinea`
  version changes. This means breaking changes to the schema will not cause
  errors in the browser.
- Upload file names and paths are now slugified correctly.

## [0.6.4]

- Improve page seeding in roots with multiple languages. Seeding content is
  currently undocumented until it reaches a stable interface.

## [0.6.3]

- Add a preview widget which enables editors to easily switch from previewing
  to editing. Enable by setting widget to true:

  ```tsx
  <cms.previews widget />
  ```

- Add a function to retrieve the current logged in user:

  ```tsx
  console.log(await cms.user())
  ```

## [0.6.2]

- Live-reload changes to `.css` files used for custom fields and views.

## [0.6.1]

- Allow importing `.css` and `.module.css` in custom fields and views.
- Make `isContainer` optional if `contains` is used on Types.
- Add i18nId to retrieved entry Link fields when queried.

## [0.6.0]

- Field validation (#369)

  Introduces two new Field options available for every Field: `required` and
  `validate`. The `required` option will make sure the field value is not empty
  when saving. The `validate` option can be used to validate the field value
  using a custom function. The function should return `true` if the value is
  valid, `false` if it is not valid and a string if it is not valid and a
  message should be shown to the user.

  This is a breaking change, removing the `optional` property from Fields.
  It was never functional.

  ```tsx
  alinea.text('Hello field', {
    help: 'This field only accepts "hello" as a value',
    validate(value) {
      if (value !== 'hello') return 'Only "hello" is allowed!'
    }
  })
  ```

## [0.5.12]

- Link fields using the `condition` option are now constrained with their locale
- Upgrade the tiptap editor and fix a few stability issues with the editor

## [0.5.11]

- Fix storing extra `fields` on the Link field correctly for multiple links.
- In conditional configuration functions it's now possible to access fields from
  parent contexts. For example field options of a nested field inside a `List`
  field can depend on the value of a field in the entry root.

  ```tsx
  const innerField = alinea.text('Read-only if status is published')
  const Type = alinea.type('Conditional example', {
    status: alinea.select('Status', {
      draft: 'Draft',
      published: 'Published'
    }),
    list: alinea.list('List', {
      schema: {ListRow: alinea.type({innerField})}
    })
  })
  alinea.track.options(innerField, get => {
    return {readOnly: get(Type.status) === 'published'}
  })
  ```

## [0.5.10]

- Fix `Entry` fields showing up as type `unkown` in TypeScript.
- The `readOnly` option that is included in all fields will now show a lock item
  next to the field label. The option is passed down in nested fields such as
  the `List` and `Rich text` fields.

## [0.5.9]

- Changing entry order by dragging them in the sidebar is now applied
  immediately making changes much smoother.

## [0.5.8]

- Fix navigation missing when selecting internal pages in Link fields.

## [0.5.7]

- The interval at which Alinea polls the backend for content updates is
  now configurable. It can be set in config.syncInterval and overwritten
  per query.

  ```tsx
  // Poll for updates every 60 seconds
  const results = await cms.syncInterval(60).find(Entry())
  // Disable syncing all for this query in case you want results fast,
  // but not necessarily up to date
  const matches = await cms.disableSync().find(Entry().search('fast'))
  ```

## [0.5.6]

- Pages can be queried with search terms.
  Any (rich) text field with the `searchable` option set to `true` is indexed.

  ```tsx
  const results = await cms.find(Page().search('search', 'terms'))
  ```

## [0.5.5]

- A source entry can be chosen in the modal where new entries are created.
  All data from that entry will be copied to the new entry.

## [0.5.4]

- Shared fields (#365)

  Introduce the shared option for Fields. Fields can be persisted over all
  locales if your content is localised by setting the `shared` option to `true`.
  When the entry is published the field data is copied to other locales.
  This is currently only supported on the root level, not on nested fields.

  ```tsx
  const Type = alinea.type('Persist', {
    // Persist field data over all locales
    sharedField: alinea.text('Shared text', {shared: true})
  })
  ```

## [0.5.3]

- Fix number field not reflecting up value changes
- Fix creating new entries not picking up selected parent

## [0.5.2]

- Add an edit button to Link field rows.
- Fix extra fields defined on Link fields not saving data.

## [0.5.1]

- Preview panel was missing in production deploys.

## [0.5.0]

- Conditional configuration (#364)

  All field configuration can be adjusted based on the value of other fields.
  After defining fields in a Type a tracker function can be set up.
  The tracker function takes a reference to a field and a subscription function.
  In the subscription function field values can be retrieved and new options
  returned.

  ```tsx
  const Example = alinea.type('Conditional example', {
    textField: alinea.text('Text field'),
    readOnly: alinea.check('Make read-only'),
    hidden: alinea.check('Hide field')
  })

  alinea.track.options(Example.textField, get => {
    const textField = get(Example.textField)
    const readOnly = get(Example.readOnly)
    const hidden = get(Example.hidden)
    return {
      readOnly,
      hidden,
      help: `Text has ${textField.length} characters`
    }
  })
  ```

## [0.4.3]

- The description field for external links is renamed to "title".
- Heading h4 and h5 are available in the Rich Text field.
- Folder icon in the nav tree has been moved to the right allowing containers
  to have a custom icon as well.

## [0.4.2]

- Reduce circular dependencies within the alinea/core package. This would
  previously result in "Cannot read properties of undefined (reading Scalar)" or
  similar when implementing custom fields.
  Thanks to https://github.com/antoine-coulon/skott

## [0.4.1]

- A type check before creating new entries was incorrect making it impossible
  create new entries on the root level.

## [0.4.0]

- This release contains a major rewrite. Read the blog post for more information.

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
