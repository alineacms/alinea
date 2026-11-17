import {Query} from 'alinea'
import {EntryTable, useEntry} from 'alinea/cms'
import {Field} from 'alinea/components'

/** The link fields entries that link to this page */
export function PageReferences() {
  const entry = useEntry()
  if (!entry) return null
  // The overview and filter are new objects on every render
  return (
    <Field label="References">
      <EntryTable
        aria-label="References"
        workspace="primary"
        root="pages"
        overview={{sort: {desc: Query.updatedAt}}}
        filter={{linkMultiple: {includes: {_entry: entry.id}}}}
        emptyMessage="No link fields entries link to this page."
      />
    </Field>
  )
}
