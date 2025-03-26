import type {Config} from 'alinea/core/Config'
import type {SyncResponse, Syncable} from 'alinea/core/Connection'
import {
  type EntryRecord,
  createRecord,
  parseRecord
} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {getRoot} from 'alinea/core/Internal'
import {type Mutation, MutationType} from 'alinea/core/Mutation'
import {Page} from 'alinea/core/Page'
import type {Resolver} from 'alinea/core/Resolver'
import {Root} from 'alinea/core/Root'
import {Schema} from 'alinea/core/Schema'
import {type EntryUrlMeta, Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {MEDIA_LOCATION} from 'alinea/core/media/MediaLocation'
import {createFileHash, createRowHash} from 'alinea/core/util/ContentHash'
import {entryFile, entryInfo, entryUrl} from 'alinea/core/util/EntryFilenames'
import {createEntryRow, publishEntryRow} from 'alinea/core/util/EntryRows'
import {entries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {unreachable} from 'alinea/core/util/Types'
import {
  type Sql,
  alias,
  and,
  asc,
  count,
  eq,
  exists,
  inArray,
  like,
  not,
  notInArray,
  or,
  sql
} from 'rado'
import {Builder} from 'rado/core/Builder'
import {Functions} from 'rado/core/expr/Functions'
import {coalesce} from 'rado/sqlite'
import {EntryRow} from '../core/EntryRow.js'
import type {AuthedContext, Target} from './Backend.js'
import type {Source} from './Source.js'
import type {Store} from './Store.js'
import {type Change, ChangeType} from './data/ChangeSet.js'
import {AlineaMeta} from './db/AlineaMeta.js'
import {createEntrySearch} from './db/CreateEntrySearch.js'
import {JsonLoader} from './loader/JsonLoader.js'
import {EntryResolver} from './resolver/EntryResolver.js'
import {is, values} from './util/ORM.js'

interface Seed {
  type: string
  workspace: string
  root: string
  filePath: string
  page: Page
}

type EntryKeys = [id: string, locale: string, status: string]

function seedKey(workspace: string, root: string, filePath: string) {
  return `${workspace}.${root}.${filePath}`
}

export class Database implements Syncable {
  seed: Map<string, Seed>
  resolver: Resolver

  constructor(
    public config: Config,
    public store: Store
  ) {
    this.seed = this.seedData()
    this.resolver = new EntryResolver(this)
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
        .select(EntryRow.id)
        .from(EntryRow)
        .where(inArray(EntryRow.rowHash, remove))
      await tx.delete(EntryRow).where(inArray(EntryRow.rowHash, remove))
      const changed = []
      for (const entry of insert) {
        await tx.insert(EntryRow).values(entry)
        changed.push(entry.id)
      }
      await Database.index(tx)
      // This is for a local db, we didn't receive a commit hash here
      await this.writeMeta(tx, meta.commitHash)
      return removed.concat(changed)
    })
  }

  async applyMutations(mutations: Array<Mutation>, commitHash?: string) {
    const hash = commitHash ?? (await this.meta()).commitHash
    if (mutations.length === 0) {
      if (commitHash) await this.writeMeta(this.store, commitHash)
      return []
    }
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
        status: 'published',
        filePath: next.filePath,
        parentDir: next.parentDir,
        childrenDir: next.childrenDir,
        url: next.url
      })
      .where(
        eq(EntryRow.id, entry.id),
        is(EntryRow.locale, entry.locale),
        eq(EntryRow.status, entry.status)
      )
    return this.updateChildren(tx, entry, next)
  }

  private async updateChildren(tx: Store, previous: EntryRow, next: EntryRow) {
    const {childrenDir: dir} = previous
    const publishing = next.status === 'published'
    const unarchive = previous.status === 'archived'
    const pathChanged = dir !== next.childrenDir
    const needsUpdate = publishing && (unarchive || pathChanged)
    if (!needsUpdate) return []
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
      const extension = paths.extname(child.filePath)
      const fileName = paths.basename(child.filePath, extension)
      const [, status] = entryInfo(fileName)
      await tx
        .update(EntryRow)
        .set({
          filePath,
          childrenDir,
          parentDir,
          url,
          status
        })
        .where(
          eq(EntryRow.id, child.id),
          is(EntryRow.locale, child.locale),
          eq(EntryRow.status, child.status)
        )
    }
    return children
  }

  async logEntries() {
    const entries = await this.store
      .select({
        id: EntryRow.id,
        url: EntryRow.url,
        locale: EntryRow.locale,
        status: EntryRow.status,
        title: EntryRow.title,
        filePath: EntryRow.filePath
      })
      .from(EntryRow)
      .orderBy(asc(EntryRow.url), asc(EntryRow.index))
    console.table(entries)
  }

  private async applyMutation(
    tx: Store,
    mutation: Mutation
  ): Promise<(() => Promise<Array<string>>) | undefined> {
    switch (mutation.type) {
      case MutationType.Create: {
        const {entry} = mutation
        let status = entry.status
        if (entry.parentId) {
          const parent = await tx
            .select()
            .from(EntryRow)
            .where(
              eq(EntryRow.id, entry.parentId),
              is(EntryRow.locale, mutation.locale),
              is(EntryRow.main, true)
            )
            .get()
          status = parent?.status ?? status
        }
        const condition = and(
          eq(EntryRow.id, mutation.entryId),
          eq(EntryRow.status, mutation.entry.status),
          is(EntryRow.locale, mutation.entry.locale)
        )
        const current = await tx.select().from(EntryRow).where(condition).get()
        if (current) return
        await tx.insert(EntryRow).values({...mutation.entry, status})
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Edit: {
        const {entryId, entry} = mutation
        const condition = and(
          eq(EntryRow.id, entryId),
          eq(EntryRow.status, entry.status),
          is(EntryRow.locale, entry.locale)
        )
        const current = await tx.select().from(EntryRow).where(condition).get()
        await tx.delete(EntryRow).where(condition)
        await tx.insert(EntryRow).values(entry)
        let children: Array<EntryRow> = []
        if (entry.status === 'published' && current)
          children = await this.updateChildren(tx, current, entry)
        return () => {
          return this.updateHash(tx, condition).then(self =>
            this.updateHash(
              tx,
              and(
                is(EntryRow.locale, entry.locale),
                inArray(
                  EntryRow.id,
                  children.map(e => e.id)
                )
              )
            ).then(children => self.concat(children))
          )
        }
      }
      case MutationType.Patch: {
        const {patch} = mutation
        const condition = and(
          eq(EntryRow.id, mutation.entryId),
          is(EntryRow.locale, mutation.locale),
          eq(EntryRow.main, true)
        )
        await tx
          .update(EntryRow)
          .set({
            data: Functions.json_patch(EntryRow.data, JSON.stringify(patch))
          })
          .where(condition)
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Archive: {
        const archived = and(
          eq(EntryRow.id, mutation.entryId),
          is(EntryRow.locale, mutation.locale),
          eq(EntryRow.status, 'archived')
        )
        const condition = and(
          eq(EntryRow.id, mutation.entryId),
          is(EntryRow.locale, mutation.locale),
          eq(EntryRow.status, 'published')
        )
        const published = await tx
          .select()
          .from(EntryRow)
          .where(condition)
          .get()
        if (!published) return
        const filePath = `${published.filePath.slice(0, -5)}.${'archived'}.json`
        await tx.delete(EntryRow).where(archived)
        await tx
          .update(EntryRow)
          .set({status: 'archived', filePath})
          .where(condition)
        const children = await tx
          .update(EntryRow)
          .set({status: 'archived'})
          .where(
            eq(EntryRow.status, 'published'),
            or(
              eq(EntryRow.parentDir, published.childrenDir),
              like(EntryRow.childrenDir, `${published.childrenDir}/%`)
            )
          )
          .returning(EntryRow.id)
        return () =>
          this.updateHash(tx, or(archived, inArray(EntryRow.id, children)))
      }
      case MutationType.Publish: {
        const promoting = await tx
          .select()
          .from(EntryRow)
          .where(
            and(
              eq(EntryRow.id, mutation.entryId),
              is(EntryRow.locale, mutation.locale),
              eq(EntryRow.status, mutation.status)
            )
          )
          .get()
        if (!promoting) return
        const condition = and(
          eq(EntryRow.id, mutation.entryId),
          is(EntryRow.locale, mutation.locale),
          eq(EntryRow.status, 'published')
        )
        await tx.delete(EntryRow).where(condition)
        const children = await this.applyPublish(tx, promoting)
        return () =>
          this.updateHash(tx, condition).then(rows => {
            return this.updateHash(
              tx,
              and(
                is(EntryRow.locale, mutation.locale),
                inArray(
                  EntryRow.id,
                  children.map(e => e.id)
                )
              )
            ).then(r => rows.concat(r))
          })
      }
      case MutationType.RemoveFile:
        if (mutation.replace) return
      case MutationType.RemoveEntry: {
        const statuses = await tx
          .select()
          .from(EntryRow)
          .where(
            eq(EntryRow.id, mutation.entryId),
            is(EntryRow.locale, mutation.locale)
          )
        if (statuses.length === 0) return
        // Remove child entries
        for (const status of statuses) {
          await tx
            .delete(EntryRow)
            .where(
              or(
                eq(EntryRow.parentDir, status.childrenDir),
                like(EntryRow.childrenDir, `${status.childrenDir}/%`)
              )
            )
        }
        await tx
          .delete(EntryRow)
          .where(
            eq(EntryRow.id, mutation.entryId),
            is(EntryRow.locale, mutation.locale)
          )
        return async () => [statuses[0].id]
      }
      case MutationType.RemoveDraft: {
        const existing = await tx
          .select()
          .from(EntryRow)
          .where(
            eq(EntryRow.id, mutation.entryId),
            is(EntryRow.locale, mutation.locale)
          )
          .get()
        if (!existing) return
        await tx
          .delete(EntryRow)
          .where(
            and(
              eq(EntryRow.id, mutation.entryId),
              is(EntryRow.locale, mutation.locale),
              eq(EntryRow.status, 'draft')
            )
          )
        return async () => [existing.id]
      }
      case MutationType.Order: {
        const condition = and(eq(EntryRow.id, mutation.entryId))
        await tx.update(EntryRow).set({index: mutation.index}).where(condition)
        return () => this.updateHash(tx, condition)
      }
      case MutationType.Move: {
        const condition = eq(EntryRow.id, mutation.entryId)
        await tx
          .update(EntryRow)
          .set({
            index: mutation.index,
            parentId: mutation.parent,
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
          eq(EntryRow.id, mutation.entryId),
          eq(EntryRow.status, 'published')
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
      changed.push(updated.id)
      await tx
        .update(EntryRow)
        .set({
          fileHash: updated.fileHash,
          rowHash: updated.rowHash
        })
        .where(
          eq(EntryRow.id, entry.id),
          is(EntryRow.locale, entry.locale),
          eq(EntryRow.status, entry.status)
        )
    }
    return changed
  }

  async meta() {
    return (
      (await this.store.select().from(AlineaMeta).get()) ?? {
        commitHash: '',
        contentHash: '',
        modifiedAt: 0
      }
    )
  }

  static async index(tx: Store) {
    const Parent = alias(EntryRow, 'Parent')
    const parent = tx
      .select(Parent.id)
      .from(Parent)
      .where(
        eq(Parent.childrenDir, EntryRow.parentDir),
        eq(Parent.workspace, EntryRow.workspace),
        eq(Parent.root, EntryRow.root)
      )
    const res = await tx.update(EntryRow).set({
      parentId: parent,
      active: EntryRealm.isActive,
      main: EntryRealm.isMain
    })
    return res
  }

  private async writeMeta(tx: Store, commitHash: string) {
    const contentHashes = await tx
      .select(EntryRow.rowHash)
      .from(EntryRow)
      .orderBy(EntryRow.rowHash)
    const all = contentHashes.join('')
    const contentHash = await createFileHash(new TextEncoder().encode(all))
    await tx.delete(AlineaMeta)
    await tx.insert(AlineaMeta).values({
      commitHash,
      contentHash
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
    const [entryPath, entryStatus] = entryInfo(fileName)
    const segments = parentDir.split('/').filter(Boolean)
    const root = this.config.workspaces[meta.workspace][meta.root]
    let locale: string | null = null

    if (getRoot(root).i18n) {
      const inSegment = segments.shift()!
      locale = Root.localeName(root, inSegment) ?? null
      if (!locale) throw new Error(`Invalid locale: "${inSegment}"`)
    }

    const type = this.config.schema[typeName]
    if (!type) throw new Error(`Invalid type: "${typeName}"`)
    if (seed && seed.type !== typeName)
      throw new Error(
        `Type mismatch between seed and file: "${seed.type}" !== "${typeName}"`
      )
    const childrenDir = paths.join(parentDir, entryPath)

    if (!recordMeta.id) throw new Error('missing id')

    const urlMeta: EntryUrlMeta = {
      locale,
      parentPaths: segments,
      path: entryPath,
      status: entryStatus
    }

    const pathData = entryPath === 'index' ? '' : entryPath
    const seedData = seed ? Page.data(seed.page).fields : {}
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

      active: false,
      main: false,

      id: recordMeta.id,
      status: entryStatus,
      type: recordMeta.type,

      parentDir,
      childrenDir,
      parentId: null,
      level: parentDir === '/' ? 0 : segments.length,
      index: recordMeta.index,
      locale,

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
          const pages: Array<readonly [string, Page]> = entries(root)
          const target = locale ? `/${locale.toLowerCase()}` : '/'
          while (pages.length > 0) {
            const [pagePath, page] = pages.shift()!
            const path = pagePath.split('/').map(slugify).join('/')
            if (!Page.isPage(page)) continue
            const {type} = Page.data(page)
            const filePath = `${paths.join(target, path)}.json`
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
                [paths.join(path, childPath), child as Page] as const
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
    const v0Ids = new Map<string, string>()
    if (fix && !target) throw new TypeError('Target expected if fix is true')
    // Todo: run a validation step for orders, paths, id matching on statuses
    // etc
    await this.init()
    const typeNames = Schema.typeNames(this.config.schema)
    const publishSeed: Array<EntryRow> = []

    await this.store.transaction(async tx => {
      const seenVersions: Array<EntryKeys> = []
      const seenSeeds = new Map<string, string>()
      const inserted: Array<EntryKeys> = []
      //const endScan = timer('Scanning entries')
      const changes: Array<Change> = []
      for await (const file of source.entries()) {
        const fileHash = await createFileHash(file.contents)
        const exists = await tx
          .select({
            id: EntryRow.id,
            locale: EntryRow.locale,
            status: EntryRow.status,
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
          seenVersions.push([exists.id, exists.locale ?? 'null', exists.status])
          const key = seedKey(
            file.workspace,
            file.root,
            exists.seeded ?? file.filePath
          )
          seenSeeds.set(key, exists.id)
          continue
        }
        try {
          const raw = JsonLoader.parse(this.config.schema, file.contents)
          const {meta, data, v0Id} = parseRecord(raw)
          if (v0Id) v0Ids.set(v0Id, meta.id)
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
              eq(EntryRow.id, entry.id),
              is(EntryRow.locale, entry.locale),
              eq(EntryRow.status, entry.status)
            )
          seenSeeds.set(key, entry.id)
          await tx.insert(EntryRow).values(withHash)
          seenVersions.push([entry.id, entry.locale ?? 'null', entry.status])
          inserted.push([entry.id, entry.locale ?? 'null', entry.status])
        } catch (e: any) {
          // Reminder: this runs browser side too so cannot use reportHalt here
          console.warn(`${e.message} @ ${file.filePath}`)
          process.exit(1)
        }
      }
      if (fix && v0Ids.size > 0) {
        const entries = await tx.select().from(EntryRow)
        for (const entry of entries) {
          const file = entryFile(this.config, entry)
          entry.data = JSON.parse(JSON.stringify(entry.data), (key, value) => {
            if (key === '_entry') return v0Ids.get(value) ?? value
            return value
          })
          const contents = new TextDecoder().decode(
            JsonLoader.format(this.config.schema, createRecord(entry))
          )
          changes.push({
            type: ChangeType.Write,
            file,
            contents
          })
        }
      }
      if (fix && changes.length > 0)
        await target!.mutate({} as AuthedContext, {
          commitHash: '',
          mutations: [{changes, meta: undefined!}]
        })
      const stableIds = new Map<string, string>()
      for (const seed of this.seed.values()) {
        const key = seedKey(seed.workspace, seed.root, seed.filePath)
        const [, locale, ...rest] = seed.filePath.split('/')
        const withoutLocale = rest.join('/')
        if (seenSeeds.has(key)) {
          stableIds.set(withoutLocale, seenSeeds.get(key)!)
          continue
        }
        const {type, fields} = Page.data(seed.page)
        const typeName = typeNames.get(type)
        if (!typeName) continue
        const root = this.config.workspaces[seed.workspace][seed.root]
        const {i18n} = Root.data(root)
        let id = createId()
        if (i18n) {
          id = stableIds.get(withoutLocale) ?? createId()
          stableIds.set(withoutLocale, id)
        }
        const entry = this.computeEntry(
          createRecord({
            id,
            type: typeName,
            index: 'a0',
            seeded: seed.filePath,
            title: fields.title ?? '',
            data: fields
          }),
          seed,
          seed
        )
        const record = createRecord(entry)
        const fileContents = JsonLoader.format(this.config.schema, record)
        const fileHash = await createFileHash(fileContents)
        const withHash = {...entry, fileHash, rowHash: ''}
        await tx.insert(EntryRow).values(withHash)
        seenVersions.push([entry.id, entry.locale ?? 'null', entry.status])
        inserted.push([entry.id, entry.locale ?? 'null', entry.status])
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

      const removeCondition = sql<boolean>`(${EntryRow.id}, ${coalesce(
        EntryRow.locale,
        sql`'null'`
      )}, ${EntryRow.status}) not in ${values(...seenVersions)}`
      const rowsAffected = await tx
        .select(count())
        .from(EntryRow)
        .where(removeCondition)
        .get()
      if (rowsAffected! > 0) await tx.delete(EntryRow).where(removeCondition)
      const removed = rowsAffected ?? 0
      const noChanges = inserted.length === 0 && removed === 0
      if (noChanges) return

      await Database.index(tx)

      if (inserted.length > 0) {
        const isInserted = sql<boolean>`(${EntryRow.id}, ${coalesce(
          EntryRow.locale,
          sql`'null'`
        )}, ${EntryRow.status}) in ${values(...inserted)}`
        const archivedPaths = await tx
          .select(EntryRow.childrenDir)
          .from(EntryRow)
          .where(eq(EntryRow.status, 'archived'))
        for (const archivedPath of archivedPaths) {
          const isChildOf = or(
            eq(EntryRow.parentDir, archivedPath),
            like(EntryRow.childrenDir, `${archivedPath}/%`)
          )
          await tx
            .update(EntryRow)
            .set({status: 'archived'})
            .where(isChildOf, eq(EntryRow.status, 'published'))
        }
        const entries = await tx.select().from(EntryRow).where(isInserted)
        for (const entry of entries) {
          const rowHash = await createRowHash(entry)
          await tx
            .update(EntryRow)
            .set({rowHash})
            .where(
              eq(EntryRow.id, entry.id),
              is(EntryRow.locale, entry.locale),
              eq(EntryRow.status, entry.status)
            )
        }
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

  async preview<T>(
    entry: EntryRow,
    query: (tx: Store) => Promise<T>
  ): Promise<T | undefined> {
    try {
      await this.store.transaction(async tx => {
        // Temporarily add preview entry
        await tx
          .delete(EntryRow)
          .where(
            eq(EntryRow.id, entry.id),
            is(EntryRow.locale, entry.locale),
            eq(EntryRow.active, true)
          )
        await tx.insert(EntryRow).values(entry)
        await Database.index(tx)
        const result = await query(tx)
        throw {result}
      })
    } catch (err: any) {
      if (err.result) return err.result as T
    }
  }
}

namespace EntryRealm {
  const builder = new Builder()
  const Alt = alias(EntryRow, 'Alt')
  const isDraft = eq(EntryRow.status, 'draft')
  const isArchived = eq(EntryRow.status, 'archived')
  const isPublished = eq(EntryRow.status, 'published')
  const hasDraft = exists(
    builder
      .select()
      .from(Alt)
      .where(
        eq(Alt.status, 'draft'),
        eq(Alt.locale, EntryRow.locale),
        eq(Alt.id, EntryRow.id)
      )
  )
  const hasPublished = exists(
    builder
      .select()
      .from(Alt)
      .where(
        eq(Alt.status, 'published'),
        eq(Alt.locale, EntryRow.locale),
        eq(Alt.id, EntryRow.id)
      )
  )
  const hasArchived = exists(
    builder
      .select()
      .from(Alt)
      .where(
        eq(Alt.status, 'archived'),
        eq(Alt.locale, EntryRow.locale),
        eq(Alt.id, EntryRow.id)
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
