import {Config, Root, createError} from 'alinea/core'
import * as path from 'alinea/core/util/Paths'
import {Driver, Table, alias, create} from 'rado'
import xxhash from 'xxhash-wasm'
import {Selection} from '../core/pages/Selection.js'
import {Syncable} from './Api.js'
import {entryData} from './EntryData.js'
import {Resolver} from './Resolver.js'
import {SourceEntry} from './Source.js'
import {Store} from './Store.js'
import {AlineaMeta} from './database/AlineaMeta.js'
import {EntryStatus, EntryTree} from './database/EntryTree.js'

const decoder = new TextDecoder()

export class Database implements Syncable {
  resolve: <T>(selection: Selection<T>) => Promise<T>

  constructor(public store: Store, public config: Config) {
    this.resolve = new Resolver(store, config.schema).resolve
  }

  async updates(request: AlineaMeta) {
    const current = await this.meta()
    if (current.contentHash === request.contentHash)
      return {
        contentHash: current.contentHash,
        entries: []
      }
    return {
      contentHash: current.contentHash,
      entries: await this.store(
        EntryTree().where(EntryTree.modifiedAt.isGreater(request.modifiedAt))
      )
    }
  }

  async ids(): Promise<Array<string>> {
    return this.store(EntryTree().select(EntryTree.id))
  }

  async syncWith(remote: Syncable): Promise<void> {
    const {contentHash, entries} = await remote.updates(await this.meta())
    if (entries.length) await this.updateEntries(entries)
    const updated = await this.meta()
    if (updated.contentHash === contentHash) return
    const remoteIds = await remote.ids()
    await this.store(
      EntryTree().delete().where(EntryTree.id.isNotIn(remoteIds))
    )
    const afterRemoves = await this.meta()
    if (afterRemoves.contentHash === contentHash) return
    // Throw: we should abandon syncing and just fetch the full db
    throw createError('Sync failed')
  }

  async updateEntries(entries: Array<EntryTree>) {
    return this.store.transaction(async query => {
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
      (await this.store(AlineaMeta().maybeFirst())) ?? {
        contentHash: '',
        modifiedAt: 0
      }
    )
  }

  private async index(query: Driver.Async) {
    const {Parent} = alias(EntryTree)
    const res = await query(
      EntryTree().set({
        parent: Parent({childrenDir: EntryTree.parentDir})
          .select(Parent.entryId)
          .maybeFirst()
      })
    )
    return res
  }

  private async writeMeta(query: Driver.Async) {
    const {h32ToString} = await xxhash()
    const contentHashes = await query(
      EntryTree().select(EntryTree.contentHash).orderBy(EntryTree.contentHash)
    )
    const contentHash = h32ToString(contentHashes.join(''))
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
    return this.store.transaction(async query => {
      await query(create(EntryTree, AlineaMeta))
    })
  }

  computeEntry(
    file: SourceEntry,
    contentHash: string
  ): Table.Insert<typeof EntryTree> {
    const data = JSON.parse(decoder.decode(file.contents))
    const parentDir = path.dirname(file.filePath)
    const extension = path.extname(file.filePath)
    const fileName = path.basename(file.filePath, extension)
    const segments = parentDir.split('/')
    const root = Root.data(this.config.workspaces[file.workspace][file.root])
    let locale: string | null = null

    if (root.i18n) {
      locale = segments.shift()!
      if (!root.i18n.locales.includes(locale))
        throw createError(
          `Invalid locale: ${locale}, for entry in ${file.filePath}`
        )
    }

    const type = this.config.schema[data.type]
    if (!type)
      throw createError(
        `Invalid type: ${data.type}, for entry in ${file.filePath}`
      )

    const childrenDir = path.join(parentDir, fileName)

    if (!data.id) throw createError(`Missing id for entry in ${file.filePath}`)

    return {
      workspace: file.workspace,
      root: file.root,
      filePath: file.filePath,
      contentHash,

      modifiedAt: file.modifiedAt,
      // todo: infer draft
      status: EntryStatus.Published,

      entryId: data.id,
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

      data: entryData(type, data)
    }
  }

  async fill(files: AsyncGenerator<SourceEntry>): Promise<void> {
    const {h32Raw} = await xxhash()
    return this.store.transaction(async query => {
      const seen: Array<string> = []
      let inserted = 0
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
          seen.push(exists)
          continue
        }
        const entry = this.computeEntry(file, contentHash)
        seen.push(
          await query(EntryTree().insert(entry).returning(EntryTree.id))
        )
        inserted++
      }
      const {rowsAffected: removed} = await query(
        EntryTree().delete().where(EntryTree.id.isNotIn(seen))
      )
      const noChanges = inserted === 0 && removed === 0
      if (noChanges) return
      await this.index(query)
      await this.writeMeta(query)
    })
  }
}
