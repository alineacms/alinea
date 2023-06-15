import {
  Config,
  Connection,
  EntryUrlMeta,
  PageSeed,
  Root,
  Schema,
  Syncable,
  Type,
  createError,
  createId
} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Realm} from 'alinea/core/pages/Realm'
import {Logger} from 'alinea/core/util/Logger'
import {entries} from 'alinea/core/util/Objects'
import * as path from 'alinea/core/util/Paths'
import {timer} from 'alinea/core/util/Timer'
import {Driver, Expr, Table, alias, create} from 'rado'
import {exists} from 'rado/sqlite'
import xxhash from 'xxhash-wasm'
import {Entry, EntryPhase} from '../core/Entry.js'
import {Selection} from '../core/pages/Selection.js'
import {Resolver} from './Resolver.js'
import {Source} from './Source.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSet} from './data/ChangeSet.js'
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
  resolve: <T>(params: Connection.ResolveParams) => Promise<T>
  seed: Map<string, Seed>

  constructor(protected store: Store, public config: Config) {
    this.resolve = new Resolver(store, config.schema).resolve
    this.seed = this.seedData()
  }

  find<S>(selection: S, realm = Realm.Published) {
    return this.resolve({
      selection: Selection.create(selection),
      realm
    }) as Promise<Selection.Infer<S>>
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
        Entry().where(Entry.modifiedAt.isGreater(request.modifiedAt))
      )
    }
  }

  async versionIds(): Promise<Array<string>> {
    return this.store(Entry().select(Entry.versionId))
  }

  // Syncs data with a remote database, returning the ids of changed entries
  async syncWith(remote: Syncable): Promise<Array<string>> {
    await this.init()
    const update = await remote.updates(await this.meta())
    const {contentHash, entries} = update
    if (entries.length) await this.updateEntries(entries)
    const updated = await this.meta()
    const changedEntries = entries.map(e => e.entryId)
    if (updated.contentHash === contentHash) return changedEntries
    const remoteVersionIds = await remote.versionIds()
    const excessEntries = await this.store.transaction(async query => {
      const excess = await query(
        Entry()
          .select({entryId: Entry.entryId, versionId: Entry.versionId})
          .where(
            remoteVersionIds.length > 0
              ? Entry.versionId.isNotIn(remoteVersionIds)
              : true
          )
      )
      await query(
        Entry()
          .delete()
          .where(Entry.versionId.isIn(excess.map(e => e.versionId)))
      )
      await this.index(query)
      await this.writeMeta(query)
      return excess.map(e => e.entryId)
    })
    const afterRemoves = await this.meta()
    if (afterRemoves.contentHash === contentHash)
      return changedEntries.concat(excessEntries)
    // Todo: we should abandon syncing and just fetch the full db
    throw createError('Sync failed')
  }

  async updateEntries(entries: Array<Entry>) {
    return this.store.transaction(async query => {
      for (const entry of entries) {
        await query(
          Entry({
            entryId: entry.entryId,
            phase: entry.phase
          }).delete()
        )
        await query(Entry().insertOne(entry))
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
    const {Parent} = alias(Entry)
    const res = await query(
      Entry().set({
        parent: Parent({childrenDir: Entry.parentDir})
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
      Entry().select(Entry.contentHash).orderBy(Entry.contentHash)
    )
    const contentHash = h32ToString(contentHashes.join(''))
    const modifiedAt = await query(
      Entry().select(Entry.modifiedAt).orderBy(Entry.modifiedAt.desc()).first()
    )
    await query(
      AlineaMeta().delete(),
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
        await tx(create(Entry, AlineaMeta))
        await createEntrySearch(tx)
      })
    } catch (e) {
      this.inited = false
      throw e
    }
  }

  entryInfo(fileName: string): [name: string, status: EntryPhase] {
    // See if filename ends in a known status
    const status = ALT_STATUS.find(s => fileName.endsWith(`.${s}`))
    if (status) return [fileName.slice(0, -status.length - 1), status]
    // Otherwise, it's published
    return [fileName, EntryPhase.Published]
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
  ): Omit<Table.Insert<typeof Entry>, 'contentHash'> {
    const parentDir = path.dirname(meta.filePath)
    const extension = path.extname(meta.filePath)
    const fileName = path.basename(meta.filePath, extension)
    const [entryPath, entryPhase] = this.entryInfo(fileName)
    const segments = parentDir.split('/').filter(Boolean)
    const root = Root.data(this.config.workspaces[meta.workspace][meta.root])
    let locale: string | null = null

    if (root.i18n) {
      locale = segments.shift()!
      if (!root.i18n.locales.includes(locale))
        throw new Error(`invalid locale: "${locale}"`)
    }

    const type = this.config.schema[data.type]
    if (!type) throw new Error(`invalid type: "${data.type}"`)
    if (seed && seed.type !== data.type)
      throw new Error(
        `Type mismatch between seed and file: "${seed.type}" !== "${data.type}"`
      )
    const childrenDir = path.join(parentDir, entryPath)

    if (!data.id) throw new Error(`missing id`)

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
      seeded: Boolean(seed || data.alinea.seeded || false),
      // contentHash,

      modifiedAt: Date.now(), // file.modifiedAt,
      active: false,
      main: false,

      entryId: data.id,
      phase: entryPhase,
      type: data.type,

      parentDir,
      childrenDir,
      parent: null,
      level: parentDir === '/' ? 0 : segments.length - 1,
      index: data.alinea?.index,
      locale,
      i18nId: data.alinea?.i18n?.id,

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
    const publishSeed: Array<Entry> = []

    await this.store.transaction(async query => {
      const seenVersions: Array<string> = []
      const seenSeeds = new Set<string>()
      let inserted = 0
      const endScan = timer('Scanning entries')
      for await (const file of source.entries()) {
        const seed = this.seed.get(file.filePath)
        const extension = path.extname(file.filePath)
        const fileName = path.basename(file.filePath, extension)
        const [, phase] = this.entryInfo(fileName)
        const contentHash = await createContentHash(
          phase,
          file.contents,
          seed
            ? seed.type + JSON.stringify(PageSeed.data(seed.page).partial)
            : undefined
        )
        const exists = await query(
          Entry({
            contentHash,
            filePath: file.filePath,
            workspace: file.workspace,
            root: file.root
          })
            .select(Entry.versionId)
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
          const entry = this.computeEntry(
            EntryRecord(JSON.parse(decoder.decode(file.contents))),
            file,
            seed
          )
          if (entry.seeded && entry.phase === EntryPhase.Published && !seed)
            throw new Error(`seed entry is missing from config`)
          await query(
            Entry({entryId: entry.entryId, phase: entry.phase}).delete()
          )
          const withHash = entry as Table.Insert<typeof Entry>
          withHash.contentHash = contentHash
          seenVersions.push(
            await query(Entry().insert(withHash).returning(Entry.versionId))
          )
          inserted++
        } catch (e: any) {
          console.log(`> skipped ${file.filePath} — ${e.message}`)
        }
      }
      for (const seedPath of this.seed.keys()) {
        if (seenSeeds.has(seedPath)) continue
        const seed = this.seed.get(seedPath)!
        const {type, partial} = PageSeed.data(seed.page)
        const typeName = typeNames.get(type)
        if (!typeName) continue
        const entry = this.computeEntry(
          {
            id: createId(),
            type: typeName,
            title: partial.title ?? '',
            alinea: {
              index: 'a0'
            }
          },
          seed
        )
        const seedData = new TextEncoder().encode(
          seed.type + JSON.stringify(PageSeed.data(seed.page).partial)
        )
        const contentHash = h32Raw(seedData).toString(16).padStart(8, '0')
        const withHash = entry as Entry
        withHash.contentHash = contentHash
        seenVersions.push(
          await query(Entry().insert(withHash).returning(Entry.versionId))
        )
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
        Entry().delete().where(Entry.versionId.isNotIn(seenVersions))
      )
      const noChanges = inserted === 0 && removed === 0
      if (noChanges) return
      // if (inserted) console.log(`> updated ${inserted} entries`)
      // if (removed) console.log(`> removed ${removed} entries`)

      //const endIndex = timer('Indexing entries')
      await this.index(query)
      //endIndex()
      await this.writeMeta(query)
    })

    if (target && publishSeed.length > 0) {
      const changes = await ChangeSet.create(
        this,
        publishSeed,
        EntryPhase.Published,
        target.canRename
      )
      await target.publishChanges({changes}, {logger: new Logger('seed')})
    }
  }
}

namespace EntryRealm {
  const {Alt} = alias(Entry)
  const isDraft = Entry.phase.is(EntryPhase.Draft)
  const isArchived = Entry.phase.is(EntryPhase.Archived)
  const isPublished = Entry.phase.is(EntryPhase.Published)
  const hasDraft = exists(
    Alt({phase: EntryPhase.Draft, entryId: Entry.entryId})
  )
  const hasPublished = exists(
    Alt({phase: EntryPhase.Published, entryId: Entry.entryId})
  )
  const hasArchived = exists(
    Alt({phase: EntryPhase.Archived, entryId: Entry.entryId})
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
