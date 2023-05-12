import {createId} from 'alinea/core'
import {column, index, table, withRecursive} from 'rado'
import {EntryData} from '../backend/db/EntryData.js'

/*
class EntryVersionTable {
  entryId = column.string
  status = column.string<EntryStatus>()
  modifiedAt = column.number
  contentHash = column.string

  path = column.string
  title = column.string
  url = column.string
  data = column.json

  get versionId() {
    return this.entryId.concat('.').concat(this.status)
  }
}

export interface EntryVersion extends table<EntryVersionTable> {
  data: EntryData
}

export const EntryVersion = table({
  EntryVersion: EntryVersionTable,
  [table.indexes]() {
    return {
      entry: index(this.entryId)
    }
  },
  [table.primaryKey]() {
    return [this.entryId, this.status]
  }
})
*/

export enum EntryPhase {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

export class EntryTable {
  // Entry data
  entryId = column.string.default(createId)
  phase = column.string<EntryPhase>()
  type = column.string

  // Hierarchy
  workspace = column.string
  root = column.string

  filePath = column.string
  parentDir = column.string
  childrenDir = column.string.nullable

  parent = column.string.nullable
  index = column.string.nullable

  // I18n
  locale = column.string.nullable
  i18nId = column.string.nullable

  // Version specific
  get versionId() {
    return this.entryId.concat('.').concat(this.phase)
  }
  modifiedAt = column.number
  contentHash = column.string

  path = column.string
  title = column.string
  url = column.string
  data = column.json

  get parents() {
    const Self = Entry().as('Self')
    const parents = withRecursive(
      Self({entryId: this.parent}).select({...Self, level: 0})
    ).unionAll(() =>
      Self()
        .select({...Self, level: parents.level.add(1)})
        .innerJoin(parents({parent: Self.entryId}))
    )
    return parents
  }
}

export interface Entry extends table<EntryTable> {
  data: EntryData
}

export const Entry = table({
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
      index: index(this.index),
      fileIdentifier: index(this.filePath, this.workspace, this.root),
      parentDir: index(this.parentDir),
      childrenDir: index(this.childrenDir),
      versionId: index(this.versionId)
    }
  }
})
