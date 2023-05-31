import {column, index, table} from 'rado'
import {EntryData} from '../backend/db/EntryData.js'
import {createId} from './Id.js'

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
  level = column.number // Amount of parents
  filePath = column.string
  parentDir = column.string
  childrenDir = column.string.nullable

  index = column.string
  parent = column.string.nullable

  // I18n
  locale = column.string.nullable
  i18nId = column.string.nullable

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
  title = column.string
  url = column.string
  data = column.json

  /*get parentIds() {
    const Parent = Entry().as('Parent')
    const parents = withRecursive(
      Parent({entryId: this.entryId}).select({
        entryId: Parent.entryId,
        parent: Parent.parent,
        level: 0
      })
    ).unionAll(() =>
      Parent()
        .select({
          entryId: Parent.entryId,
          parent: Parent.parent,
          level: parents.level.add(1)
        })
        .innerJoin(parents({parent: Parent.entryId}))
    )
    return parents().select(parents.entryId).skip(1)
  }*/
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
      versionId: index(this.versionId),
      phase: index(this.phase)
    }
  }
})
