# Changelog

## [2.0.0]
- Rebuild the dashboard on React Aria Components, with keyboard navigation,
  focus management and screen reader support throughout, a new theme with dark
  mode, a responsive layout, entry history and a references panel that shows
  which entries link to the current one. The entry sidebar starts closed for
  entries without a preview.
- Add `alinea/components`, the public component library the dashboard is built
  from, to build custom fields and views. It includes `Stack`, `Form` (field
  errors from native constraints, `validationErrors` or what `onSubmit`
  returns) and `useAsyncList` to load items page by page or as you type.
  `DialogContent` submits a form with `onSubmit`, `Dialog` has `onClose`,
  `Table` has `loading` and `onLoadMore`, `ComboBox` has groups, item
  descriptions and icons, `filter` and `loading`, and `TextField` has
  `maxRows`, `inputMode` and `pattern`. Collection keys are strings or numbers.
  Dashboard icons are available from `alinea/dashboard/icons`.
- The theme tokens and resets of `alinea/css` apply inside elements with
  `data-alinea-theme`, which the dashboard sets on `<html>`, so the stylesheet
  can be loaded on a site without restyling it. The workspace color is
  `--alinea-workspace-color`.
- Add `alinea/cms` for custom fields and views: field hooks that read and
  write the fields of the row, a parent row or the entry when passed that
  field, `useEntry()` returning a `DashboardEntry`, `useNavigate` and `useHref`
  to open entries by id, `EditField` and `EditFields` (also for the fields of
  an object field), `FieldChrome` and `EntryTable`. The entry editor sets
  `--alinea-header-height`. `useSiblingFieldValue` and the `useField` hooks of
  `alinea/dashboard` are deprecated, the `useEntryEditor` shim reads the
  publish status from `activeVersion.status`.
- Add `Field.localiser` to keep every locale of a value in a single field, with
  fallbacks.
- Add the `overview` option to container types and roots to configure how the
  dashboard lists their children: columns (`Config.column`) with per-type
  selects, formatting and custom cells, built-in type, status, updated and
  author columns, sorting by column header (kept in the URL), the default
  `sort`, `layout`, card `thumbnail` and toolbar `actions`. Filters can load
  their options from the content with a function that receives the `graph`
  and `locale`. The media library lists previews, dimensions, sizes and file
  types. `EntryTable` in `alinea/cms` renders the same columns in custom
  views. `overview.sort` replaces `orderChildrenBy`, `summaryRow` and
  `summaryThumb` are deprecated and the `overview` field option only applies
  when the parent defines no columns.
- Add the `actions` type option: components in the entry header, next to the
  publish button.
- Add the `settings` type option: fields edited in the settings sheet of a
  list row or rich text block, below its label and anchor. Entries of the type
  show them in a Settings tab. They are stored and queried like other fields.
- The `collapsed: false` type option expands an entry's children in the
  sidebar content tree from the start.
- Add `width` to the options of every field, and fix `Field.create` typing
  for options that extend `FieldOptions`.
- Query the entries that link to an entry with `Query.referencedBy`, eg.
  `select: {products: Query.referencedBy({type: Product, field: Product.brand})}`,
  count them with `count: true` (overview columns that count are sortable) and
  filter on them: `filter: {_referenced: Query.referencedBy({type: Product,
  filter: {active: true}})}`.
- Select fields inside object fields in queries, such as
  `select: {title: Page.seo.title}`, also in relations like `Query.children`
  and in `orderBy`.
- Bundle a SQLite content database with full text fuzzy search. Search matches
  the hyphenated, spaced and joined spellings of a word: `multi-modal`,
  `multi modal` and `multimodal` all find each other. Date and number fields are
  indexed per type that has them, which keeps these indexes small.
- Record URL aliases in the metadata field when an entry's URL changes, and
  resolve them in queries (`alias` filter, `Query.aliases`). The metadata field
  also stores `createdAt`, `createdBy`, `updatedAt` and `updatedBy`.
- Roles combine per role: a deny only applies within the role that sets it, so
  another role of the same user can still allow the action. Before, a deny in
  any role blocked it for the user.
- Enforce the `explore` permission: link and image pickers list the entries a
  role can explore, without opening them in the dashboard. Allowing `read`
  allows `explore`, denying `read` denies it unless `explore` is allowed.
- Target fields inside object fields in role permissions, such as
  `{field: Article.visibility.germany, deny: {all: true}}`.
- Add `beforeCommit` and `afterCommit` handler hooks to rewrite changes before
  they are committed, or to revalidate, notify and deploy after. Both receive
  the `user` that commits, `afterCommit` also the committed `entries` and the
  `removed` entries with the url they had. `alinea dev --role <name>` signs in
  the local user with that role, for saves, hooks and `cms.user()`.
- Publish instantly: deployed sites sync new content as soon as it is committed,
  driven by the repository sha. `syncInterval` is now a fallback, defaulting to
  60 seconds.
- Add an MCP server to `alinea dev` (`http://localhost:4500/mcp`) so coding
  agents can read the schema and create, edit, publish, move and delete entries
  and upload media through the dashboard's save path.
- Add the `adminPath`, `maxUploadSize` and `tracer` config options, and a
  workspace `mediaUrl` option.
- Add `Field.select.multiple`, `min` and `max` for lists, images and link
  options in rich text, rich text anchors, link anchors and suffixes, and
  `allowDuplicates` for links.
- Add a composable backend in `alinea/backend` (`createBackend`, `auth`,
  `database`, `github`, `uploads`) with S3 and Supabase uploads and user
  management.
