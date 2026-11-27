# Changelog

## [Unreleased]

### Upgrading

- Visitors upload the files of form file inputs to the handler with `PUT`
  requests. Add `export const PUT = handler` next to `GET` and `POST` in the
  route of `createHandler`, eg. `app/(alinea)/api/cms/route.ts`: routes made
  before only export those two and refuse the uploads. Export
  `OPTIONS = handler` as well: browsers ask before they upload to the
  `baseUrl` of your config from another address, eg. `www.` or a preview
  deployment, and Next.js answers that itself without allowing it. A file
  that could not be uploaded shows an error under its input in the language
  of the form, and the console of the browser tells why.
- The help texts of form inputs and the descriptions of sections are rich
  text, so they can include links. In a form definition `help` is a `TextDoc`,
  render it with `RichText`. Help saved as plain text reads as paragraphs.
- A check has a rich text shown next to its checkbox, eg. with a link to your
  terms, in `settings.text` of the definition. Its label still names the
  answer in submissions and mails, and shows when there is no text.
- `forms.limits` of `createHandler`, the rate limits of forms, is renamed
  `forms.rateLimit`, and its type `FormLimits` is `FormRateLimit`. The fields
  of `Form.limits()` keep their name.
- An entry holds one form: a type with more than one `Field.form` is a config
  error, and the `field` option of `cms.forms.submit`, `prepareUpload` and
  `status` is removed. Keep submissions and Maximum submissions are read from
  the fields made with `Form.keep()` and `Form.limits()` only, under any key,
  not from other fields named `keep` or `limit`.
- A type in the accepted files of a file input, eg. `image/*`, is matched by
  the extension of the file name instead of the type the browser declares,
  and files are kept and attached to mails with the type of their extension.
- A site that does not pass a `locale` to `cms.forms.submit` gets the form of
  the default locale of the root, and the page a form goes to after sending
  is the one in the language of the form.
- Custom stores of submissions: `storeSubmission` takes the answers to unique
  inputs as `unique` and returns the keys of those sent before, storing
  nothing then. `recentActivity` takes the kind, `submissions` or `files`,
  and returns the count of the form and of the visitor, and `attachFormFiles`
  returns the ids it attached.

### New

- `cms.forms.submit` takes `messages`, for the messages it makes before the
  answers reach the handler, eg. when `verify` fails.
- Answers taken for spam are logged with the reason, and in development the
  form shows it instead of the confirmation bots see.
- `<Form placeholderLabels>` shows the labels of text inputs, text areas and
  selects as their placeholder, out of sight for people but not for screen
  readers.
- `<Form>` tests rules on the language against the language its definition
  was queried in, so the site no longer passes `locale` for them. The
  `locale` prop still overrides it.
- An editor whose role is limited to some languages of a form entry sees and
  changes the submissions sent in those.

- Form mails have a CC field, passed to the `mailer` as `cc`, and their body
  can insert every answer with `{{all answers}}`. The dashboard shows an error
  for a `{{key}}` the form does not have, in the subject or body of any
  language.
- The body of form mails is rich text and is sent as `html` next to `text`:
  `{{all answers}}` is a table of labels and answers and answers are escaped.
  A site with its own design wraps `content`, the body as an html fragment,
  eg. `mailer: mail => resend.emails.send({from, ...mail, html:
  brand(mail.content)})`. Bodies written as plain text read as paragraphs.
- Form mails can link to the submission in the dashboard with
  `{{submission link}}`, which opens it in the Submissions tab of the form,
  also `href({entryId, submission})`, and attach the uploaded files with Attach uploaded files, passed to the
  `mailer` as `attachments` with their content as base64. A checked check
  and the text of the link are in the language of the form, `checked` and
  `viewSubmission` of `forms.messages`.

### New

- The errors and messages forms show visitors are in the language of the form,
  with texts in English, Dutch, French and German. Replace texts or add a
  language with `forms.messages` in `createHandler`, eg.
  `{nl: {tooLong: ({max}) => ...}}`. Results that did not pass have the
  `codes` of their errors next to the `errors`, `validate` of an input can
  return a message by its code and `Form.validate` takes a `locale`. The
  `locale` of the form is passed to `validate` as a third argument,
  `{locale}`, so messages of your own can be in the language of the visitor.

### Fixes

- The settings of a link to an entry have Edit entry, which opens the entry
  in the dashboard, instead of opening it in another tab.

## [2.0.3] - 2026-11-27

### New

- `Field.number` takes `formatOptions`, which set how the value is shown and
  parsed, eg. `{maximumFractionDigits: 6}` with `step: 0.000001` for a
  latitude or longitude.

### Fixes

- Checked items in a dropdown menu are marked by their background only, like
  the selected option of a select, so labels and badges line up on every row.
- Untranslated badges are gray instead of the blue of a draft.

## [2.0.2] - 2026-11-25

### Fixes

