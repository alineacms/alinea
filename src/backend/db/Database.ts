import {createId, Entry} from 'alinea/core'
import {column, Driver, index, table, withRecursive} from 'rado'

enum EntryStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived'
}

type EntryTree = table<typeof EntryTree>
const EntryTree = table({
  EntryTree: class {
    revisionId = column.string.primaryKey<'EntryTree'>(createId)
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

export class Database {
  constructor(public cnx: Driver.Async) {}

  async fill(entries: AsyncGenerator<Entry>): Promise<void> {
    return this.cnx.transaction(async trx => {
      await EntryTree().create().on(trx)
      for await (const entry of entries) {
        const {id, type, path, title, url, alinea, ...data} = entry
        await EntryTree()
          .insertOne({
            revisionId: createId() as EntryTree['revisionId'],
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
          .on(trx)
      }
      const {parents} = EntryTree
      const entry2 = await EntryTree({entryId: 'entry3'})
        .first()
        .select({
          ...EntryTree,
          parents: parents()
            .select(parents.entryId)
            .orderBy(parents.level.desc())
        })
        .on(trx)
      console.log(entry2)
    })
  }
}
