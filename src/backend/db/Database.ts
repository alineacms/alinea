import {Config, createError, createId} from 'alinea/core'
import * as path from 'alinea/core/util/Paths'
import {
  alias,
  column,
  create,
  Driver,
  index,
  Table,
  table,
  withRecursive
} from 'rado'
import {group_concat} from 'rado/sqlite'
import xxhash from 'xxhash-wasm'

enum EntryStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived'
}

class EntryTable {
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

  [table.meta]() {
    return {
      indexes: {
        type: index(this.type),
        parent: index(this.parent),
        index: index(this.index),
        'workspace.root': index(this.workspace, this.root),
        parentDir: index(this.parentDir).where(this.parentDir.isNotNull())
      }
    }
  }
}

export type EntryTree = table<EntryTable>
export const EntryTree = table({EntryTree: EntryTable})

type AlineaMeta = table<typeof AlineaMeta>
const AlineaMeta = table({
  AlineaMeta: class {
    contentHash = column.string
    modifiedAt = column.number
  }
})

export interface FileInfo {
  workspace: string
  root: string
  filePath: string
  contents: Uint8Array
  modifiedAt: number
}

const decoder = new TextDecoder()

function assert<T>(value: T): T {
  if (!value) throw new TypeError('Expected value')
  return value
}

export interface Syncable {
  requestUpdates(request: AlineaMeta): Promise<{
    contentHash: string
    entries: Array<EntryTree>
  }>
  requestIds(): Promise<Array<string>>
}

export class Database implements Syncable {
  constructor(public cnx: Driver.Async, public config: Config) {}

  async requestUpdates(request: AlineaMeta) {
    const current = await this.meta()
    return {
      contentHash: current.contentHash,
      entries: await this.cnx(
        EntryTree().where(EntryTree.modifiedAt.isGreater(request.modifiedAt))
      )
    }
  }

  async requestIds(): Promise<Array<string>> {
    return this.cnx(EntryTree().select(EntryTree.id))
  }

  async syncWith(remote: Syncable): Promise<void> {
    const {contentHash, entries} = await remote.requestUpdates(
      await this.meta()
    )
    if (entries.length) await this.updateEntries(entries)
    const updated = await this.meta()
    if (updated.contentHash === contentHash) return
    const remoteIds = await remote.requestIds()
    await this.cnx(EntryTree().where(EntryTree.id.isNotIn(remoteIds)))
  }

  async updateEntries(entries: Array<EntryTree>) {
    return this.cnx.transaction(async query => {
      for (const entry of entries) {
        await query(EntryTree().delete().where(EntryTree.id.is(entry.id)))
        await query(EntryTree().insertOne(entry))
      }
      await this.index(query)
      await this.writeMeta(query)
    })
  }

  async meta() {
    return (
      (await this.cnx(
        AlineaMeta()
          .maybeFirst()
          .select({...AlineaMeta})
      )) ?? {
        contentHash: '',
        modifiedAt: 0
      }
    )
  }

  private async index(query: Driver.Async) {
    // todo: url
    const {Parent} = alias(EntryTree)
    return query(
      EntryTree().set({
        parent: Parent({childrenDir: EntryTree.parentDir})
          .select(Parent.entryId)
          .maybeFirst()
      })
    )
  }

  private async writeMeta(query: Driver.Async) {
    const {h32ToString} = await xxhash()
    const contentHashes = await query(
      EntryTree()
        .select(group_concat(EntryTree.contentHash, ''))
        .orderBy(EntryTree.contentHash)
        .first()
    )
    const contentHash = h32ToString(contentHashes)
    const modifiedAt = await query(
      EntryTree()
        .select(EntryTree.modifiedAt)
        .orderBy(EntryTree.modifiedAt.desc())
        .first()
    )
    await query(
      AlineaMeta().delete(),
      AlineaMeta().insertOne({
        modifiedAt,
        contentHash
      })
    )
  }

  async init() {
    return this.cnx.transaction(async query => {
      await query(create(EntryTree, AlineaMeta))
    })
  }

  computeEntry(
    file: FileInfo,
    contentHash: string
  ): Table.Insert<typeof EntryTree> {
    const data = JSON.parse(decoder.decode(file.contents))
    const parentDir = path.dirname(file.filePath)
    const extension = path.extname(file.filePath)
    const fileName = path.basename(file.filePath, extension)
    const segments = parentDir.split('/')
    const root = this.config.workspaces[file.workspace].roots[file.root]
    let locale: string | null = null

    if (root.i18n) {
      locale = segments.shift()!
      if (!root.i18n.locales.includes(locale))
        throw createError(
          `Invalid locale: ${locale}, for entry in ${file.filePath}`
        )
    }

    const type = this.config.type(data.type)
    if (!type)
      throw createError(
        `Invalid type: ${data.type}, for entry in ${file.filePath}`
      )

    const isContainer = type.isContainer
    const childrenDir = isContainer ? path.join(parentDir, fileName) : null

    return {
      workspace: file.workspace,
      root: file.root,
      filePath: file.filePath,
      contentHash,

      modifiedAt: file.modifiedAt,
      // todo: infer draft
      status: EntryStatus.Published,

      entryId: assert(data.id),
      type: data.type,

      parentDir,
      childrenDir,
      parent: null,
      index: null,
      locale,
      i18nId: data.alinea?.i18n?.id,

      path: fileName,
      title: data.title ?? '',
      url: '',

      data
    }
  }

  async fill(files: AsyncGenerator<FileInfo>): Promise<void> {
    const {h32Raw} = await xxhash()
    return this.cnx.transaction(async query => {
      await this.init()
      const seen = new Set<string>()
      for await (const file of files) {
        const contentHash = h32Raw(file.contents).toString(16).padStart(8, '0')
        const exists = await query(
          EntryTree({
            contentHash,
            filePath: file.filePath,
            workspace: file.workspace,
            root: file.root
          })
            .select(EntryTree.id)
            .maybeFirst()
        )
        if (exists) {
          seen.add(exists)
          continue
        }
        const entry = this.computeEntry(file, contentHash)
        await query(EntryTree().insertOne(entry))
      }
      await this.index(query)
      await this.writeMeta(query)
    })
  }
}
