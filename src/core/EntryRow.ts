import {column, index, table} from 'rado'
import {createId} from './Id.js'

export enum EntryPhase {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

export type EntryLinks = {[field: string]: Array<string>}

export class EntryTable {
  // Entry data
  entryId = column.string.default(createId)
  phase = column.string<EntryPhase>()
  title = column.string
  type = column.string
  seeded = column.boolean.default(false)

  // Hierarchy
  workspace = column.string
  root = column.string
  level = column.number // Amount of parents
  filePath = column.string
  parentDir = column.string
  childrenDir = column.string.nullable

  index = column.string
  parent = column.string.nullable

  // I18n
  i18nId = column.string
  locale = column.string.nullable

  // Version specific
  get versionId() {
    return this.entryId.concat('.').concat(this.phase)
  }
  modifiedAt = column.number
  contentHash = column.string

  // Entries from which a new draft can be created are marked as active,
  // there is only one active entry per entryId
  active = column.boolean
  // Per entry there is one main entry, which is either published, archived or
  // draft
  main = column.boolean

  path = column.string
  url = column.string
  data = column.json<any>()
  searchableText = column.string
}

/**
 * Represents an Entry row in the database,
 * field data is available in the data column in JSON format.
 */
export interface EntryRow<Data = Record<string, any>>
  extends table<EntryTable> {
  data: Data
}

export const EntryRow = table({
  Entry: EntryTable,
  [table.primaryKey]() {
    return [this.entryId, this.phase]
  },
  [table.indexes]() {
    return {
      modifiedAt: index(this.modifiedAt),
      contentHash: index(this.contentHash),
      type: index(this.type),
      parent: index(this.parent),
      fileIdentifier: index(this.filePath, this.workspace, this.root),
      parentDir: index(this.parentDir),
      childrenDir: index(this.childrenDir),
      versionId: index(this.versionId),
      phase: index(this.phase)
    }
  }
})