- Require Node.js 24 or higher and React 19.
- Require `handlerUrl` in the config, and a production `baseUrl` unless
  `handlerUrl` is absolute: server renders reach the handler through it.
  `dashboardFile` is deprecated in favor of `adminPath`.
- Serve media files through `${adminPath}/file/...` on the site: image and file
  links now return that URL instead of the stored location. Image links only
  have `src`, their `url` property is removed. `alinea build` warns about
  media files with a url as location and `alinea build --fix` repairs them.
- Change `Config.media()` to take root options, children move to `children`.
- Remove the options of `Field.metadata()` and the `step` option of
  `Field.time()`.
- Move the rich text editor to Tiptap 3. `extensions` is now a function that
  receives the default extensions, `defaultToolbar` takes an options object.
- Change `Edit.move` to `{id, target, dropPosition}`.
- Remove the `remote` handler option and the unused entry hooks. OAuth2 backends
  require `validateClaims`. Drafts are no longer stored in the database.
- Remove the components from `alinea/ui` except `RichText`, and the form atoms
  from `alinea/dashboard`.
- Fix read-only roles for nested fields and upload permissions in nested media
  folders.
- Fix the locale of translations created in another root.
- Fix bundled content being served stale right after a cold start.
- Verify signed Alinea Cloud handshake requests and pin preview messages to the
  dashboard origin.
- Fix rich text parsing of marks around images and keep `data-` attributes on
  rich text nodes.
- Fix `alinea build` keeping a config watcher alive while the forwarded command
  runs, and a live preview refreshing twice in React strict mode.

## [1.7.0]
- Add user roles and permission policies. Permissions can now be scoped by
  workspace, root, type, field, entry id and locale, and cover actions such as
  create, read, update, delete, reorder, move, publish, archive, upload and
  explore. The dashboard and backend now enforce these policies.
- Add configurable rich text toolbars and custom Tiptap extension support.
- Improve the Next.js integration. `withAlinea` now uses the CLI-provided admin
  path, proxies the dashboard in development, rewrites to the generated
  dashboard in production and supports custom `dashboardFile` values.
- Allow `baseUrl` to be configured per environment.
- Add workspace and root information to `EntryUrlMeta`.
- Return CORS headers for local uploads.
- Improve OAuth and JWT handling with explicit SameSite cookies, access-token
  refresh without treating refresh tokens as JWTs, stricter JWKS key selection
  and optional extra claim validation.
- Fix rich text HTML parsing so marks are applied across nested content and
  root-level whitespace is ignored.
- Filter unresolved entry links from multi-link query results.
- Add `llms-full.txt` to the published package.

## [1.6.4]
- Don't use Y.js for preview deltas, but a more predictable diff

## [1.6.3]
- Fix link order in rich text fields

## [1.6.2]
- Fix search results turning up empty
- Show children indicator in tree even if all children are untranslated

## [1.6.1]
- Previous release mistakenly included features that were not ready for release.

## [1.6.0]
- Refactor how we build the internal index of all entries. This is now done 
  immutably so that any problems during mutations to entries do not corrupt the
  index.

## [1.5.4]
- Add more richtext table options (mergeCells, splitCell, toggleHeaderCell and
  toggleHeaderColumn)

## [1.5.3]
- Fix Query.next and Query.previous which were not sorted correctly
 
## [1.5.2]
- Set access token at the root so `cms.user()` calls work in preview environments

## [1.5.1]
- Prefix upload locations with media dir for self-hosted backends
- Handle logout endpoint for OAuth backends

## [1.5.0]
- Handle authentication with Alinea Cloud using OAuth 2.0
- Enable ctrl and middle mouse clicks in the entry tree to open in new tab
- Use a shared EventSource in dev mode to avoid the browser maximum of 
  6 connections per origin
- Check workspace and root properties during entry creation

## [1.4.9]
- Fix: handle missing blobs in local IndexedDB store

## [1.4.8]
- Fix: data coming from Alinea Cloud was not handled correctly 

## [1.4.7]
- Fix: previous release was published with extraneous dependencies

## [1.4.6]
- Disabled arrow up/down when on first/last row in lists (#450)
- Keep copy icon visible during drag state; disable icons while dragging (#451)
- SelectField: responsive layout improvements (#448)
- ImageView: show cursor crosshair (#449)
- Collapsible list rows (#444)
- IconButton: focus layout change (#447)
- TextField: added placeholder support (#442) and type email, tel, text, or url (#445)
- Remove web workspace; move website to alineacms/alineacms.com

## [1.4.5]
- Fix: don't bundle contents in edge functions
- Fix: order results of Query.parents by level
- Fix: respect parent insert order on create
- Fix: internal links to image and file entries from the link preview

## [1.4.4]
- Fix: publishing changes to file details no longer removes the associated file
- Fix: don't use transparency in averageColor property for images

## [1.4.3]
- The previous release mistakenly added `next` as a direct dependency to the
  `alinea` package. While we're currently focused on providing a clean Next.js
  integration, Alinea is not tied to Next.js and should not depend on it.

## [1.4.2]
- Using the `alinea init` command for a Next.js website will now auto-create
  the handler route in `app/(alinea)/api/cms/route.ts`. The generated `cms.ts`
  config file also includes more default options such as the `baseUrl` and
  `handlerUrl`.

## [1.4.1]
- Restore drag-drop behavior in entry tree. The drag and drop functionality
  was broken in the previous release due to a change in the way entries are
  rendered in the sidebar.

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