- The caret below a block that ends a rich text field shows where the new
  line starts, inside the editor, and leaves no space behind when the field
  is left without typing. The first and last block keep some room from the
  edges of the editor.

## [2.0.1] - 2026-11-25

### New

- Filter entries on the entries they link to with `_references`, the reverse
  of `_referenced`: `filter: {_references: {_id: entry.id}}`, optionally
  limited to a field.
- The entry header shows in how many languages an entry is translated, with a
  menu listing each language and its status.
- Archiving or deleting a page asks where its url should redirect to, with the
  references that will break. Republishing an archived page gives its url
  back.
- The settings sheet of a link shows where it points: the full url of a page
  with its suffix and anchor, and a preview with file details for files and
  images, which open in the media library. Link rows show the url suffix next
  to the anchor.
- Anchors of page links can be typed freely, the anchors of the linked entry
  are suggested.
- Clicking below a block that ends a rich text field starts a new line.

### Fixes

- Entry links resolve in the locale their entry exists in, also across
  workspaces.
- A plain media alt text is kept for the other languages when one language is
  edited.
- `EntryTable` no longer stays on its loading state when its query changes,
  eg. when switching the language of the entry it is shown in.
- Publishing a draft under a new path leaves no draft behind, shared links
  keep their language.
- An outdated dashboard tab is asked to reload and its changes are refused,
  failing syncs are shown.
- Moved files sync reliably, history leaves out commits that deleted a file.
- Folders closed by hand stay closed while an entry inside them is open.

## [2.0.0] - 2026-11-17

### New

- Rebuild the dashboard on React Aria Components, with keyboard navigation,
  focus management and screen reader support throughout, a new theme with dark
  mode, a responsive layout, entry history and a references panel that shows
  which entries link to the current one. The entry sidebar starts closed for
  entries without a preview.
- Add `alinea/components`, the public component library the dashboard is built
  from, to build custom fields and views. It includes `Stack`, `Form` (field
  errors from native constraints, `validationErrors` or what `onSubmit`
  returns) and `useAsyncList` to load items page by page or as you type, and
  to update, remove or add loaded items without loading them again.
  `DialogContent` submits a form with `onSubmit`, `Dialog` has `onClose`,
  `Table` has `loading` and `onLoadMore`, `ComboBox` has groups, item
  descriptions and icons, `filter` and `loading`, and `TextField` has
  `maxRows`, `inputMode` and `pattern`. Collection keys are strings or numbers.
  Dashboard icons are available from `alinea/dashboard/icons`.
- Add `alinea/cms` for custom fields and views: field hooks that read and
  write the fields of the row, a parent row or the entry when passed that
  field (`useFieldValue` also takes the key of a field of the row),
  `useEntry()` returning a `DashboardEntry`, `useNavigate` to open entries by
  id, `EditField` and `EditFields` (also for the fields of an object field),
  `FieldChrome` and `EntryTable`. `href({entryId})` from `alinea` links to an
  entry in the dashboard, also outside of it. The entry editor sets
  `--alinea-header-height`. `useSiblingFieldValue` and the `useField` hooks of
  `alinea/dashboard` are deprecated, the `useEntryEditor` shim reads the
  publish status from `activeVersion.status`.
- Add `i18n: {translate: 'fields'}` to keep a single entry per item in a
  translated root, and `Field.localised` to keep every locale of a value in a
  single field, with fallbacks. Without `locales` it takes the locales of the
  root of its entry and throws in roots that translate entries, with `locales`
  it works in any root. Queries for a locale find the entries of roots that
  translate fields to it, files of the media root still only match queries
  without a locale. `Field.localiser` is deprecated.
- Add `Config.file` to define types of uploaded files, with fields of their
  own and an `accept` list, and upload into any root or folder that contains
  them. An upload becomes the first file type that accepts it, the upload
  dialog asks which one when several do. Image and file fields pick files of
  every file type, the media root is built on the `MediaFile` file type.
  Uploads to a location without file types still become media files, the
  `upload_file` MCP tool takes a `root` and `type`.
- Add `tabs` to `Config.type`, `Config.document` and `Config.file`, and a
  `view` to `Field.tab`, eg. an Analytics tab that shows a custom component.
  Entries show the tabs in the entry editor, list rows and rich text blocks as
  sections of their settings sheet, below the label and anchor. Their fields
  are stored and queried like the other fields.
- Define `MediaFile` in the schema with `Config.mediaFile` to give media files
  tabs or fields of your own. Files uploaded before have them too, and queries
  naming `MediaFile` find it.
- Define `MediaLibrary` in the schema with `Config.mediaLibrary` to change the
  overview of media folders, or give them tabs or fields of your own.
  `Config.mediaOverview()` returns the built-in overview to reuse and extend
  its columns, sorts and filters.
