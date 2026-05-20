import {Config as ConfigUtils, type Config} from '../Config.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import {Graph} from '../Graph.js'
import {createRecord} from '../EntryRecord.js'
import type {EntryStatus} from '../Entry.js'
import {createId} from '../Id.js'
import {getRoot} from '../Internal.js'
import {Permission, type Policy} from '../Role.js'
import type {Mutation} from '../db/Mutation.js'
import type {ChangesBatch} from '../source/Change.js'
import {hashBlob} from '../source/GitUtils.js'
import {bundleContents} from '../source/Source.js'
import type {RemoteSource} from '../source/Source.js'
import {ReadonlyTree, type WriteableTree} from '../source/Tree.js'
import {pathSuffix} from '../util/EntryFilenames.js'
import {
  generateKeyBetween,
  generateNKeysBetween
} from '../util/FractionalIndexing.js'
import {slugify} from '../util/Slugs.js'
import {assert} from '../util/Assert.js'
import * as paths from '../util/Paths.js'
import {
  compressRxbEntryBytes,
  createRxbEntryArtifactFromVersions,
  createRxbEntryVersionFromBlob,
  createRxbEntryVersionFromRow,
  decodeRxbEntryArtifact,
  decompressRxbEntryBytes,
  encodeRxbEntryArtifact,
  hydrateRxbEntryRowAt,
  rxbEntryInfoFromRowId,
  type RxbEntryArtifact,
  type RxbEntryRow,
  type RxbEntryVersion
} from './RxbEntryArtifact.js'
import {RxbEntryEngine} from './RxbEntryEngine.js'

export interface RxbEntryRollback {
  artifact: RxbEntryArtifact
  bytes?: Uint8Array
}

export interface RxbEntryApplyResult {
  sha: string
  rollback: RxbEntryRollback
}

export interface RxbEntryDBOptions {
  entryCacheSize?: number
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
}

export class RxbEntryDB extends Graph {
  readonly #options: RxbEntryDBOptions
  #artifact: RxbEntryArtifact
  #engine: RxbEntryEngine
  #bytes: Uint8Array | undefined

  constructor(
    public config: Config,
    bytes: Uint8Array,
    options: RxbEntryDBOptions = {}
  ) {
    super()
    this.#options = options
    this.#artifact = decodeRxbEntryArtifact(bytes)
    this.#engine = this.#createEngine(this.#artifact, bytes)
    this.#bytes = bytes
  }

  static open(
    config: Config,
    bytes: Uint8Array,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return new RxbEntryDB(config, bytes, options)
  }

  static async openCompressed(
    config: Config,
    encoded: string,
    options?: RxbEntryDBOptions
  ): Promise<RxbEntryDB> {
    return new RxbEntryDB(
      config,
      await decompressRxbEntryBytes(encoded),
      options
    )
  }

  static fromArtifact(
    config: Config,
    artifact: RxbEntryArtifact,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return new RxbEntryDB(config, encodeRxbEntryArtifact(artifact), options)
  }

  get sha(): string {
    return this.#artifact.meta.graphSha
  }

  get graphSha(): string {
    return this.#artifact.meta.graphSha
  }

  get artifact(): RxbEntryArtifact {
    return this.#artifact
  }

