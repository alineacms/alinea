import type {Entry} from '../Entry.js'
import type {
  EntryLanguageRow,
  EntryNodeRow,
  EntryVersionRow
} from './EntryRows.js'

export interface MaterializeEntryInput {
  version: EntryVersionRow
  language: EntryLanguageRow
  node: EntryNodeRow
}

export function materializeEntry({
  version,
  language,
  node
}: MaterializeEntryInput): Entry {
  return {
    ...version,
    status: language.inheritedStatus ?? version.status,
    parentId: node.parentId,
    parents: node.parents,
    url: language.url,
    active: version.rowId === language.activeRowId,
    main: version.rowId === language.mainRowId
  }
}