- Add the `overview` option to container types and roots to configure how the
  dashboard lists their children: columns (`Config.column`) with per-type
  selects, formatting and custom cells, built-in type, status, updated and
  author columns, sorting by column header (kept in the URL), the default
  `sort`, `layout`, card `thumbnail` and toolbar `actions`. A column `header`
  is text or a React element, and `info` explains the column in a popover
  opened from an info button next to the header. Filters can load their
  options from the content with a function that receives the `graph` and
  `locale`, and an option without `filter` lists every entry and is picked
  while no other option of its filter is. `tabs` list the entries of a filter
  per tab above the list (the selected tab is kept in the URL), and `header`
  renders a view between the toolbar and the list, eg. totals of the listed
  entries. The media library lists previews, dimensions, sizes and file types.
  `EntryTable` in `alinea/cms` renders the same columns in custom views.
  `overview.sort` replaces `orderChildrenBy`, `summaryRow` and `summaryThumb`
  are deprecated and the `overview` field option only applies when the parent
  defines no columns.
- Add the `actions` type option: components in the entry header, next to the
  publish button.
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
- Show the progress of the content sync below the dashboard's loading spinner
  (`Syncing content · 1,240 of 4,800 files`) and in the activity status for
  later syncs. `syncWith` takes an `onProgress` callback.
- Record URL aliases in the metadata field when an entry's URL changes, and
  resolve them in queries (`alias` filter, `Query.aliases`). The metadata field
  also stores `createdAt`, `createdBy`, `updatedAt` and `updatedBy`.
- Target fields inside object fields in role permissions, such as
  `{field: Article.visibility.germany, deny: {all: true}}`.
- Add `beforeCommit` and `afterCommit` handler hooks to rewrite changes before
  they are committed, or to revalidate, notify and deploy after. Both receive
  the `user` that commits, `afterCommit` also the committed `entries` and the
  `removed` entries with the url they had. `alinea dev --role <name>` signs in
  the local user with that role, for saves, hooks and `cms.user()`.
- Commits from the dashboard end with an `Alinea-Content` trailer holding the
  content sha they commit, so a deploy can skip building a publish that only
  changed content, see the instant publishing guide.
- Add an MCP server to `alinea dev` (`http://localhost:4500/mcp`) so coding
  agents can read the schema and create, edit, publish, move and delete entries
  and upload media through the dashboard's save path.
- Add the `adminPath`, `maxUploadSize` and `tracer` config options, and a
  workspace `mediaUrl` option.
- Add `Field.select.multiple`, `min` and `max` for lists, images and link
  options in rich text, rich text anchors, link anchors and suffixes, and
  `allowDuplicates` for links.
- Limit `Field.link` to some kinds of links with `kinds`, eg.
  `kinds: ['entry', 'url']`; stored links of other kinds are left out when
  queried. Queried links have the label the editor gave them as `label`,
  `_label` is deprecated.
- Add a composable backend in `alinea/backend` (`createBackend`, `auth`,
  `database`, `github`, `uploads`) with S3 and Supabase uploads and user
  management.

### Improved

- The theme tokens and resets of `alinea/css` apply inside elements with
  `data-alinea-theme`, which the dashboard sets on `<html>`, so the stylesheet
  can be loaded on a site without restyling it. The workspace color is
  `--alinea-workspace-color`.
- Order titles regardless of case, accents and leading punctuation, with
  numbers by their value and letters a locale orders after z (eg. æ, ø and å
  in Danish) there. The local database is rebuilt once after upgrading.
- Global search picks its workspace and root from dropdowns and filters on
  the entry types found there.
- Enforce the `explore` permission: link and image pickers list the entries a
  role can explore, without opening them in the dashboard. Allowing `read`
  allows `explore`, denying `read` denies it unless `explore` is allowed.
- Publish instantly: deployed sites sync new content as soon as it is committed,
  driven by the repository sha. `syncInterval` is now a fallback, defaulting to
  60 seconds.

### Breaking changes

- Upgrading from 1.x? The [upgrade guide](https://alineacms.com/docs/upgrading)
  walks through the changes below.
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
  Toolbar buttons take `hidden`, and the links group has a Remove link
  button shown while the selection is in a link.
- Change `Edit.move` to `{id, target, dropPosition}`.
- Remove the `remote` handler option and the unused entry hooks. OAuth2 backends
  require `validateClaims`. Drafts are no longer stored in the database.
- Remove the components from `alinea/ui` except `RichText`, and the form atoms
  from `alinea/dashboard`.
- A type's `view` replaces the form below the entry header instead of the
  whole editor: the field hooks of `alinea/cms`, `EditField` and `EditFields`
  edit the fields of the entry, the header publishes or saves them as a draft,
  the sidebar shows history and references, and leaving with unsaved changes
  asks to confirm. `view` also accepts a component instead of a path.
- Roles combine per role: a deny only applies within the role that sets it, so
  another role of the same user can still allow the action. Before, a deny in
  any role blocked it for the user.
- Options trackers type `get(field)` by the field, so single link fields read
  as possibly `null`. Calls that pass the value type, eg. `get<string>(field)`,
  no longer compile: pass the field only.

### Fixed

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