  get bytes(): Uint8Array {
    return this.exportBytes()
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#engine.query({
      query
    }) as Promise<AnyQueryResult<Query>>
  }

  async mutations(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    const rollback = this.checkpoint()
    const next = await applyMutationsToArtifact(
      this.config,
      this.#artifact,
      mutations,
      options
    )
    this.#replace(next)
    return {sha: this.sha, rollback}
  }

  async applyLocal(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    return this.mutations(mutations, options)
  }

  async syncWith(remote: RemoteSource): Promise<string> {
    const remoteTree = await remote.getTreeIfDifferent(this.#artifact.meta.graphSha)
    if (!remoteTree) return this.sha

    const localTree = ReadonlyTree.fromFlat(this.#artifact.payload.tree)
    const batch = await bundleContents(remote, localTree.diff(remoteTree))
    assertBundledRemoteChanges(batch)
    if (batch.changes.length === 0) return this.sha

    const {tree, versions} = await applyRemoteChangesToArtifact(
      this.config,
      this.#artifact,
      localTree,
      batch
    )
    const next = createRxbEntryArtifactFromVersions(
      this.config,
      tree,
      versions,
      {
        configHash: this.#artifact.meta.configHash,
        contentHash: tree.sha
      }
    )
    this.#replace(next)
    return this.sha
  }

  checkpoint(): RxbEntryRollback {
    return {
      artifact: this.#artifact,
      bytes: this.#bytes
    }
  }

  rollback(checkpoint: RxbEntryRollback): string {
    this.#replace(checkpoint.artifact, checkpoint.bytes)
    return this.sha
  }

  exportBytes(): Uint8Array {
    return (this.#bytes ??= encodeRxbEntryArtifact(this.#artifact))
  }

  exportCompressedBytes(): Promise<string> {
    return compressRxbEntryBytes(this.exportBytes())
  }

  #replace(
    artifact: RxbEntryArtifact,
    bytes?: Uint8Array
  ) {
    bytes ??= encodeRxbEntryArtifact(artifact)
    this.#artifact = artifact
    this.#engine = this.#createEngine(artifact, bytes)
    this.#bytes = bytes
  }

  #createEngine(
    artifact: RxbEntryArtifact,
    bytes?: Uint8Array
  ): RxbEntryEngine {
    return new RxbEntryEngine({
      config: this.config,
      artifact,
      bytes,
      entryCacheSize: this.#options.entryCacheSize,
      leafCacheSize: this.#options.leafCacheSize,
      planCacheSize: this.#options.planCacheSize,
      rowCacheSize: this.#options.rowCacheSize
    })
  }
}

async function applyMutationsToArtifact(
  config: Config,
  artifact: RxbEntryArtifact,
  mutations: Array<Mutation>,
  options: {policy?: Policy} = {}
): Promise<RxbEntryArtifact> {
  const tree = ReadonlyTree.fromFlat(artifact.payload.tree)
  const mutator = new RxbEntryMutator(
    config,
    tree,
    hydrateRowsFromArtifact(config, artifact, tree),
    options.policy
  )
  const {tree: nextTree, versions} = await mutator.apply(mutations)
  return createRxbEntryArtifactFromVersions(config, nextTree, versions, {
    configHash: artifact.meta.configHash,
    contentHash: nextTree.sha
  })
}

async function applyRemoteChangesToArtifact(
  config: Config,
  artifact: RxbEntryArtifact,
  tree: ReadonlyTree,
  batch: ChangesBatch
): Promise<{tree: ReadonlyTree; versions: Array<RxbEntryVersion>}> {
  const byPath = new Map(
    hydrateRowsFromArtifact(config, artifact, tree).map(row => [
      row.filePath,
      createRxbEntryVersionFromRow(row)
    ])
  )
  for (const change of batch.changes) {
    if (change.op === 'delete') {
      byPath.delete(change.path)
      continue
    }
    assert(change.contents, `Missing contents for ${change.path}`)
    byPath.set(
      change.path,
      createRxbEntryVersionFromBlob(
        config,
        change.path,
        change.sha,
        change.contents
      )
    )
  }
  return {
    tree: await tree.withChanges(batch),
    versions: Array.from(byPath.values())
  }
}

class RxbEntryMutator {
  #tree: ReadonlyTree
  #draft: WriteableTree
  #rows: Array<RxbEntryRow>
  #rowIndex: RxbEntryRowIndex
  #versionsByPath: Map<string, RxbEntryVersion>

