import {JsonLoader} from 'alinea/backend'
import {
  Config,
  EntryUrlMeta,
  PageSeed,
  Root,
  Schema,
  Syncable,
  Type,
  Workspace,
  createId,
  unreachable
} from 'alinea/core'
import {entryInfo} from 'alinea/core/EntryFilenames'
import {EntryRecord, META_KEY} from 'alinea/core/EntryRecord'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Logger} from 'alinea/core/util/Logger'
import {entries} from 'alinea/core/util/Objects'
import * as path from 'alinea/core/util/Paths'
import {timer} from 'alinea/core/util/Timer'
import {Driver, Expr, Table, alias, create} from 'rado'
import {exists} from 'rado/sqlite'
import xxhash from 'xxhash-wasm'
import {EntryPhase, EntryRow} from '../core/EntryRow.js'
import {Source} from './Source.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {AlineaMeta} from './db/AlineaMeta.js'
import {createEntrySearch} from './db/CreateEntrySearch.js'
import {createContentHash} from './util/ContentHash.js'

const decoder = new TextDecoder()

const ALT_STATUS = [EntryPhase.Draft, EntryPhase.Archived]
type Seed = {
  type: string
  workspace: string
  root: string
  filePath: string
  page: PageSeed
}

export class Database implements Syncable {
  seed: Map<string, Seed>

