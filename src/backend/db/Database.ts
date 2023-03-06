import {createId, EntryMeta} from 'alinea/core'
import {column, Driver, index, table, withRecursive} from 'rado'
import {group_concat} from 'rado/sqlite'

enum EntryStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived'
}

type EntryTree = table<typeof EntryTree>
const EntryTree = table({
  EntryTree: class {
    revisionId = column.string.primaryKey<'EntryTree'>(createId)
    lastModified = column.number
    status = column.string<EntryStatus>()

    entryId = column.string
    type = column.string
    root = column.string
    workspace = column.string

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
          type: index(this.type),
          parent: index(this.parent),
          index: index(this.index),
          'workspace.root': index(this.workspace, this.root)
        }
      }
    }
  }
})

const AlineaMeta = table({
  AlineaMeta: class {
    lastModified = column.number
    idHash = column.string
  }
})

export interface EntryRaw {
  id: string
  type: string
  path: string
  title: string
  url: string
  lastModified: number
  alinea: EntryMeta
}

export class Database {
  constructor(public cnx: Driver.Async) {}

  async meta() {
    return this.cnx(
      AlineaMeta()
        .first()
        .select({...AlineaMeta})
    )
  }

  private async writeMeta() {
    return this.cnx.transaction(async query => {
      const {lastModified, ids} = await query(
        EntryTree()
          .select({
            lastModified: EntryTree.lastModified,
            ids: group_concat(EntryTree.entryId, ',')
          })
          .first()
      )
      // const hash = md5()
      // todo
    })
  }

  async fill(entries: AsyncGenerator<EntryRaw>): Promise<void> {
    return this.cnx.transaction(async query => {
      await query(EntryTree().create())
      for await (const entry of entries) {
        const {lastModified, id, type, path, title, url, alinea, ...data} =
          entry
        await query(
          EntryTree().insertOne({
            lastModified: lastModified,
            status: EntryStatus.Published,
            entryId: id,
            type: type,
            root: alinea.root,
            workspace: alinea.workspace,
            parent: alinea.parent,
            index: alinea.index,
            i18nId: alinea.i18n?.id,
            locale: alinea.i18n?.locale,
            path: path,
            title: title as string,
            url: url,
            data: data
          })
        )
      }
    })
  }
}