  constructor(
    readonly config: Config,
    tree: ReadonlyTree,
    rows: Array<RxbEntryRow>,
    readonly policy?: Policy
  ) {
    this.#tree = tree
    this.#draft = tree.clone()
    this.#rows = rows
    this.#rowIndex = new RxbEntryRowIndex(this.#rows)
    this.#versionsByPath = new Map(
      this.#rows.map(row => [row.filePath, createRxbEntryVersionFromRow(row)])
    )
  }

  async apply(
    mutations: Array<Mutation>
  ): Promise<{tree: ReadonlyTree; versions: Array<RxbEntryVersion>}> {
    for (const mutation of mutations) {
      switch (mutation.op) {
        case 'create':
          await this.#create(mutation)
          break
        case 'update':
          await this.#update(mutation)
          break
        case 'publish':
          await this.#publish(mutation)
          break
        case 'unpublish':
          await this.#renameMainVersion(mutation.id, mutation.locale, 'draft')
          break
        case 'archive':
          await this.#renameMainVersion(
            mutation.id,
            mutation.locale,
            'archived'
          )
          break
        case 'move':
          await this.#move(mutation)
          break
        case 'remove':
          await this.#remove(mutation)
          break
        case 'uploadFile':
        case 'removeFile':
          break
      }
      await this.#refresh()
    }
    return {
      tree: this.#tree,
      versions: Array.from(this.#versionsByPath.values())
    }
  }

  async #create(mutation: Extract<Mutation, {op: 'create'}>) {
    let {workspace, root} = mutation
    const workspaces = Object.keys(this.config.workspaces)
    workspace ??= workspaces[0]
    assert(workspace in this.config.workspaces, `Workspace "${workspace}" not found in config`)
    const roots = Object.keys(this.config.workspaces[workspace])
    root ??= roots[0]
    assert(root in this.config.workspaces[workspace], `Root "${root}" not found in workspace "${workspace}"`)
    this.policy?.assert(Permission.Create, {
      workspace,
      root,
      type: mutation.type
    })
    this.#assertLocale(workspace, root, mutation.locale)
    const id = mutation.id ?? createId()
    const status = mutation.status ?? 'published'
    const existing = this.#rowIndex.entriesById(id)[0]
    const existingLanguage = existing
      ? this.#languageRows(id, mutation.locale)
      : []
    if (existing) {
      workspace = existing.workspace
      root = existing.root
    }
    const parentId = existing?.parentId ?? mutation.parentId ?? null
    const parent = parentId
      ? this.#mainRow(parentId, mutation.locale)
      : undefined
    if (parentId) {
      assert(parent, `Parent not found: ${parentId}`)
      this.policy?.assert(Permission.Create, parent)
    }
    assert(typeof mutation.data === 'object', 'Invalid data')
    const title = mutation.data.title ?? mutation.data.path
    assert(typeof title === 'string', 'Missing title')
    let path = slugify(
      typeof mutation.data.path === 'string' ? mutation.data.path : title
    )
    assert(path.length > 0, 'Invalid path')
    const existingPath = this.#mainRow(id, mutation.locale)?.path
    const hasSamePath = existingPath === path
    if (!hasSamePath)
      path = this.#availablePath({
        id,
        path,
        parentId,
        root,
        workspace,
        locale: mutation.locale
      })
    if (status !== 'published' && existingPath) path = existingPath
    if (existingPath && !hasSamePath && status === 'published')
      this.#renameLanguage(id, mutation.locale, path)
    if (existingLanguage.some(row => row.versionStatus === status))
      assert(mutation.overwrite, `Cannot create duplicate entry with id ${id}`)
    if (existing && status === 'published') {
      for (const row of existingLanguage) this.#removePath(row.filePath)
    }
    const siblings = this.#rowIndex.siblings(workspace, root, parentId)
    const insertOrder = mutation.insertOrder ?? 'last'
    const previous =
      insertOrder === 'first' ? null : (siblings.at(-1) ?? null)
    const next = insertOrder === 'last' ? null : (siblings.at(0) ?? null)
    const index = existing?.index ?? generateKeyBetween(
      previous?.index ?? null,
      next?.index ?? null
    )
    const parentDir = parent
      ? parent.childrenDir
      : ConfigUtils.filePath(this.config, workspace, root, mutation.locale)
    await this.#addRecord(
      paths.join(parentDir, `${path}${statusSuffix(status)}.json`),
      {
        id,
        type: mutation.type,
        index,
        root,
        path,
        title,
        seeded: mutation.fromSeed ?? existing?.seeded ?? null,
        parentId,
        data: mutation.data
      },
      status
    )
  }

  async #update(mutation: Extract<Mutation, {op: 'update'}>) {
    const entry = this.#versionRow(
      mutation.id,
      mutation.locale,
      mutation.status
    )
    assert(entry, `Entry not found: ${mutation.id}`)
    this.policy?.assert(Permission.Update, entry)
    const data = {
      ...entry.data,
      ...Object.fromEntries(
        Object.entries(mutation.set).map(([key, value]) => [key, value ?? null])
      )
    }
    const desiredPath = slugify(
      String(data.path ?? entry.data.path ?? entry.path)
    )
    const lockPath = entry.versionStatus !== 'published' && !entry.main
    const path = lockPath
      ? entry.path
      : this.#availablePath({
          id: entry.id,
          path: desiredPath,
          parentId: entry.parentId,
          root: entry.root,
          workspace: entry.workspace,
          locale: entry.locale
        })
    const recordData = lockPath ? data : {...data, path}
    if (entry.versionStatus === 'published' && path !== entry.path)
      this.#renameLanguage(entry.id, entry.locale, path)
    const filePath = paths.join(
      entry.parentDir,
      `${path}${statusSuffix(entry.versionStatus)}.json`
    )
    if (filePath !== entry.filePath) this.#removePath(entry.filePath)
    await this.#addRecord(
      filePath,
      {
        id: entry.id,
        type: entry.type,
        index: entry.index,
        root: entry.root,
        path,
        title: String(recordData.title ?? entry.title),
        seeded: entry.seeded,
        parentId: entry.parentId,
        data: recordData
      },
      entry.versionStatus
    )
  }

  async #publish(mutation: Extract<Mutation, {op: 'publish'}>) {
    const entry = this.#versionRow(
      mutation.id,
      mutation.locale,
      mutation.status
    )
    assert(entry, `Entry not found: ${mutation.id}`)
    this.policy?.assert(Permission.Publish, entry)
    let path = slugify(String(entry.data.path ?? entry.path))
    path = this.#availablePath({
      id: entry.id,
      path,
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      locale: entry.locale
    })
    const rows = this.#languageRows(entry.id, entry.locale)
    for (const row of rows) this.#removePath(row.filePath)
    if (path !== entry.path)
      this.#renameDir(entry.childrenDir, paths.join(entry.parentDir, path))
    await this.#addRecord(
      paths.join(entry.parentDir, `${path}.json`),
      {
        id: entry.id,
        type: entry.type,
        index: entry.index,
        root: entry.root,
        path,
        title: entry.title,
        seeded: entry.seeded,
        parentId: entry.parentId,
        data: {...entry.data, path}
      },
      'published'
    )
  }

  async #renameMainVersion(
    id: string,
    locale: string | null,
    status: Extract<EntryStatus, 'draft' | 'archived'>
  ) {
    const entry = this.#mainRow(id, locale)
    assert(entry, `Entry not found: ${id}`)
    this.policy?.assert(
      status === 'draft' ? Permission.Publish : Permission.Archive,
      entry
    )
    for (const row of this.#languageRows(id, locale)) {
      if (row.filePath !== entry.filePath) this.#removePath(row.filePath)
    }
    this.#renamePath(entry.filePath, `${entry.childrenDir}.${status}.json`)
  }

  async #move(mutation: Extract<Mutation, {op: 'move'}>) {
    const entries = this.#rowIndex.entriesById(mutation.id)
    assert(entries.length > 0, `Entry not found: ${mutation.id}`)
    const first = entries[0]
    const workspace = first.workspace
    const root = mutation.toRoot ?? first.root
    const parentId = mutation.toRoot ? null : (mutation.toParent ?? first.parentId)
    for (const entry of entries)
      this.policy?.assert(
        mutation.toParent || mutation.toRoot ? Permission.Move : Permission.Reorder,
        entry
      )
    const siblings = this.#rowIndex.siblings(workspace, root, parentId).filter(
      row => row.id !== mutation.id
    )
    if (mutation.after)
      assert(siblings.some(row => row.id === mutation.after), `Sibling not found: ${mutation.after}`)
    const previousIndex = mutation.after
      ? siblings.findIndex(row => row.id === mutation.after)
      : -1
    const previous = siblings[previousIndex] ?? null
    const next = siblings[previousIndex + 1] ?? null
    const hasDuplicates = new Set(siblings.map(row => row.index)).size !== siblings.length
    const index = hasDuplicates
      ? generateNKeysBetween(null, null, siblings.length + 1)[previousIndex + 1]
      : generateKeyBetween(previous?.index ?? null, next?.index ?? null)

    for (const entry of entries) {
      const parent = parentId ? this.#mainRow(parentId, entry.locale) : undefined
      if (parentId) assert(parent, `Parent not found: ${parentId}`)
      const parentDir = parent
        ? parent.childrenDir
        : ConfigUtils.filePath(this.config, workspace, root, entry.locale)
      const childrenDir = paths.join(parentDir, entry.path)
      const filePath = `${childrenDir}${statusSuffix(entry.versionStatus)}.json`
      if (mutation.toParent || mutation.toRoot) {
        this.#removePath(entry.filePath)
        this.#renameDir(entry.childrenDir, childrenDir)
      }
      await this.#addRecord(
        filePath,
        {
          id: entry.id,
          type: entry.type,
          index,
          root,
          path: entry.path,
          title: entry.title,
          seeded: entry.seeded,
          parentId,
          data: entry.data
        },
        entry.versionStatus
      )
    }
  }

  async #remove(mutation: Extract<Mutation, {op: 'remove'}>) {
    const entries = this.#rowIndex.entriesById(mutation.id).filter(row => {
      const matchesStatus =
        mutation.status === undefined || row.versionStatus === mutation.status
      const matchesLocale =
        mutation.locale === undefined || row.locale === mutation.locale
      return row.id === mutation.id && matchesLocale && matchesStatus
    })
    if (entries[0]) this.policy?.assert(Permission.Delete, entries[0])
    for (const entry of entries) {
      assert(
        entry.versionStatus !== 'published' || !entry.seeded,
        `Cannot remove seeded entry ${entry.filePath}`
      )
      this.#removePath(entry.filePath)
      if (entry.versionStatus !== 'draft') this.#removeDir(entry.childrenDir)
    }
  }

  #assertLocale(workspace: string, root: string, locale: string | null) {
    const rootConfig = this.config.workspaces[workspace][root]
    const i18n = getRoot(rootConfig).i18n
    if (i18n) assert(i18n.locales.includes(locale as string), 'Invalid locale')
    else assert(locale === null, 'Invalid locale')
  }

  #availablePath(target: {
    id: string
    path: string
    parentId: string | null
    root: string
    workspace: string
    locale: string | null
  }) {
    const conflictingPaths = this.#rowIndex
      .pathScope(target.workspace, target.root, target.parentId, target.locale)
      .filter(row => {
        return (
          row.id !== target.id &&
          (row.path === target.path || row.path.startsWith(`${target.path}-`))
        )
      })
      .map(row => row.path)
    const suffix = pathSuffix(target.path, conflictingPaths)
    return suffix === undefined ? target.path : `${target.path}-${suffix}`
  }

  #mainRow(id: string, locale: string | null) {
    return this.#rowIndex.mainRow(id, locale)
  }

  #versionRow(id: string, locale: string | null, status: EntryStatus) {
    return this.#rowIndex.versionRow(id, locale, status)
  }

  #languageRows(id: string, locale: string | null) {
    return this.#rowIndex.languageRows(id, locale)
  }

  #renameLanguage(id: string, locale: string | null, path: string) {
    for (const row of this.#languageRows(id, locale)) {
      const filePath = paths.join(
        row.parentDir,
        `${path}${statusSuffix(row.versionStatus)}.json`
      )
      this.#renamePath(row.filePath, filePath)
      this.#renameDir(row.childrenDir, paths.join(row.parentDir, path))
    }
  }

  async #addRecord(
    filePath: string,
    entry: Parameters<typeof createRecord>[0],
    status: EntryStatus
  ) {
    const contents = new TextEncoder().encode(
      JSON.stringify(createRecord(entry, status), null, 2)
    )
    const sha = await hashBlob(contents)
    this.#draft.add(filePath, sha)
    this.#versionsByPath.set(
      filePath,
      createRxbEntryVersionFromBlob(this.config, filePath, sha, contents)
    )
  }

  #removePath(filePath: string) {
    this.#draft.remove(filePath)
    this.#versionsByPath.delete(filePath)
  }

  #removeDir(dir: string) {
    this.#draft.remove(dir)
    for (const filePath of Array.from(this.#versionsByPath.keys())) {
      if (filePath.startsWith(`${dir}/`)) this.#versionsByPath.delete(filePath)
    }
  }

  #renamePath(from: string, to: string) {
    this.#draft.rename(from, to)
    const version = this.#versionsByPath.get(from)
    if (!version) return
    this.#versionsByPath.delete(from)
    this.#versionsByPath.set(to, versionWithPath(this.config, version, to))
  }

  #renameDir(from: string, to: string) {
    this.#draft.rename(from, to)
    for (const [filePath, version] of Array.from(this.#versionsByPath)) {
      if (!filePath.startsWith(`${from}/`)) continue
      const nextPath = `${to}${filePath.slice(from.length)}`
      this.#versionsByPath.delete(filePath)
      this.#versionsByPath.set(
        nextPath,
        versionWithPath(this.config, version, nextPath)
      )
    }
  }

  async #refresh() {
    this.#tree = await this.#draft.compile(this.#tree)
    this.#draft = this.#tree.clone()
    this.#rows = hydrateRowsFromVersions(
      this.config,
      this.#tree,
      Array.from(this.#versionsByPath.values())
    )
    this.#rowIndex = new RxbEntryRowIndex(this.#rows)
  }
}

