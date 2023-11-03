import {JsonLoader} from 'alinea/backend'
import {
  Config,
  EntryUrlMeta,
  PageSeed,
  Root,
  Schema,
  SyncResponse,
  Syncable,
  Type,
  Workspace,
  createId,
  unreachable
} from 'alinea/core'
import {entryInfo} from 'alinea/core/EntryFilenames'
import {EntryRecord, META_KEY, createRecord} from 'alinea/core/EntryRecord'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {Logger} from 'alinea/core/util/Logger'
import {entries} from 'alinea/core/util/Objects'
import * as path from 'alinea/core/util/Paths'
import {timer} from 'alinea/core/util/Timer'
import {Driver, Expr, Select, alias, create} from 'rado'
import {exists} from 'rado/sqlite'
import xxhash from 'xxhash-wasm'
import {ALT_STATUS, EntryPhase, EntryRow} from '../core/EntryRow.js'
import {Source} from './Source.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {AlineaMeta} from './db/AlineaMeta.js'
import {createEntrySearch} from './db/CreateEntrySearch.js'
import {createFileHash, createRowHash} from './util/ContentHash.js'

const decoder = new TextDecoder()

type Seed = {
  type: string
  workspace: string
  root: string
  filePath: string
  page: PageSeed
}

export class Database implements Syncable {
  seed: Map<string, Seed>

  constructor(public config: Config, public store: Store) {
    this.seed = this.seedData()
  }

  async syncRequired(contentHash: string): Promise<boolean> {
    const meta = await this.meta()
    return meta.contentHash !== contentHash
  }

  async sync(contentHashes: Array<string>): Promise<SyncResponse> {
    return this.store.transaction(async tx => {
      const insert = await tx(
        EntryRow().where(EntryRow.rowHash.isNotIn(contentHashes))
      )
      const keep = new Set(
        await tx(
          EntryRow()
            .where(EntryRow.rowHash.isIn(contentHashes))
            .select(EntryRow.rowHash)
        )
      )
      const remove = contentHashes.filter(hash => !keep.has(hash))
      return {insert, remove}
    })
  }

  async contentHashes() {
    return this.store(EntryRow().select(EntryRow.rowHash))
  }

  // Syncs data with a remote database, returning the ids of changed entries
  async syncWith(remote: Syncable, force = false): Promise<Array<string>> {
    await this.init()
    const meta = await this.meta()
    const isRequired = force || (await remote.syncRequired(meta.contentHash))
    if (!isRequired) return []
    const {insert, remove} = await remote.sync(await this.contentHashes())
    return this.store.transaction(async tx => {
      const removed = await tx(
        EntryRow().where(EntryRow.rowHash.isIn(remove)).select(EntryRow.entryId)
      )
      await tx(EntryRow().delete().where(EntryRow.rowHash.isIn(remove)))
      for (const entry of insert) await tx(EntryRow().insertOne(entry))
      await Database.index(tx)
      await this.writeMeta(tx)
      return removed.concat(insert.map(e => e.entryId))
    })
  }

  async applyMutations(mutations: Array<Mutation>) {
    return this.store.transaction(async tx => {
      for (const mutation of mutations) {
        console.log(
          `Applying mutation: ${mutation.type} to ${mutation.entryId}`
        )
        this.applyMutation(tx, mutation)
      }
      await Database.index(tx)
      await this.writeMeta(tx)
    })
  }

