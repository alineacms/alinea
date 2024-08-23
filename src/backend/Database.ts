import {Config} from 'alinea/core/Config'
import {SyncResponse, Syncable} from 'alinea/core/Connection'
import {EntryRecord, createRecord, parseRecord} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {PageSeed} from 'alinea/core/Page'
import {Root} from 'alinea/core/Root'
import {Schema} from 'alinea/core/Schema'
import {EntryUrlMeta, Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {MEDIA_LOCATION} from 'alinea/core/media/MediaLocation'
import {createFileHash, createRowHash} from 'alinea/core/util/ContentHash'
import {entryInfo, entryUrl} from 'alinea/core/util/EntryFilenames'
import {createEntryRow, publishEntryRow} from 'alinea/core/util/EntryRows'
import {entries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {unreachable} from 'alinea/core/util/Types'
import {
  Sql,
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  like,
  not,
  notInArray,
  or
} from 'rado'
import {Builder} from 'rado/core/Builder'
import xxhash from 'xxhash-wasm'
import {EntryPhase, EntryRow, entryVersionId} from '../core/EntryRow.js'
import {AuthedContext, Target} from './Backend.js'
import {Source} from './Source.js'
import {Store} from './Store.js'
import {Change, ChangeType} from './data/ChangeSet.js'
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

function seedKey(workspace: string, root: string, filePath: string) {
  return `${workspace}.${root}.${filePath}`
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
      const insert = await tx
        .select()
        .from(EntryRow)
        .where(notInArray(EntryRow.rowHash, contentHashes))

      const keep = new Set(
        await tx
          .select(EntryRow.rowHash)
          .from(EntryRow)
          .where(inArray(EntryRow.rowHash, contentHashes))
      )
      const remove = contentHashes.filter(hash => !keep.has(hash))
      return {insert, remove}
    })
  }

  async contentHashes() {
    return this.store.select(EntryRow.rowHash).from(EntryRow)
  }

  // Syncs data with a remote database, returning the i18nIds of changed entries
  async syncWith(remote: Syncable, force = false): Promise<Array<string>> {
    await this.init()
    const meta = await this.meta()
    const isRequired = force || (await remote.syncRequired(meta.contentHash))
    if (!isRequired) return []
    const {insert, remove} = await remote.sync(await this.contentHashes())
    return this.store.transaction(async tx => {
      const removed = await tx
        .select(EntryRow.i18nId)
        .from(EntryRow)
        .where(inArray(EntryRow.rowHash, remove))
      await tx.delete(EntryRow).where(inArray(EntryRow.rowHash, remove))
      const changed = []
      for (const entry of insert) {
        await tx.insert(EntryRow).values(entry)
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

  private async applyPublish(tx: Store, entry: EntryRow) {
    const next = publishEntryRow(this.config, entry)
    await tx
      .update(EntryRow)
      .set({
        phase: EntryPhase.Published,
        filePath: next.filePath,
        parentDir: next.parentDir,
        childrenDir: next.childrenDir,
        url: next.url
      })
      .where(
        eq(EntryRow.entryId, entry.entryId),
        eq(EntryRow.phase, entry.phase)
      )

    return this.updateChildren(tx, entry, next)
  }

  private async updateChildren(tx: Store, previous: EntryRow, next: EntryRow) {
    const {childrenDir: dir} = previous
    if (next.phase !== EntryPhase.Published || dir === next.childrenDir)
      return []
    const children = await tx
      .select()
      .from(EntryRow)
      .where(
        or(eq(EntryRow.parentDir, dir), like(EntryRow.childrenDir, `${dir}/%`))
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
      await tx
        .update(EntryRow)
        .set({
          filePath,
          childrenDir,
          parentDir,
          url
        })
        .where(
          eq(EntryRow.entryId, child.entryId),
          eq(EntryRow.phase, child.phase)
        )
    }
    return children
  }

  async logEntries() {
    const entries = await this.store
      .select()
      .from(EntryRow)
      .orderBy(asc(EntryRow.url), asc(EntryRow.index))
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
    tx: Store,
    mutation: Mutation
  ): Promise<(() => Promise<Array<string>>) | undefined> {
    switch (mutation.type) {
      case MutationType.Create: {
        const condition = and(
          eq(EntryRow.entryId, mutation.entryId),
          eq(EntryRow.phase, mutation.entry.phase)
        )
        const current = await tx.select().from(EntryRow).where(condition).get()
        if (current) return
        await tx.insert(EntryRow).values(mutation.entry)
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Edit: {
        const {entryId, entry} = mutation
        const condition = and(
          eq(EntryRow.entryId, entryId),
          eq(EntryRow.phase, entry.phase)
        )
        const current = await tx.select().from(EntryRow).where(condition).get()
        await tx.delete(EntryRow).where(condition)
        await tx.insert(EntryRow).values(entry)
        let children: Array<EntryRow> = []
        if (entry.phase === EntryPhase.Published) {
          if (current) children = await this.updateChildren(tx, current, entry)
        }
        return () => {
          return this.updateHash(tx, condition).then(self =>
            this.updateHash(
              tx,
              inArray(
                EntryRow.entryId,
                children.map(e => e.entryId)
              )
            ).then(children => self.concat(children))
          )
        }
      }
      case MutationType.Patch: {
        const {patch} = mutation
        const condition = and(
          eq(EntryRow.entryId, mutation.entryId),
          eq(EntryRow.main, true)
        )
        const current = await tx.select().from(EntryRow).where(condition).get()
        if (current)
          await tx
            .update(EntryRow)
            .set({data: {...current.data, patch}})
            .where(condition)
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Archive: {
        const archived = and(
          eq(EntryRow.entryId, mutation.entryId),
          eq(EntryRow.phase, EntryPhase.Archived)
        )
        const condition = and(
          eq(EntryRow.entryId, mutation.entryId),
          eq(EntryRow.phase, EntryPhase.Published)
        )
        const published = await tx
          .select()
          .from(EntryRow)
          .where(condition)
          .get()
        if (!published) return
        const filePath =
          published.filePath.slice(0, -5) + `.${EntryPhase.Archived}.json`
        await tx.delete(EntryRow).where(archived)
        await tx
          .update(EntryRow)
          .set({
            phase: EntryPhase.Archived,
            filePath
          })
          .where(condition)
        return () => this.updateHash(tx, archived)
      }
      case MutationType.Publish: {
        const promoting = await tx
          .select()
          .from(EntryRow)
          .where(
            and(
              eq(EntryRow.entryId, mutation.entryId),
              eq(EntryRow.phase, mutation.phase)
            )
          )
          .get()
        if (!promoting) return
        const condition = and(
          eq(EntryRow.entryId, mutation.entryId),
          eq(EntryRow.phase, EntryPhase.Published)
        )
        await tx.delete(EntryRow).where(condition)
        const children = await this.applyPublish(tx, promoting)
        return () =>
          this.updateHash(tx, condition).then(rows => {
            return this.updateHash(
              tx,
              inArray(
                EntryRow.entryId,
                children.map(e => e.entryId)
              )
            ).then(r => rows.concat(r))
          })
      }
      case MutationType.FileRemove:
        if (mutation.replace) return
      case MutationType.Remove: {
        const phases = await tx
          .select()
          .from(EntryRow)
          .where(eq(EntryRow.entryId, mutation.entryId))
        if (phases.length === 0) return
        // Remove child entries
        for (const phase of phases) {
          await tx
            .delete(EntryRow)
            .where(
              or(
                eq(EntryRow.parentDir, phase.childrenDir),
                like(EntryRow.childrenDir, phase.childrenDir + '/%')
              )
            )
        }
        await tx.delete(EntryRow).where(eq(EntryRow.entryId, mutation.entryId))
        return async () => [phases[0].i18nId]
      }
      case MutationType.Discard: {
        const existing = await tx
          .select()
          .from(EntryRow)
          .where(eq(EntryRow.entryId, mutation.entryId))
          .get()
        if (!existing) return
        await tx
          .delete(EntryRow)
          .where(
            and(
              eq(EntryRow.entryId, mutation.entryId),
              eq(EntryRow.phase, EntryPhase.Draft)
            )
          )
        return async () => [existing.i18nId]
      }
      case MutationType.Order: {
        const condition = eq(EntryRow.entryId, mutation.entryId)
        // Todo: apply this to other languages too
        await tx.update(EntryRow).set({index: mutation.index}).where(condition)
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Move: {
        const condition = eq(EntryRow.entryId, mutation.entryId)
        await tx
          .update(EntryRow)
          .set({
            index: mutation.index,
            parent: mutation.parent,
            workspace: mutation.workspace,
            root: mutation.root
          })
          .where(condition)
        // Todo: update file & children paths
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Upload: {
        // Until this mutation is applied the uploaded file won't be locally
        // available so the preview url is used. The fileHash is updated so that
        // syncing to the client after a successful deploy will overwrite this
        // change.
        const condition = and(
          eq(EntryRow.entryId, mutation.entryId),
          eq(EntryRow.phase, EntryPhase.Published)
        )
        const existing = await tx.select().from(EntryRow).where(condition).get()
        if (!existing) return
        if (process.env.NODE_ENV !== 'development')
          await tx
            .update(EntryRow)
            .set({
              data: {
                ...existing.data,
                location: mutation.url,
                [MEDIA_LOCATION]: existing.data.location
              }
            })
            .where(condition)
        return () => this.updateHash(tx, condition)
      }
      default:
        throw unreachable(mutation)
    }
  }

  async updateHash(tx: Store, condition: Sql<boolean>) {
    const changed = []
    const entries = await tx.select().from(EntryRow).where(condition)
    for (const entry of entries) {
      const updated = await createEntryRow(this.config, entry)
      changed.push(updated.i18nId)
      await tx
        .update(EntryRow)
        .set({
          fileHash: updated.fileHash,
          rowHash: updated.rowHash
        })
        .where(
          eq(EntryRow.entryId, entry.entryId),
          eq(EntryRow.phase, entry.phase)
        )
    }
    return changed
  }

  async meta() {
    return (
      (await this.store.select().from(AlineaMeta).get()) ?? {
        revisionId: '',
        commitHash: '',
        contentHash: '',
        modifiedAt: 0
      }
    )
  }

  static async index(tx: Store) {
    const Parent = alias(EntryRow, 'Parent')
    const parent = tx
      .select(Parent.entryId)
      .from(Parent)
      .where(
        eq(Parent.childrenDir, EntryRow.parentDir),
        eq(Parent.workspace, EntryRow.workspace),
        eq(Parent.root, EntryRow.root)
      )
    const res = await tx.update(EntryRow).set({
      parent,
      active: EntryRealm.isActive,
      main: EntryRealm.isMain
    })
    return res
  }

  private async writeMeta(tx: Store, commitHash: string) {
    const {create32} = await xxhash()
    let hash = create32()
    const contentHashes = await tx
      .select(EntryRow.rowHash)
      .from(EntryRow)
      .orderBy(EntryRow.rowHash)
    for (const c of contentHashes) hash = hash.update(c)
    const contentHash = hash.digest().toString(16).padStart(8, '0')
    const modifiedAt = await tx
      .select(EntryRow.modifiedAt)
      .from(EntryRow)
      .orderBy(desc(EntryRow.modifiedAt))
      .get()
    const current = await tx.select().from(AlineaMeta).get()
    await tx.delete(AlineaMeta)
    await tx.insert(AlineaMeta).values({
      revisionId: current?.revisionId ?? createId(),
      commitHash,
      contentHash,
      modifiedAt: modifiedAt ?? 0
    })
  }

  inited = false
  async init() {
    if (this.inited) return
    this.inited = true
    try {
      await this.store
        .transaction(async tx => {
          await tx.create(EntryRow, AlineaMeta)
          await createEntrySearch(tx)
        })
        .catch(() => {})
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
    const {meta: recordMeta, data} = parseRecord(record)
    const typeName = recordMeta.type
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

    if (!recordMeta.entryId) throw new Error(`missing id`)

    const urlMeta: EntryUrlMeta = {
      locale,
      parentPaths: segments,
      path: entryPath,
      phase: entryPhase
    }

    const pathData = entryPath === 'index' ? '' : entryPath
    const seedData = seed ? PageSeed.data(seed.page).partial : {}
    const title = record.title ?? seedData?.title ?? ''
    const entryData = Type.toV1(type, {
      ...seedData,
      ...data,
      title,
      path: pathData
    })
    const searchableText = Type.searchableText(type, entryData)
    return {
      workspace: meta.workspace,
      root: meta.root,
      filePath: meta.filePath,
      seeded: seed?.filePath ?? null,

      modifiedAt: Date.now(), // file.modifiedAt,
      active: false,
      main: false,

      entryId: recordMeta.entryId,
      phase: entryPhase,
      type: recordMeta.type,

      parentDir,
      childrenDir,
      parent: null,
      level: parentDir === '/' ? 0 : segments.length,
      index: recordMeta.index,
      locale,
      i18nId: recordMeta.i18nId ?? recordMeta.entryId,

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
            const key = seedKey(workspaceName, rootName, filePath)
            res.set(key, {
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
    target?: Target,
    // If the generated json is different from the source, the source will be
    // updated with the generated json
    fix = false
  ): Promise<void> {
    if (fix && !target) throw new TypeError(`Target expected if fix is true`)
    // Todo: run a validation step for orders, paths, id matching on statuses
    // etc
    await this.init()
    const typeNames = Schema.typeNames(this.config.schema)
    const publishSeed: Array<EntryRow> = []

    await this.store.transaction(async tx => {
      const seenVersions: Array<string> = []
      const seenSeeds = new Set<string>()
      const inserted = []
      //const endScan = timer('Scanning entries')
      const changes: Array<Change> = []
      for await (const file of source.entries()) {
        const fileHash = await createFileHash(file.contents)
        const exists = await tx
          .select({
            versionId: entryVersionId(),
            seeded: EntryRow.seeded
          })
          .from(EntryRow)

          .where(
            eq(EntryRow.filePath, file.filePath),
            eq(EntryRow.workspace, file.workspace),
            eq(EntryRow.root, file.root),
            eq(EntryRow.fileHash, fileHash)
          )
          .get()

        // Todo: a config change but unchanged entry data will currently
        // fly under the radar
        if (!fix && exists) {
          seenVersions.push(exists.versionId)
          const key = seedKey(
            file.workspace,
            file.root,
            exists.seeded ?? file.filePath
          )
          seenSeeds.add(key)
          continue
        }
        try {
          const raw = JsonLoader.parse(this.config.schema, file.contents)
          const {meta, data} = parseRecord(raw)
          const seeded = meta.seeded
          const key = seedKey(
            file.workspace,
            file.root,
            typeof seeded === 'string' ? seeded : file.filePath
          )
          const seed = this.seed.get(key)
          const record = createRecord({...meta, data})
          const entry = this.computeEntry(record, file, seed)
          const withHash: EntryRow = {...entry, fileHash, rowHash: ''}
          if (fix) {
            const fileContents = JsonLoader.format(this.config.schema, record)
            const newHash = await createFileHash(fileContents)
            if (fileHash !== newHash) {
              const workspace = this.config.workspaces[entry.workspace]
              const file = paths.join(
                Workspace.data(workspace).source,
                entry.root,
                entry.filePath
              )
              const record = createRecord(entry)
              const contents = new TextDecoder().decode(
                JsonLoader.format(this.config.schema, record)
              )
              changes.push({
                type: ChangeType.Write,
                file,
                contents
              })
            }
          }
          await tx
            .delete(EntryRow)
            .where(
              eq(EntryRow.entryId, entry.entryId),
              eq(EntryRow.phase, entry.phase)
            )
          seenSeeds.add(key)
          await tx.insert(EntryRow).values(withHash)
          seenVersions.push(`${entry.entryId}.${entry.phase}`)
          inserted.push(`${entry.entryId}.${entry.phase}`)
        } catch (e: any) {
          console.log(`> skipped ${file.filePath} — ${e.message}`)
          console.error(e)
          process.exit(1)
        }
      }
      if (fix && changes.length > 0)
        await target!.mutate({} as AuthedContext, {
          commitHash: '',
          mutations: [{changes, meta: undefined!}]
        })
      const stableI18nIds = new Map<string, string>()
      for (const seed of this.seed.values()) {
        const key = seedKey(seed.workspace, seed.root, seed.filePath)
        if (seenSeeds.has(key)) continue
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
          createRecord({
            entryId: createId(),
            i18nId,
            type: typeName,
            index: 'a0',
            seeded: seed.filePath,
            title: partial.title ?? '',
            data: partial
          }),
          seed,
          seed
        )
        const record = createRecord(entry)
        const fileContents = JsonLoader.format(this.config.schema, record)
        const fileHash = await createFileHash(fileContents)
        const withHash = {...entry, fileHash, rowHash: ''}
        await tx.insert(EntryRow).values(withHash)
        seenVersions.push(`${withHash.entryId}.${withHash.phase}`)
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

      const removeCondition = notInArray(entryVersionId(EntryRow), seenVersions)
      const rowsAffected = await tx
        .select(count())
        .from(EntryRow)
        .where(removeCondition)
        .get()
      await tx.delete(EntryRow).where(removeCondition)
      const removed = rowsAffected ?? 0

      const noChanges = inserted.length === 0 && removed === 0
      if (noChanges) return
      // if (inserted) console.log(`> updated ${inserted} entries`)
      // if (removed) console.log(`> removed ${removed} entries`)

      //const endIndex = timer('Indexing entries')
      await Database.index(tx)
      const entries = await tx
        .select()
        .from(EntryRow)
        .where(inArray(entryVersionId(EntryRow), inserted))
      for (const entry of entries) {
        const rowHash = await createRowHash(entry)
        await tx
          .update(EntryRow)
          .set({
            rowHash
          })
          .where(
            eq(EntryRow.entryId, entry.entryId),
            eq(EntryRow.phase, entry.phase)
          )
      }
      await this.writeMeta(tx, commitHash)
    })

    if (target && publishSeed.length > 0) {
      const changes = publishSeed.map((seed): Change => {
        const workspace = this.config.workspaces[seed.workspace]
        const file = paths.join(
          Workspace.data(workspace).source,
          seed.root,
          seed.filePath
        )
        const record = createRecord(seed)
        const contents = new TextDecoder().decode(
          JsonLoader.format(this.config.schema, record)
        )
        return {type: ChangeType.Write, file, contents}
      })
      await target.mutate({} as AuthedContext, {
        commitHash: '',
        mutations: [{changes, meta: undefined!}]
      })
    }
  }
}

namespace EntryRealm {
  const builder = new Builder()
  const Alt = alias(EntryRow, 'Alt')
  const isDraft = eq(EntryRow.phase, EntryPhase.Draft)
  const isArchived = eq(EntryRow.phase, EntryPhase.Archived)
  const isPublished = eq(EntryRow.phase, EntryPhase.Published)
  const hasDraft = exists(
    builder
      .select()
      .from(Alt)
      .where(eq(Alt.phase, EntryPhase.Draft), eq(Alt.entryId, EntryRow.entryId))
  )
  const hasPublished = exists(
    builder
      .select()
      .from(Alt)
      .where(
        eq(Alt.phase, EntryPhase.Published),
        eq(Alt.entryId, EntryRow.entryId)
      )
  )
  const hasArchived = exists(
    builder
      .select()
      .from(Alt)
      .where(
        eq(Alt.phase, EntryPhase.Archived),
        eq(Alt.entryId, EntryRow.entryId)
      )
  )
  const isPublishedWithoutDraft = and(isPublished, not(hasDraft))
  const isArchivedWithoutDraftOrPublished = and(
    isArchived,
    not(hasDraft),
    not(hasPublished)
  )
  export const isActive = or(
    isDraft,
    isPublishedWithoutDraft,
    isArchivedWithoutDraftOrPublished
  )
  const isArchivedWithoutPublished = and(isArchived, not(hasPublished))
  const isDraftWithoutPublishedOrArchived = and(
    isDraft,
    not(hasPublished),
    not(hasArchived)
  )
  export const isMain = or(
    isPublished,
    isArchivedWithoutPublished,
    isDraftWithoutPublishedOrArchived
  )
}