class RxbEntryRowIndex {
  readonly #byId = new Map<string, Array<RxbEntryRow>>()
  readonly #byLanguage = new Map<string, Array<RxbEntryRow>>()
  readonly #mainByLanguage = new Map<string, RxbEntryRow>()
  readonly #versionByLanguage = new Map<string, RxbEntryRow>()
  readonly #siblings = new Map<string, Array<RxbEntryRow>>()
  readonly #pathScopes = new Map<string, Array<RxbEntryRow>>()

  constructor(rows: Array<RxbEntryRow>) {
    const siblingsById = new Map<string, Map<string, RxbEntryRow>>()
    for (const row of rows) {
      appendMapArray(this.#byId, row.id, row)
      appendMapArray(this.#byLanguage, languageRowKey(row.id, row.locale), row)
      this.#versionByLanguage.set(
        versionRowKey(row.id, row.locale, row.versionStatus),
        row
      )
      if (row.main) {
        this.#mainByLanguage.set(languageRowKey(row.id, row.locale), row)
        const siblingKey = parentLocationKey(
          row.workspace,
          row.root,
          row.parentId
        )
        const byId = siblingsById.get(siblingKey) ?? new Map()
        byId.set(row.id, row)
        siblingsById.set(siblingKey, byId)
      }
      appendMapArray(
        this.#pathScopes,
        pathScopeKey(row.workspace, row.root, row.parentId, row.locale),
        row
      )
    }
    for (const [key, byId] of siblingsById) {
      this.#siblings.set(
        key,
        Array.from(byId.values()).sort(compareRowIndex)
      )
    }
  }

