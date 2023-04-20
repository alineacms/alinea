import {createId} from 'alinea/core'
import {column, index, table, withRecursive} from 'rado'

export enum EntryStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived'
}

class EntryTreeTable {
  id = column.string.primaryKey(createId)
  workspace = column.string
  root = column.string
  filePath = column.string
  contentHash = column.string

  modifiedAt = column.number
  status = column.string<EntryStatus>()

  entryId = column.string
  type = column.string

  parentDir = column.string
  childrenDir = column.string.nullable
  parent = column.string.nullable
  index = column.string.nullable
  locale = column.string.nullable
  i18nId = column.string.nullable

  path = column.string
  title = column.string
  url = column.string
  data = column.json

  get parents() {
    const Self = EntryTree().as('Self')
    const parents = withRecursive(
      Self({entryId: this.parent}).select({...Self, level: 0})
    ).unionAll(() =>
      Self()
        .select({...Self, level: parents.level.add(1)})
        .innerJoin(parents({parent: Self.entryId}))
    )
    return parents
  }

  protected [table.meta]() {
    return {
      indexes: {
        modifiedAt: index(this.modifiedAt),
        contentHash: index(this.contentHash),
        type: index(this.type),
        parent: index(this.parent),
        index: index(this.index),
        fileIdentifier: index(this.filePath, this.workspace, this.root),
        parentDir: index(this.parentDir),
        childrenDir: index(this.childrenDir)
      }
    }
  }
}

interface EntryData {
  [key: string]: any
}

export interface EntryTree extends table<EntryTreeTable> {
  data: EntryData
}

export const EntryTree = table({EntryTree: EntryTreeTable})
