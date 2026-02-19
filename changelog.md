# Changelog

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