  constructor(protected store: Store, public config: Config) {
    this.seed = this.seedData()
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
        EntryRow().where(EntryRow.modifiedAt.isGreater(request.modifiedAt))
      )
    }
  }

  async versionIds(): Promise<Array<string>> {
    return this.store(EntryRow().select(EntryRow.versionId))
  }

  // Syncs data with a remote database, returning the ids of changed entries
  async syncWith(remote: Syncable): Promise<Array<string>> {
    await this.init()
    const current = await this.meta()
    const update = await remote.updates(current)
    const {contentHash, entries} = update
    if (entries.length) await this.updateEntries(entries)
    const updated = await this.meta()
    const changedEntries = entries.map(e => e.entryId)
    if (updated.contentHash === contentHash) return changedEntries
    const remoteVersionIds = await remote.versionIds()
    const excessEntries = await this.store.transaction(async query => {
      const excess = await query(
        EntryRow()
          .select({entryId: EntryRow.entryId, versionId: EntryRow.versionId})
          .where(
            remoteVersionIds.length > 0
              ? EntryRow.versionId.isNotIn(remoteVersionIds)
              : true
          )
      )
      await query(
        EntryRow()
          .delete()
          .where(EntryRow.versionId.isIn(excess.map(e => e.versionId)))
      )
      await Database.index(query)
      await this.writeMeta(query)
      return excess.map(e => e.entryId)
    })
    const afterRemoves = await this.meta()
    if (afterRemoves.contentHash === contentHash)
      return changedEntries.concat(excessEntries)
    // Todo: we should abandon syncing and just fetch the full db
    throw new Error('Sync failed')
  }

  async updateEntries(entries: Array<EntryRow>) {
    await this.store.transaction(async query => {
      for (const entry of entries) {
        await query(
          EntryRow({
            entryId: entry.entryId,
            phase: entry.phase
          }).delete()
        )
        await query(EntryRow().insertOne(entry))
      }
      await Database.index(query)
      await this.writeMeta(query)
    })
  }

  async applyMutations(mutations: Array<Mutation>) {
    for (const mutation of mutations) {
      switch (mutation.type) {
        case MutationType.Edit:
          await this.store(
            EntryRow({
              entryId: mutation.entryId,
              phase: EntryPhase.Draft
            }).delete(),
            EntryRow().insert(mutation.entry)
          )
          continue
        case MutationType.Archive:
          await this.store(
            EntryRow({
              entryId: mutation.entryId,
              phase: EntryPhase.Published
            }).set({phase: EntryPhase.Archived})
          )
          continue
        case MutationType.Publish:
          const phases = await this.store(
            EntryRow({
              entryId: mutation.entryId
            }).select(EntryRow.phase)
          )
          const promoting = phases.find(p => ALT_STATUS.includes(p))
          if (promoting)
            await this.store(
              EntryRow({
                entryId: mutation.entryId,
                phase: EntryPhase.Published
              }).delete(),
              EntryRow({
                entryId: mutation.entryId,
                phase: promoting
              }).set({
                phase: EntryPhase.Published
              })
            )
          continue
        case MutationType.Remove:
          await this.store(EntryRow({entryId: mutation.entryId}).delete())
          continue
        case MutationType.Discard:
          await this.store(
            EntryRow({
              entryId: mutation.entryId,
              phase: EntryPhase.Draft
            }).delete()
          )
          continue
        case MutationType.Order:
          await this.store(
            EntryRow({entryId: mutation.entryId}).set({index: mutation.index})
          )
          continue
        case MutationType.Move:
          await this.store(
            EntryRow({entryId: mutation.entryId}).set({
              index: mutation.index,
              parent: mutation.parent,
              workspace: mutation.workspace,
              root: mutation.root
            })
          )
          continue
        case MutationType.FileUpload:
          await this.store(EntryRow().insert(mutation.entry))
          continue
        default:
          throw unreachable(mutation)
      }
    }
    await Database.index(this.store)
  }

  async meta() {
    return (
      (await this.store(AlineaMeta().maybeFirst())) ?? {
        contentHash: '',
        modifiedAt: 0
      }
    )
  }

  static async index(query: Driver.Async) {
    const {Parent} = alias(EntryRow)
    const res = await query(
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

  private async writeMeta(query: Driver.Async) {
    const {h32ToString} = await xxhash()
    const contentHashes = await query(
      EntryRow()
        .select(EntryRow.contentHash.concat('.').concat(EntryRow.phase))
        .orderBy(EntryRow.contentHash)
    )
    const contentHash = h32ToString(contentHashes.join(''))
    const modifiedAt = await query(
      EntryRow()
        .select(EntryRow.modifiedAt)
        .orderBy(EntryRow.modifiedAt.desc())
        .first()
    )
    await query(AlineaMeta().delete())
    await query(
      AlineaMeta().insertOne({
        modifiedAt,
        contentHash
      })
    )
  }

  inited = false
  private async init() {
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
    data: EntryRecord,
    meta: {
      workspace: string
      root: string
      filePath: string
    },
    seed?: Seed
  ): Omit<Table.Insert<typeof EntryRow>, 'contentHash'> {
    const typeName = data[META_KEY].type
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

    if (!data[META_KEY].entryId) throw new Error(`missing id`)

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
      seeded: Boolean(seed || data[META_KEY].seeded || false),
      // contentHash,

      modifiedAt: Date.now(), // file.modifiedAt,
      active: false,
      main: false,

      entryId: data[META_KEY].entryId,
      phase: entryPhase,
      type: data[META_KEY].type,

      parentDir,
      childrenDir,
      parent: null,
      level: parentDir === '/' ? 0 : segments.length,
      index: data[META_KEY].index,
      locale,
      i18nId: data[META_KEY].i18nId ?? data[META_KEY].entryId,

      path: entryPath,
      title: data.title ?? seedData?.title ?? '',
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
    const {h32Raw} = await xxhash()
    const typeNames = Schema.typeNames(this.config.schema)
    const publishSeed: Array<EntryRow> = []

    await this.store.transaction(async query => {
      const seenVersions: Array<string> = []
      const seenSeeds = new Set<string>()
      let inserted = 0
      const endScan = timer('Scanning entries')
      for await (const file of source.entries()) {
        const seed = this.seed.get(file.filePath)
        const extension = path.extname(file.filePath)
        const fileName = path.basename(file.filePath, extension)
        const [, phase] = entryInfo(fileName)
        const contentHash = await createContentHash(
          phase,
          file.contents,
          seed
            ? seed.type + JSON.stringify(PageSeed.data(seed.page).partial)
            : undefined
        )
        const exists = await query(
          EntryRow({
            contentHash,
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
          const withHash = entry as Table.Insert<typeof EntryRow>
          withHash.contentHash = contentHash
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
        const seedData = new TextEncoder().encode(
          seed.type + JSON.stringify(PageSeed.data(seed.page).partial)
        )
        const contentHash = h32Raw(seedData).toString(16).padStart(8, '0')
        const withHash = entry as EntryRow
        withHash.contentHash = contentHash
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

    const updated = await this.meta()

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
          type: MutationType.Edit,
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