  entriesById(id: string): Array<RxbEntryRow> {
    return this.#byId.get(id) ?? []
  }

  languageRows(id: string, locale: string | null): Array<RxbEntryRow> {
    return this.#byLanguage.get(languageRowKey(id, locale)) ?? []
  }

  mainRow(id: string, locale: string | null): RxbEntryRow | undefined {
    return this.#mainByLanguage.get(languageRowKey(id, locale))
  }

  versionRow(
    id: string,
    locale: string | null,
    status: EntryStatus
  ): RxbEntryRow | undefined {
    return this.#versionByLanguage.get(versionRowKey(id, locale, status))
  }

  siblings(
    workspace: string,
    root: string,
    parentId: string | null
  ): Array<RxbEntryRow> {
    return this.#siblings.get(parentLocationKey(workspace, root, parentId)) ?? []
  }

  pathScope(
    workspace: string,
    root: string,
    parentId: string | null,
    locale: string | null
  ): Array<RxbEntryRow> {
    return (
      this.#pathScopes.get(pathScopeKey(workspace, root, parentId, locale)) ??
      []
    )
  }
}

function appendMapArray<Key, Value>(
  map: Map<Key, Array<Value>>,
  key: Key,
  value: Value
) {
  const values = map.get(key) ?? []
  values.push(value)
  map.set(key, values)
}