  async applyMutation(tx: Driver.Async, mutation: Mutation) {
    switch (mutation.type) {
      case MutationType.Create:
      case MutationType.Edit: {
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: mutation.entry.phase
        })
        await tx(row.delete(), EntryRow().insert(mutation.entry))
        return this.updateHash(tx, row)
      }
      case MutationType.Archive: {
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: EntryPhase.Published
        })
        await tx(row.set({phase: EntryPhase.Archived}))
        return this.updateHash(
          tx,
          EntryRow({entryId: mutation.entryId, phase: EntryPhase.Archived})
        )
      }
      case MutationType.Publish: {
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: EntryPhase.Published
        })
        const phases = await tx(
          EntryRow({
            entryId: mutation.entryId
          }).select(EntryRow.phase)
        )
        const promoting = phases.find(p => ALT_STATUS.includes(p))
        if (!promoting) return
        await tx(
          row.delete(),
          EntryRow({
            entryId: mutation.entryId,
            phase: promoting
          }).set({
            phase: EntryPhase.Published
          })
        )
        return this.updateHash(tx, row)
      }
      case MutationType.FileRemove:
        if (mutation.replace) return
      case MutationType.Remove:
        return tx(EntryRow({entryId: mutation.entryId}).delete())
      case MutationType.Discard:
        return tx(
          EntryRow({
            entryId: mutation.entryId,
            phase: EntryPhase.Draft
          }).delete()
        )
      case MutationType.Order: {
        const rows = EntryRow({entryId: mutation.entryId})
        // Todo: apply this to other languages too?
        await tx(rows.set({index: mutation.index}))
        return this.updateHash(tx, rows)
      }
      case MutationType.Move: {
        const rows = EntryRow({entryId: mutation.entryId})
        await tx(
          rows.set({
            index: mutation.index,
            parent: mutation.parent,
            workspace: mutation.workspace,
            root: mutation.root
          })
        )
        return this.updateHash(tx, rows)
      }
      case MutationType.Upload:
        return
      default:
        throw unreachable(mutation)
    }
  }

  async updateHash(tx: Driver.Async, selection: Select<EntryRow>) {
    const entries = await tx(selection)
    for (const entry of entries) {
      const updated = await createEntryRow(this.config, entry)
      console.log(
        `update hash of ${entry.entryId} from ${entry.rowHash} to ${updated.rowHash}`
      )
      await tx(
        EntryRow({entryId: entry.entryId, phase: entry.phase}).set({
          fileHash: updated.fileHash,
          rowHash: updated.rowHash
        })
      )
    }
  }

  async meta() {
    return (
      (await this.store(AlineaMeta().maybeFirst())) ?? {
        contentHash: '',
        modifiedAt: 0
      }
    )
  }

  static async index(tx: Driver.Async) {
    const {Parent} = alias(EntryRow)
    const res = await tx(
      EntryRow().set({
        parent: Parent({childrenDir: EntryRow.parentDir})
          .select(Parent.entryId)
          .maybeFirst(),
        active: EntryRealm.isActive,
        main: EntryRealm.isMain
      })
    )
    return res
  }

  private async writeMeta(tx: Driver.Async) {
    const {h32ToString} = await xxhash()
    const contentHashes = await tx(
      EntryRow()
        .select(EntryRow.rowHash.concat('.').concat(EntryRow.phase))
        .orderBy(EntryRow.rowHash)
    )
    const contentHash = h32ToString(contentHashes.join(''))
    const modifiedAt = await tx(
      EntryRow()
        .select(EntryRow.modifiedAt)
        .orderBy(EntryRow.modifiedAt.desc())
        .first()
    )
    await tx(AlineaMeta().delete())
    await tx(
      AlineaMeta().insertOne({
        modifiedAt,
        contentHash
      })
    )
  }

  inited = false
  async init() {
    if (this.inited) return
    this.inited = true
    try {
      await this.store.transaction(async tx => {
        await tx(create(EntryRow, AlineaMeta))
        await createEntrySearch(tx)
      })
    } catch (e) {
      this.inited = false
      throw e
    }
  }

  entryUrl(type: Type, meta: EntryUrlMeta) {
    const {entryUrl} = Type.meta(type)
    if (entryUrl) return entryUrl(meta)
    const segments = meta.locale ? [meta.locale] : []
    return (
      '/' +
      segments
        .concat(
          meta.parentPaths
            .concat(meta.path)
            .filter(segment => segment !== 'index')
        )
        .join('/')
    )
  }

  computeEntry(
    record: EntryRecord,
    meta: {
      workspace: string
      root: string
      filePath: string
    },
    seed?: Seed
  ): Omit<EntryRow, 'rowHash' | 'fileHash'> {
    const {[META_KEY]: alineaMeta, ...data} = record
    const typeName = alineaMeta.type
    const parentDir = path.dirname(meta.filePath)
    const extension = path.extname(meta.filePath)
    const fileName = path.basename(meta.filePath, extension)
    const [entryPath, entryPhase] = entryInfo(fileName)
    const segments = parentDir.split('/').filter(Boolean)
    const root = Root.data(this.config.workspaces[meta.workspace][meta.root])
    let locale: string | null = null

    if (root.i18n) {
      locale = segments.shift()!
      if (!root.i18n.locales.includes(locale))
        throw new Error(`invalid locale: "${locale}"`)
    }

    const type = this.config.schema[typeName]
    if (!type) throw new Error(`invalid type: "${typeName}"`)
    if (seed && seed.type !== typeName)
      throw new Error(
        `Type mismatch between seed and file: "${seed.type}" !== "${typeName}"`
      )
    const childrenDir = path.join(parentDir, entryPath)

    if (!record[META_KEY].entryId) throw new Error(`missing id`)

    const urlMeta: EntryUrlMeta = {
      locale,
      parentPaths: segments,
      path: entryPath,
      phase: entryPhase
    }

    const pathData = entryPath === 'index' ? '' : entryPath
    const seedData = seed ? PageSeed.data(seed.page).partial : {}
    const entryData = {
      ...seedData,
      ...data,
      path: pathData
    }
    const searchableText = ''

    return {
      workspace: meta.workspace,
      root: meta.root,
      filePath: meta.filePath,
      seeded: Boolean(seed || alineaMeta.seeded || false),

      modifiedAt: Date.now(), // file.modifiedAt,
      active: false,
      main: false,

      entryId: alineaMeta.entryId,
      phase: entryPhase,
      type: alineaMeta.type,

      parentDir,
      childrenDir,
      parent: null,
      level: parentDir === '/' ? 0 : segments.length,
      index: alineaMeta.index,
      locale,
      i18nId: alineaMeta.i18nId ?? alineaMeta.entryId,

      path: entryPath,
      title: record.title ?? seedData?.title ?? '',
      url: this.entryUrl(type, urlMeta),

      data: entryData,
      searchableText
    }
  }

  seedData() {
    const res = new Map<string, Seed>()
    const typeNames = Schema.typeNames(this.config.schema)
    for (const [workspaceName, workspace] of entries(this.config.workspaces)) {
      for (const [rootName, root] of entries(workspace)) {
        let pages = entries(root)
        if (pages.length === 0) continue
        const {i18n} = Root.data(root)
        const locales = i18n?.locales || [undefined]
        for (const locale of locales) {
          const target = locale ? `/${locale}` : '/'
          while (pages.length > 0) {
            const [pagePath, page] = pages.shift()!
            if (!PageSeed.isPageSeed(page)) continue
            const {type} = PageSeed.data(page)
            const filePath = path.join(target, pagePath) + '.json'
            const typeName = typeNames.get(type)
            if (!typeName) continue
            res.set(filePath, {
              type: typeName,
              workspace: workspaceName,
              root: rootName,
              filePath,
              page: page
            })
            const children = entries(page)
            pages.push(...children)
          }
        }
      }
    }
    return res
  }

  async fill(source: Source, target?: Target): Promise<void> {
    // Todo: run a validation step for orders, paths, id matching on statuses
    // etc
    await this.init()
    const typeNames = Schema.typeNames(this.config.schema)
    const publishSeed: Array<EntryRow> = []

    await this.store.transaction(async query => {
      const seenVersions: Array<string> = []
      const seenSeeds = new Set<string>()
      let inserted = 0
      const endScan = timer('Scanning entries')
      for await (const file of source.entries()) {
        const seed = this.seed.get(file.filePath)
        const fileHash = await createFileHash(file.contents)
        const exists = await query(
          EntryRow({
            fileHash: fileHash,
            filePath: file.filePath,
            workspace: file.workspace,
            root: file.root
          })
            .select(EntryRow.versionId)
            .maybeFirst()
        )
        if (seed) {
          seenSeeds.add(seed.filePath)
        }
        // Todo: a config change but unchanged entry data will currently
        // fly under the radar
        if (exists) {
          seenVersions.push(exists)
          continue
        }
        try {
          const raw = JsonLoader.parse(this.config.schema, file.contents)
          const entry = this.computeEntry(EntryRecord(raw), file, seed)
          if (entry.seeded && entry.phase === EntryPhase.Published && !seed)
            throw new Error(`seed entry is missing from config`)
          await query(
            EntryRow({entryId: entry.entryId, phase: entry.phase}).delete()
          )
          const rowHash = await createRowHash({...entry, fileHash})
          const withHash: EntryRow = {...entry, fileHash, rowHash}
          seenVersions.push(
            await query(
              EntryRow().insert(withHash).returning(EntryRow.versionId)
            )
          )
          inserted++
        } catch (e: any) {
          console.log(`> skipped ${file.filePath} — ${e.message}`)
        }
      }
      const seedPaths = Array.from(this.seed.keys())
      for (const seedPath of seedPaths) {
        if (seenSeeds.has(seedPath)) continue
        const seed = this.seed.get(seedPath)!
        const {type, partial} = PageSeed.data(seed.page)
        const typeName = typeNames.get(type)
        if (!typeName) continue
        const entry = this.computeEntry(
          {
            title: partial.title ?? '',
            [META_KEY]: {
              entryId: createId(),
              type: typeName,
              index: 'a0'
            }
          },
          seed
        )
        const record = createRecord(entry)
        const fileContents = JsonLoader.format(this.config.schema, record)
        const fileHash = await createFileHash(fileContents)
        const rowHash = await createRowHash({...entry, fileHash})
        const withHash = {...entry, fileHash, rowHash}
        seenVersions.push(
          await query(EntryRow().insert(withHash).returning(EntryRow.versionId))
        )
        inserted++
        publishSeed.push({
          ...withHash,
          seeded: true,
          title: undefined!,
          data: {}
        })
      }
      endScan(`Scanned ${seenVersions.length} entries`)
      if (seenVersions.length === 0) return

      const {rowsAffected: removed} = await query(
        EntryRow().delete().where(EntryRow.versionId.isNotIn(seenVersions))
      )
      const noChanges = inserted === 0 && removed === 0
      if (noChanges) return
      // if (inserted) console.log(`> updated ${inserted} entries`)
      // if (removed) console.log(`> removed ${removed} entries`)

      //const endIndex = timer('Indexing entries')
      await Database.index(query)
      //endIndex()
      await this.writeMeta(query)
    })

    if (target && publishSeed.length > 0) {
      const changeSetCreator = new ChangeSetCreator(this.config)
      const mutations = publishSeed.map((seed): Mutation => {
        const workspace = this.config.workspaces[seed.workspace]
        const file = path.join(
          Workspace.data(workspace).source,
          seed.root,
          seed.filePath
        )
        return {
          type: MutationType.Create,
          entryId: seed.entryId,
          file: file,
          entry: seed
        }
      })
      const changes = changeSetCreator.create(mutations)
      await target.mutate({mutations: changes}, {logger: new Logger('seed')})
    }
  }
}

