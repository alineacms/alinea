import {Config} from 'alinea/core/Config'
import {SyncResponse, Syncable} from 'alinea/core/Connection'
import {EntryRecord, META_KEY, createRecord} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {PageSeed} from 'alinea/core/Page'
import {Root} from 'alinea/core/Root'
import {Schema} from 'alinea/core/Schema'
import {EntryUrlMeta, Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {createFileHash, createRowHash} from 'alinea/core/util/ContentHash'
import {entryInfo, entryUrl} from 'alinea/core/util/EntryFilenames'
import {createEntryRow, publishEntryRow} from 'alinea/core/util/EntryRows'
import {Logger} from 'alinea/core/util/Logger'
import {entries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {unreachable} from 'alinea/core/util/Types'
import {Driver, Expr, Select, alias, create} from 'rado'
import {exists} from 'rado/sqlite'
import xxhash from 'xxhash-wasm'
import {EntryPhase, EntryRow} from '../core/EntryRow.js'
import {Media} from './Media.js'
import {Source} from './Source.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {AlineaMeta} from './db/AlineaMeta.js'
import {createEntrySearch} from './db/CreateEntrySearch.js'
import {JsonLoader} from './loader/JsonLoader.js'

interface Seed {
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

  // Syncs data with a remote database, returning the i18nIds of changed entries
  async syncWith(remote: Syncable, force = false): Promise<Array<string>> {
    await this.init()
    const meta = await this.meta()
    const isRequired = force || (await remote.syncRequired(meta.contentHash))
    if (!isRequired) return []
    const {insert, remove} = await remote.sync(await this.contentHashes())
    return this.store.transaction(async tx => {
      const removed = await tx(
        EntryRow().where(EntryRow.rowHash.isIn(remove)).select(EntryRow.i18nId)
      )
      await tx(EntryRow().delete().where(EntryRow.rowHash.isIn(remove)))
      const changed = []
      for (const entry of insert) {
        await tx(EntryRow().insertOne(entry))
        changed.push(entry.i18nId)
      }
      await Database.index(tx)
      // This is for a local db, we didn't receive a commit hash here
      await this.writeMeta(tx, meta.commitHash)
      return removed.concat(changed)
    })
  }

  async applyMutations(mutations: Array<Mutation>, commitHash?: string) {
    const hash = commitHash ?? (await this.meta()).commitHash
    return this.store.transaction(async tx => {
      const reHash = []
      for (const mutation of mutations) {
        try {
          const updateRows = await this.applyMutation(tx, mutation)
          if (updateRows) reHash.push(updateRows)
        } catch (error) {
          console.error(error)
          console.warn(
            `> could not apply mutation\n${JSON.stringify(mutation)}`
          )
        }
      }
      await Database.index(tx)
      const changed = (
        await Promise.all(reHash.map(updateRows => updateRows()))
      ).flat()
      await this.writeMeta(tx, hash)
      return changed
    })
  }

  private async applyPublish(tx: Driver.Async, entry: EntryRow) {
    const next = publishEntryRow(this.config, entry)
    await tx(
      EntryRow({entryId: entry.entryId, phase: entry.phase}).set({
        phase: EntryPhase.Published,
        filePath: next.filePath,
        parentDir: next.parentDir,
        childrenDir: next.childrenDir,
        url: next.url
      })
    )
    return this.updateChildren(tx, entry, next)
  }

  private async updateChildren(
    tx: Driver.Async,
    previous: EntryRow,
    next: EntryRow
  ) {
    const {childrenDir: dir} = previous
    if (next.phase !== EntryPhase.Published || dir === next.childrenDir)
      return []
    const children = await tx(
      EntryRow().where(
        EntryRow.parentDir.is(dir).or(EntryRow.childrenDir.like(dir + '/%'))
      )
    )
    for (const child of children) {
      const filePath = next.childrenDir + child.filePath.slice(dir.length)
      const childrenDir = next.childrenDir + child.childrenDir.slice(dir.length)
      const parentDir = next.childrenDir + child.parentDir.slice(dir.length)
      const parentPaths = parentDir.split('/').filter(Boolean)
      if (child.locale) parentPaths.shift()
      const url = entryUrl(this.config.schema[child.type], {
        ...child,
        parentPaths
      })
      await tx(
        EntryRow({entryId: child.entryId, phase: child.phase}).set({
          filePath,
          childrenDir,
          parentDir,
          url
        })
      )
    }
    return children
  }

  async logEntries() {
    const entries = await this.store(
      EntryRow().orderBy(EntryRow.url.asc(), EntryRow.index.asc())
    )
    for (const entry of entries) {
      console.log(
        entry.url.padEnd(35),
        entry.entryId.padEnd(12),
        entry.phase.padEnd(12),
        entry.title
      )
    }
  }

  private async applyMutation(
    tx: Driver.Async,
    mutation: Mutation
  ): Promise<(() => Promise<Array<string>>) | undefined> {
    switch (mutation.type) {
      case MutationType.Create: {
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: mutation.entry.phase
        })
        const current = await tx(row.maybeFirst())
        if (current) return
        await tx(EntryRow().insert(mutation.entry))
        return () => this.updateHash(tx, row)
      }
      case MutationType.Edit: {
        const {entryId, entry} = mutation
        const row = EntryRow({
          entryId,
          phase: entry.phase
        })
        const current = await tx(row.maybeFirst())
        await tx(row.delete(), EntryRow().insert(entry))
        let children: Array<EntryRow> = []
        if (entry.phase === EntryPhase.Published) {
          if (current) children = await this.updateChildren(tx, current, entry)
        }
        return () => {
          return this.updateHash(tx, row).then(self =>
            this.updateHash(
              tx,
              EntryRow().where(
                EntryRow.entryId.isIn(children.map(e => e.entryId))
              )
            ).then(children => self.concat(children))
          )
        }
      }
      case MutationType.Patch: {
        const {patch} = mutation
        const rows = EntryRow({entryId: mutation.entryId, main: true})
        const current = await tx(rows.maybeFirst())
        if (current) await tx(rows.set({data: {...current.data, patch}}))
        return () => this.updateHash(tx, rows)
      }
      case MutationType.Archive: {
        const archived = EntryRow({
          entryId: mutation.entryId,
          phase: EntryPhase.Archived
        })
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: EntryPhase.Published
        })
        const published = await tx(row.maybeFirst())
        if (!published) return
        const filePath =
          published.filePath.slice(0, -5) + `.${EntryPhase.Archived}.json`
        await tx(
          archived.delete(),
          row.set({
            phase: EntryPhase.Archived,
            filePath
          })
        )
        return () => this.updateHash(tx, archived)
      }
      case MutationType.Publish: {
        const promoting = await tx(
          EntryRow({
            entryId: mutation.entryId,
            phase: mutation.phase
          }).maybeFirst()
        )
        if (!promoting) return
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: EntryPhase.Published
        })
        await tx(row.delete())
        const children = await this.applyPublish(tx, promoting)
        return () =>
          this.updateHash(tx, row).then(rows => {
            return this.updateHash(
              tx,
              EntryRow().where(
                EntryRow.entryId.isIn(children.map(e => e.entryId))
              )
            ).then(r => rows.concat(r))
          })
      }
      case MutationType.FileRemove:
        if (mutation.replace) return
      case MutationType.Remove: {
        const existing = await tx(
          EntryRow({entryId: mutation.entryId}).maybeFirst()
        )
        if (!existing) return
        const phases = await tx(EntryRow({entryId: mutation.entryId}))
        // Remove child entries
        for (const phase of phases) {
          await tx(
            EntryRow()
              .delete()
              .where(
                EntryRow.parentDir
                  .is(phase.childrenDir)
                  .or(EntryRow.childrenDir.like(phase.childrenDir + '/%'))
              )
          )
        }
        await tx(EntryRow({entryId: mutation.entryId}).delete())
        return async () => phases.map(e => e.i18nId).concat(existing.i18nId)
      }
      case MutationType.Discard: {
        const existing = await tx(
          EntryRow({entryId: mutation.entryId}).maybeFirst()
        )
        if (!existing) return
        await tx(
          EntryRow({
            entryId: mutation.entryId,
            phase: EntryPhase.Draft
          }).delete()
        )
        return async () => [existing.i18nId]
      }
      case MutationType.Order: {
        const rows = EntryRow({entryId: mutation.entryId})
        // Todo: apply this to other languages too
        await tx(rows.set({index: mutation.index}))
        return () => this.updateHash(tx, rows)
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
        // Todo: update file & children paths
        return () => this.updateHash(tx, rows)
      }
      case MutationType.Upload: {
        // Until this mutation is applied the uploaded file won't be locally
        // available so the preview url is used. The fileHash is updated so that
        // syncing to the client after a successful deploy will overwrite this
        // change.
        const row = EntryRow({
          entryId: mutation.entryId,
          phase: EntryPhase.Published
        })
        const existing = await tx(row.maybeFirst())
        if (!existing) return
        if (process.env.NODE_ENV !== 'develoment')
          await tx(
            row.set({
              data: {
                ...existing.data,
                location: mutation.url,
                [Media.ORIGINAL_LOCATION]: existing.data.location
              }
            })
          )
        return () => this.updateHash(tx, row)
      }
      default:
        throw unreachable(mutation)
    }
  }

  async updateHash(tx: Driver.Async, selection: Select<EntryRow>) {
    const changed = []
    const entries = await tx(selection)
    for (const entry of entries) {
      const updated = await createEntryRow(this.config, entry)
      changed.push(updated.i18nId)
      await tx(
        EntryRow({entryId: entry.entryId, phase: entry.phase}).set({
          fileHash: updated.fileHash,
          rowHash: updated.rowHash
        })
      )
    }
    return changed
  }

  async meta() {
    return (
      (await this.store(AlineaMeta().maybeFirst())) ?? {
        commitHash: '',
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

  private async writeMeta(tx: Driver.Async, commitHash: string) {
    const {create32} = await xxhash()
    let hash = create32()
    const contentHashes = await tx(
      EntryRow().select(EntryRow.rowHash).orderBy(EntryRow.rowHash)
    )
    for (const c of contentHashes) hash = hash.update(c)
    const contentHash = hash.digest().toString(16).padStart(8, '0')
    const modifiedAt = await tx(
      EntryRow()
        .select(EntryRow.modifiedAt)
        .orderBy(EntryRow.modifiedAt.desc())
        .maybeFirst()
    )
    await tx(AlineaMeta().delete())
    await tx(
      AlineaMeta().insertOne({
        commitHash,
        contentHash,
        modifiedAt: modifiedAt ?? 0
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
      await this.meta()
    } catch (e) {
      this.inited = false
      throw e
    }
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
    const parentDir = paths.dirname(meta.filePath)
    const extension = paths.extname(meta.filePath)
    const fileName = paths.basename(meta.filePath, extension)
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
    const childrenDir = paths.join(parentDir, entryPath)

    if (!record[META_KEY].entryId) throw new Error(`missing id`)

    const urlMeta: EntryUrlMeta = {
      locale,
      parentPaths: segments,
      path: entryPath,
      phase: entryPhase
    }

    const pathData = entryPath === 'index' ? '' : entryPath
    const seedData = seed ? PageSeed.data(seed.page).partial : {}
    const title = record.title ?? seedData?.title ?? ''
    const entryData = {
      ...seedData,
      ...data,
      title,
      path: pathData
    }
    const searchableText = Type.searchableText(type, entryData)
    return {
      workspace: meta.workspace,
      root: meta.root,
      filePath: meta.filePath,
      seeded: seed?.filePath ?? null,

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
      title,
      url: entryUrl(type, urlMeta),

      data: entryData,
      searchableText
    }
  }

  seedData() {
    const res = new Map<string, Seed>()
    const typeNames = Schema.typeNames(this.config.schema)
    for (const [workspaceName, workspace] of entries(this.config.workspaces)) {
      for (const [rootName, root] of entries(workspace)) {
        const {i18n} = Root.data(root)
        const locales = i18n?.locales ?? [undefined]
        for (const locale of locales) {
          const pages: Array<readonly [string, PageSeed]> = entries(root)
          const target = locale ? `/${locale}` : '/'
          while (pages.length > 0) {
            const [pagePath, page] = pages.shift()!
            const path = pagePath.split('/').map(slugify).join('/')
            if (!PageSeed.isPageSeed(page)) continue
            const {type} = PageSeed.data(page)
            const filePath = paths.join(target, path) + '.json'
            const typeName = typeNames.get(type)
            if (!typeName) continue
            res.set(filePath, {
              type: typeName,
              workspace: workspaceName,
              root: rootName,
              filePath,
              page: page
            })
            const children = entries(page).map(
              ([childPath, child]) =>
                [paths.join(path, childPath), child as PageSeed] as const
            )
            pages.push(...children)
          }
        }
      }
    }
    return res
  }

  async fill(
    source: Source,
    commitHash: string,
    target?: Target
  ): Promise<void> {
    // Todo: run a validation step for orders, paths, id matching on statuses
    // etc
    await this.init()
    const typeNames = Schema.typeNames(this.config.schema)
    const publishSeed: Array<EntryRow> = []

    await this.store.transaction(async query => {
      const seenVersions: Array<string> = []
      const seenSeeds = new Set<string>()
      const inserted = []
      //const endScan = timer('Scanning entries')
      for await (const file of source.entries()) {
        const fileHash = await createFileHash(file.contents)
        const exists = await query(
          EntryRow({
            fileHash: fileHash,
            filePath: file.filePath,
            workspace: file.workspace,
            root: file.root
          })
            .select({
              versionId: EntryRow.versionId,
              seeded: EntryRow.seeded
            })
            .maybeFirst()
        )
        // Todo: a config change but unchanged entry data will currently
        // fly under the radar
        if (exists) {
          seenVersions.push(exists.versionId)
          if (exists.seeded) seenSeeds.add(exists.seeded)
          else seenSeeds.add(file.filePath)
          continue
        }
        try {
          const raw = JsonLoader.parse(this.config.schema, file.contents)
          const record = EntryRecord(raw)
          const seeded = record[META_KEY]?.seeded
          const seed =
            typeof seeded === 'string'
              ? this.seed.get(seeded)
              : // Backward compatibility
              seeded === true
              ? this.seed.get(file.filePath)
              : undefined
          const entry = this.computeEntry(record, file, seed)

          if (seed) seenSeeds.add(seed.filePath)
          else seenSeeds.add(file.filePath)

          await query(
            EntryRow({entryId: entry.entryId, phase: entry.phase}).delete()
          )
          const withHash: EntryRow = {...entry, fileHash, rowHash: ''}
          seenVersions.push(
            await query(
              EntryRow().insert(withHash).returning(EntryRow.versionId)
            )
          )
          inserted.push(`${entry.entryId}.${entry.phase}`)
        } catch (e: any) {
          console.log(`> skipped ${file.filePath} — ${e.message}`)
        }
      }
      const stableI18nIds = new Map<string, string>()
      for (const [seedPath, seed] of this.seed.entries()) {
        if (seenSeeds.has(seedPath)) continue
        const {type, partial} = PageSeed.data(seed.page)
        const typeName = typeNames.get(type)
        if (!typeName) continue
        const root = this.config.workspaces[seed.workspace][seed.root]
        const {i18n} = Root.data(root)
        let i18nId = createId()
        if (i18n) {
          const [, locale, ...rest] = seed.filePath.split('/')
          const path = rest.join('/')
          i18nId = stableI18nIds.get(path) ?? createId()
          stableI18nIds.set(path, i18nId)
        }
        const entry = this.computeEntry(
          {
            title: partial.title ?? '',
            [META_KEY]: {
              entryId: createId(),
              i18nId,
              type: typeName,
              index: 'a0',
              seeded: seed.filePath
            }
          },
          seed,
          seed
        )
        const record = createRecord(entry)
        const fileContents = JsonLoader.format(this.config.schema, record)
        const fileHash = await createFileHash(fileContents)
        const withHash = {...entry, fileHash, rowHash: ''}
        seenVersions.push(
          await query(EntryRow().insert(withHash).returning(EntryRow.versionId))
        )
        inserted.push(`${entry.entryId}.${entry.phase}`)
        publishSeed.push({
          ...withHash,
          title: undefined!,
          data: {}
        })
      }
      /*endScan(
        `Scanned ${seenVersions.length} entries${
          commitHash ? ` (@${commitHash})` : ''
        }`
      )*/
      if (seenVersions.length === 0) return

      const {rowsAffected: removed} = await query(
        EntryRow().delete().where(EntryRow.versionId.isNotIn(seenVersions))
      )
      const noChanges = inserted.length === 0 && removed === 0
      if (noChanges) return
      // if (inserted) console.log(`> updated ${inserted} entries`)
      // if (removed) console.log(`> removed ${removed} entries`)

      //const endIndex = timer('Indexing entries')
      await Database.index(query)
      const entries = await query(
        EntryRow().where(EntryRow.versionId.isIn(inserted))
      )
      for (const entry of entries) {
        const rowHash = await createRowHash(entry)
        await query(
          EntryRow({entryId: entry.entryId, phase: entry.phase}).set({
            rowHash
          })
        )
      }
      await this.writeMeta(query, commitHash)
    })

    if (target && publishSeed.length > 0) {
      const changeSetCreator = new ChangeSetCreator(this.config)
      const mutations = publishSeed.map((seed): Mutation => {
        const workspace = this.config.workspaces[seed.workspace]
        const file = paths.join(
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
      await target.mutate(
        {commitHash: '', mutations: changes},
        {logger: new Logger('seed')}
      )
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