function languageRowKey(id: string, locale: string | null): string {
  return `${id}:${keyPart(locale)}`
}

function versionRowKey(
  id: string,
  locale: string | null,
  status: EntryStatus
): string {
  return `${languageRowKey(id, locale)}:${status}`
}

function parentLocationKey(
  workspace: string,
  root: string,
  parentId: string | null
): string {
  return `${workspace}:${root}:${keyPart(parentId)}`
}

function pathScopeKey(
  workspace: string,
  root: string,
  parentId: string | null,
  locale: string | null
): string {
  return `${parentLocationKey(workspace, root, parentId)}:${keyPart(locale)}`
}

function keyPart(value: string | null): string {
  return value ?? '<null>'
}

function compareRowIndex(a: RxbEntryRow, b: RxbEntryRow): number {
  return a.index.localeCompare(b.index)
}

function hydrateRowsFromVersions(
  config: Config,
  tree: ReadonlyTree,
  versions: Array<RxbEntryVersion>
): Array<RxbEntryRow> {
  const artifact = createRxbEntryArtifactFromVersions(config, tree, versions)
  const fileHashes = new Map(tree.index())
  return artifact.payload.columns.rowIds.flatMap((_, ordinal) => {
    const rowId = artifact.payload.columns.rowIds[ordinal]
    const row = hydrateRxbEntryRowAt(
      config,
      artifact.payload,
      ordinal,
      fileHashes.get(rowId)
    )
    return row ? [row] : []
  })
}

