import {column, index, table} from 'rado'
import {createId} from './Id.js'

export enum EntryPhase {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

export const ALT_STATUS: Array<EntryPhase> = [
  EntryPhase.Draft,
  EntryPhase.Archived
]

export type EntryLinks = {[field: string]: Array<string>}

export class EntryTable {
  // Entry data
  entryId = column.string.default(createId)
  phase = column.string<EntryPhase>()
  title = column.string
  type = column.string
  seeded = column.string.nullable

  // Hierarchy
  workspace = column.string
  root = column.string

  index = column.string
  parent = column.string.nullable

  // I18n
  i18nId = column.string
  locale = column.string.nullable

  // Entries from which a new draft can be created are marked as active,
  // there is only one active entry per entryId
  active = column.boolean
  // Per entry there is one main entry, which is either published, archived or
  // draft
  main = column.boolean

  // Version specific
  get versionId() {
    return this.entryId.concat('.').concat(this.phase)
  }

  path = column.string
  data = column.json<any>()

  // Computed
  level = column.number // Amount of parents
  filePath = column.string // Filesystem location
  parentDir = column.string // Filesystem location
  childrenDir = column.string // Filesystem location
  /** @deprecated */
  modifiedAt = column.number
  rowHash = column.string
  fileHash = column.string
  url = column.string
  searchableText = column.string
}

/**
 * Represents an Entry row in the database,
 * field data is available in the data column in JSON format.
 */
export type EntryRow<Data = Record<string, any>> = table<EntryTable> & {
  data: Data
}

export const EntryRow = table({
  Entry: EntryTable,
  [table.primaryKey]() {
    return [this.entryId, this.phase]
  },
  [table.indexes]() {
    return {
      rowHash: index(this.rowHash),
      type: index(this.type),
      parent: index(this.parent),
      url: index(this.url),
      path: index(this.path),
      fileIdentifier: index(this.filePath, this.workspace, this.root),
      parentDir: index(this.parentDir),
      childrenDir: index(this.childrenDir),
      versionId: index(this.versionId),
      phase: index(this.phase),
      i18nId: index(this.i18nId)
    }
  }
})