namespace EntryRealm {
  const {Alt} = alias(EntryRow)
  const isDraft = EntryRow.phase.is(EntryPhase.Draft)
  const isArchived = EntryRow.phase.is(EntryPhase.Archived)
  const isPublished = EntryRow.phase.is(EntryPhase.Published)
  const hasDraft = exists(
    Alt({phase: EntryPhase.Draft, entryId: EntryRow.entryId})
  )
  const hasPublished = exists(
    Alt({phase: EntryPhase.Published, entryId: EntryRow.entryId})
  )
  const hasArchived = exists(
    Alt({phase: EntryPhase.Archived, entryId: EntryRow.entryId})
  )
  const isPublishedWithoutDraft = Expr.and(isPublished, hasDraft.not())
  const isArchivedWithoutDraftOrPublished = Expr.and(
    isArchived,
    hasDraft.not(),
    hasPublished.not()
  )
  export const isActive = Expr.or(
    isDraft,
    isPublishedWithoutDraft,
    isArchivedWithoutDraftOrPublished
  )
  const isArchivedWithoutPublished = Expr.and(isArchived, hasPublished.not())
  const isDraftWithoutPublishedOrArchived = Expr.and(
    isDraft,
    hasPublished.not(),
    hasArchived.not()
  )
  export const isMain = Expr.or(
    isPublished,
    isArchivedWithoutPublished,
    isDraftWithoutPublishedOrArchived
  )
}