function versionWithPath(
  config: Config,
  version: RxbEntryVersion,
  filePath: string
): RxbEntryVersion {
  const info = rxbEntryInfoFromRowId(config, filePath)
  return {
    ...version,
    rowId: filePath,
    versionId: filePath,
    languageId: `${version.id}:${info.locale ?? '<null>'}`,
    status: info.status,
    locale: info.locale,
    workspace: info.workspace,
    root: info.root,
    path: info.path,
    parentDir: info.parentDir,
    childrenDir: info.childrenDir,
    filePath,
    level: info.level
  }
}

function hydrateRowsFromArtifact(
  config: Config,
  artifact: RxbEntryArtifact,
  tree = ReadonlyTree.fromFlat(artifact.payload.tree)
): Array<RxbEntryRow> {
  const fileHashes = new Map(tree.index())
  return artifact.payload.columns.rowIds.flatMap((rowId, ordinal) => {
    const row = hydrateRxbEntryRowAt(
      config,
      artifact.payload,
      ordinal,
      fileHashes.get(rowId)
    )
    return row ? [row] : []
  })
}

function statusSuffix(status: EntryStatus): string {
  return status === 'published' ? '' : `.${status}`
}

function assertBundledRemoteChanges(
  batch: Awaited<ReturnType<typeof bundleContents>>
) {
  const missingBlobs = Array.from(
    new Set(
      batch.changes.flatMap(change => {
        if (change.op === 'delete' || change.contents) return []
        return [change.sha]
      })
    )
  )
  if (missingBlobs.length > 0)
    throw new Error(`Missing remote blobs: ${missingBlobs.join(', ')}`)
}
