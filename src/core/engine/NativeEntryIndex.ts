import * as paths from '../util/Paths.js'
import MiniSearch from 'minisearch'
import {Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {createRecord, parseRecord} from '../EntryRecord.js'
import {createId} from '../Id.js'
import {getRoot} from '../Internal.js'
import {Page} from '../Page.js'
import {Schema} from '../Schema.js'
import type {ChangesBatch} from '../source/Change.js'
import {hashBlob} from '../source/GitUtils.js'
import {ShaMismatchError} from '../source/ShaMismatchError.js'
import {bundleContents, type Source} from '../source/Source.js'
import {type FlatTree, ReadonlyTree} from '../source/Tree.js'
import {compareStrings} from '../source/Utils.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {entries, keys} from '../util/Objects.js'
import {slugify} from '../util/Slugs.js'
import {sourceChanges} from '../db/CommitRequest.js'
import {type EntryCondition} from '../db/EntryIndex.js'
import {IndexEvent} from '../db/IndexEvent.js'
import {EntryTransaction} from './EntryTransaction.js'
import {type EntryManifest} from './EntryManifest.js'
import type {EntryQueryOptions, EntryQueryPlan} from './EntryPlanner.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import {createEntrySnapshotIndexes} from './EntrySnapshotIndex.js'
import {createEntryManifest} from './EntrySnapshotBuilder.js'
import {ENTRY_SNAPSHOT_VERSION} from './EntrySnapshot.js'
import type {
  EntryLanguageId,
  EntryLanguageRow,
  EntryNodeId,
  EntryNodeRow,
  EntryRowStore,
  EntryVersionRow
} from './EntryRows.js'
import {SnapshotEntryPlanner} from './SnapshotEntryPlanner.js'

const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u
const DIACRITIC = /\p{Diacritic}/gu

interface VersionReplacement {
  previous: EntryVersionRow
  next: EntryVersionRow
}

export class NativeEntryIndex extends EventTarget {
  readonly #config: Config
  readonly #manifest: EntryManifest
  readonly #seeds: Map<string, Seed>
  #versions = new Map<string, EntryVersionRow>()
  #graph: SnapshotEntryGraph | undefined
  #snapshot: EntrySnapshot | undefined
  #planner: SnapshotEntryPlanner | undefined
  #plannerSnapshot: EntrySnapshot | undefined
  #indexListeners = 0

  tree = ReadonlyTree.EMPTY
  initialSync: ReadonlyTree | undefined

  constructor(config: Config) {
    super()
    this.#config = config
    this.#manifest = createEntryManifest(config)
    this.#seeds = entrySeeds(config)
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ) {
    if (type === 'entry' || type === 'index') this.#indexListeners++
    super.addEventListener(type, callback, options)
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ) {
    if (type === 'entry' || type === 'index')
      this.#indexListeners = Math.max(0, this.#indexListeners - 1)
    super.removeEventListener(type, callback, options)
  }

  get sha() {
    return this.tree.sha
  }

  get graph() {
    return (this.#graph ??= new SnapshotEntryGraph(
      this.#config,
      this.#versions,
      this.#seeds
    ))
  }

  get snapshot() {
    if (this.#snapshot?.graphSha === this.sha) return this.#snapshot
    const rows = createEntryRowsFromVersions(this.#config, [
      ...this.#versions.values()
    ])
    return (this.#snapshot = {
      version: ENTRY_SNAPSHOT_VERSION,
      manifest: this.#manifest,
      graphSha: this.sha,
      tree: this.tree.flat(),
      rows,
      indexes: createEntrySnapshotIndexes(rows)
    })
  }

  get planner() {
    const snapshot = this.snapshot
    if (this.#planner && this.#plannerSnapshot === snapshot)
      return this.#planner
    this.#plannerSnapshot = snapshot
    return (this.#planner = new SnapshotEntryPlanner(snapshot))
  }

  query(plan: EntryQueryPlan, options?: EntryQueryOptions) {
    return this.planner.candidates(plan, options)
  }

  filter(filter: EntryCondition): Iterable<Entry> {
    return this.graph.filter(filter)
  }

  findFirst<T extends Record<string, unknown>>(
    filter: (entry: Entry) => boolean
  ): Entry<T> | undefined {
    const [entry] = this.findMany(filter)
    return entry as Entry<T> | undefined
  }

  findMany(filter: (entry: Entry) => boolean): Iterable<Entry> {
    return this.graph.filter({entry: filter})
  }

  byId(id: string) {
    return this.graph.byId(id)
  }

  async syncWith(source: Source): Promise<string> {
    const tree = await source.getTree()
    if (!this.initialSync) this.initialSync = tree
    if (!this.tree.isEmpty) {
      const batch = await bundleContents(source, this.tree.diff(tree))
      if (batch.changes.length === 0) return tree.sha
      return this.indexChanges(batch)
    }
    const files = Array.from(tree.index(), ([path, sha]) => ({
      path,
      sha
    })).filter(file => file.path.endsWith('.json'))
    const blobs = new Map(
      await Array.fromAsync(source.getBlobs(files.map(file => file.sha)))
    )
    this.#versions = new Map(
      files.map(file => {
        const blob = blobs.get(file.sha)
        assert(blob, `Missing blob: ${file.sha}`)
        return [
          file.path,
          parseVersionRow(this.#config, this.#seeds, file.path, file.sha, blob)
        ]
      })
    )
    this.tree = tree
    this.#invalidateDerived()
    return tree.sha
  }

  async indexChanges(batch: ChangesBatch) {
    const {fromSha, changes} = batch
    if (fromSha !== this.tree.sha)
      throw new ShaMismatchError(fromSha, this.tree.sha)
    if (changes.length === 0) return this.tree.sha
    const previousSnapshot =
      this.#snapshot?.graphSha === this.sha ? this.#snapshot : undefined
    const replacements = Array<VersionReplacement>()
    const notify = this.#indexListeners > 0
    const changed = new Set<SnapshotEntryNode>()
    for (const change of changes) {
      if (change.op !== 'delete' || !change.path.endsWith('.json')) continue
      if (notify) {
        const node = this.graph.byDir(getNodePath(change.path))
        if (node) changed.add(node)
      }
      this.#versions.delete(change.path)
    }
    for (const change of changes) {
      if (change.op !== 'add' || !change.path.endsWith('.json')) continue
      assert(change.contents, 'Missing contents')
      const previous = this.#versions.get(change.path)
      const next = parseVersionRow(
        this.#config,
        this.#seeds,
        change.path,
        change.sha,
        change.contents
      )
      this.#versions.set(change.path, next)
      if (previous) replacements.push({previous, next})
    }
    this.#graph = undefined
    if (notify)
      for (const change of changes) {
        if (change.op !== 'add' || !change.path.endsWith('.json')) continue
        const node = this.graph.byDir(getNodePath(change.path))
        if (node) changed.add(node)
      }
    const nextTree = await this.tree.withChanges(batch)
    this.tree = nextTree
    this.#snapshot = previousSnapshot
      ? updateSnapshotForChanges(
          previousSnapshot,
          changes,
          replacements,
          nextTree.flat()
        )
      : undefined
    this.#planner = undefined
    this.#plannerSnapshot = undefined
    if (notify) {
      const pool = Array.from(changed)
      const queued = new Set(changed)
      while (pool.length > 0) {
        const node = pool.shift()!
        this.dispatchEvent(new IndexEvent({op: 'entry', id: node.id}))
        for (const child of node.children()) {
          if (queued.has(child)) continue
          queued.add(child)
          pool.push(child)
        }
      }
      this.dispatchEvent(new IndexEvent({op: 'index', sha: this.tree.sha}))
    }
    return this.tree.sha
  }

  async seed(source: Source) {
    const singleWorkspace = Config.multipleWorkspaces(this.#config)
      ? undefined
      : keys(this.#config.workspaces)[0]
    for (const [nodePath, seed] of this.#seeds) {
      const {
        type,
        workspace,
        root,
        locale,
        data: {path}
      } = seed
      const node = this.graph.byDir(nodePath)
      if (node) {
        assert(node.type === type, `Type mismatch in ${nodePath}`)
      } else {
        const pathSegments = nodePath.split('/').slice(singleWorkspace ? 1 : 2)
        const seedPath = `/${pathSegments.join('/')}.json`
        const node = this.findFirst(entry => {
          return (
            entry.seeded === seedPath &&
            entry.root === root &&
            entry.workspace === workspace
          )
        })
        if (node) {
          assert(node.type === type, `Type mismatch in ${nodePath}`)
        } else {
          const parentPath = paths.dirname(nodePath)
          const parentNode = this.graph.byDir(getNodePath(parentPath))
          let id = createId()
          if (locale) {
            const level = pathSegments.length - 2
            const pathEnd = `/${pathSegments.slice(1).join('/')}.json`
            const [from] = this.filter({
              node(node) {
                return (
                  node.root === root &&
                  node.workspace === workspace &&
                  node.level === level &&
                  node.parentId === (parentNode?.id ?? null)
                )
              },
              language(node) {
                return node.locale !== locale && node.path === path
              },
              entry(entry) {
                return Boolean(entry.seeded?.endsWith(pathEnd))
              }
            })
            if (from) id = from.id
          }
          const tx = await this.transaction(source)
          const request = await tx
            .create({
              id,
              parentId: parentNode?.id ?? null,
              locale,
              type,
              workspace,
              root,
              fromSeed: seedPath,
              data: {path}
            })
            .toRequest()
          const contentChanges = sourceChanges(request)
          if (contentChanges.changes.length) {
            await this.indexChanges(contentChanges)
            await source.applyChanges(contentChanges)
          }
        }
      }
    }
  }

  async fix(source: Source) {
    const tree = await source.getTree()
    const tx = await this.transaction(source)
    for (const entry of this.filter({})) {
      const record = createRecord(entry, entry.status)
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      const sha = await hashBlob(contents)
      const leaf = tree.getLeaf(entry.filePath)
      if (sha !== leaf.sha) {
        tx.update({
          id: entry.id,
          set: entry.data,
          locale: entry.locale,
          status: entry.status
        })
      }
    }
    if (tx.empty) return
    const request = await tx.toRequest()
    const contentChanges = sourceChanges(request)
    if (contentChanges.changes.length) await source.applyChanges(contentChanges)
  }

  async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.#config, this, source, from)
  }

  #invalidateDerived() {
    this.#graph = undefined
    this.#snapshot = undefined
    this.#planner = undefined
    this.#plannerSnapshot = undefined
  }
}

class SnapshotEntryLanguage extends Map<EntryStatus, EntryVersionRow> {
  readonly locale: string | null
  readonly parentDir: string
  readonly selfDir: string

  constructor(versions: Array<EntryVersionRow>) {
    super(versions.map(version => [version.status, version] as const))
    const [first, ...rest] = versions
    this.locale = first.locale
    this.parentDir = first.parentDir
    this.selfDir = first.childrenDir
    for (const version of rest) {
      assert(
        version.locale === first.locale,
        `Mismatched locales for ${first.id} "${version.locale}" <> "${first.locale}"`
      )
      assert(
        version.parentDir === first.parentDir,
        `Mismatched parentDirs for ${first.id} "${version.parentDir}" <> "${first.parentDir}"`
      )
      assert(
        version.childrenDir === first.childrenDir,
        `Mismatched selfDirs for ${first.id} "${version.childrenDir}" <> "${first.childrenDir}"`
      )
      assert(
        version.path === first.path,
        `Mismatched paths for ${first.id} "${version.path}" <> "${first.path}"`
      )
    }
  }
}

class SnapshotEntryCollection extends Map<
  string | null,
  SnapshotEntryLanguage
> {
  readonly type: string

  constructor(public versions: Array<EntryVersionRow>) {
    super()
    const [first, ...rest] = versions
    this.type = first.type
    for (const version of rest) {
      assert(
        version.type === first.type,
        `Mismatched types for ${first.id} "${version.type}" <> "${first.type}"`
      )
      assert(
        version.index === first.index,
        `Mismatched index for ${first.id} "${version.index}" <> "${first.index}"`
      )
      assert(
        version.root === first.root,
        `Mismatched root for ${first.id} "${version.root}" <> "${first.root}"`
      )
      assert(
        version.workspace === first.workspace,
        `Mismatched workspace for ${first.id} "${version.workspace}" <> "${first.workspace}"`
      )
    }
    const byLanguage = new Map<string | null, Array<EntryVersionRow>>()
    for (const version of versions) {
      const rows = byLanguage.get(version.locale) ?? []
      rows.push(version)
      byLanguage.set(version.locale, rows)
    }
    for (const [locale, rows] of byLanguage)
      this.set(locale, new SnapshotEntryLanguage(rows))
  }
}

class SnapshotEntryLanguageNode {
  inheritedStatus: EntryStatus | undefined
  main: EntryVersionRow
  active: EntryVersionRow
  url: string
  locale: string | null
  path: string
  seeded: string | null = null
  #entries: Array<Entry> | undefined

  constructor(
    private node: SnapshotEntryNode,
    private language: SnapshotEntryLanguage
  ) {
    this.locale = language.locale
    const active =
      language.get('draft') ??
      language.get('published') ??
      language.get('archived')
    const parentStatus = node.parent?.get(language.locale)?.inheritedStatus
    if (parentStatus) this.inheritedStatus = parentStatus
    else if (language.has('archived')) this.inheritedStatus = 'archived'
    else if (language.has('draft') && !language.has('published'))
      this.inheritedStatus = 'draft'
    else this.inheritedStatus = undefined
    let main: EntryVersionRow | undefined
    if (this.inheritedStatus) main = active
    else
      main =
        language.get('published') ??
        language.get('archived') ??
        language.get('draft')
    assert(main, 'EntryLanguageNode missing main version')
    this.main = main
    assert(active, 'EntryLanguageNode missing active version')
    this.active = active
    this.url = entryUrl(node.entryType, {
      status: main.status,
      path: main.path,
      parentPaths: this.parentPaths,
      locale: main.locale,
      workspace: node.workspace,
      root: node.root
    })
    this.path = this.main.path
    this.seeded = this.main.seeded
  }

  [Symbol.iterator]() {
    return this.language[Symbol.iterator]()
  }

  has(status: EntryStatus) {
    return this.language.has(status)
  }

  get parentPaths() {
    let current = this.node.parent
    const paths = Array<string>()
    while (current) {
      const parentLanguage = current.get(this.locale)
      assert(parentLanguage, 'Missing parent language node')
      paths.unshift(parentLanguage.main.path)
      current = current.parent
    }
    return paths
  }

  get entries() {
    if (this.#entries) return this.#entries
    const rows = this.versionRows()
    this.#entries = rows.map(version => ({
      ...version,
      status: this.inheritedStatus ?? version.status,
      parentId: this.node.parentId,
      parents: this.node.parents,
      url: this.url,
      active: version === this.active,
      main: version === this.main
    }))
    return this.#entries
  }

  versionRows() {
    return this.inheritedStatus ? [this.active] : [...this.language.values()]
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const entry of this.entries) {
      if (filter.entry && !filter.entry(entry)) continue
      yield entry
    }
  }
}

class SnapshotEntryNode extends Map<string | null, SnapshotEntryLanguageNode> {
  readonly id: string
  readonly index: string
  readonly parentId: string | null
  readonly parents: Array<string>
  readonly workspace: string
  readonly root: string
  readonly type: string
  readonly level: number

  constructor(
    public graph: SnapshotEntryGraph,
    public entryType: Type,
    public parent: SnapshotEntryNode | null,
    collection: SnapshotEntryCollection
  ) {
    super()
    const first = collection.versions[0]
    this.id = first.id
    this.index = first.index
    this.workspace = first.workspace
    this.root = first.root
    this.type = first.type
    this.level = first.level
    this.parentId = parent ? parent.id : null
    this.parents = []
    let next = parent
    while (next) {
      assert(
        !this.parents.includes(next.id),
        `Cyclic parent reference: ${this.parents}`
      )
      this.parents.unshift(next.id)
      next = next.parent
    }
    for (const [locale, language] of collection)
      this.set(locale, new SnapshotEntryLanguageNode(this, language))
  }

  *children(): Iterable<SnapshotEntryNode> {
    for (const node of this.graph.nodes) {
      if (node.parentId === this.id) yield node
    }
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const node of this.values()) {
      if (filter.language && !filter.language(node as any)) continue
      yield* node.filter(filter)
    }
  }
}

class SnapshotEntryGraph {
  #byId = new Map<string, SnapshotEntryNode>()
  #byDir = new Map<string, string>()
  #filesById = new Map<string, Array<string>>()
  #search: MiniSearch
  nodes: Array<SnapshotEntryNode>

  constructor(
    private config: Config,
    private versions: Map<string, EntryVersionRow>,
    private seeds: Map<string, Seed>
  ) {
    this.#search = new MiniSearch({
      fields: ['title', 'searchableText'],
      storeFields: ['entry'],
      tokenize(text) {
        return text
          .normalize('NFD')
          .replace(DIACRITIC, '')
          .split(SPACE_OR_PUNCTUATION)
      }
    })
    for (const [file, version] of versions) {
      const files = this.#filesById.get(version.id) ?? []
      files.push(file)
      this.#filesById.set(version.id, files)
      this.#byDir.set(getNodePath(file), version.id)
    }
    this.nodes = [...this.#filesById.keys()]
      .map(id => this.#mkNode(id))
      .sort((a, b) => compareStrings(a.index, b.index))
  }

  byId(id: string) {
    return this.#byId.get(id)
  }

  byDir(dir: string) {
    const id = this.#byDir.get(dir)
    if (!id) return undefined
    return this.byId(id)
  }

  withChanges(batch: ChangesBatch) {
    const versions = new Map(this.versions)
    for (const change of batch.changes) {
      if (change.op === 'delete') {
        versions.delete(change.path)
      } else if (change.path.endsWith('.json')) {
        assert(change.contents, 'Missing contents')
        versions.set(
          change.path,
          parseVersionRow(
            this.config,
            this.seeds,
            change.path,
            change.sha,
            change.contents
          )
        )
      }
    }
    return new SnapshotEntryGraph(this.config, versions, this.seeds)
  }

  *filter({search, ...filter}: EntryCondition): Generator<Entry> {
    if (search) {
      const found = new Set(this.filter(filter))
      for (const entry of found) {
        if (!this.#search.has(entry.filePath)) this.#updateSearch(entry)
      }
      const results = this.#search
        .search(search, {
          prefix: true,
          fuzzy: 0.1,
          boost: {title: 2},
          filter: result => found.has(result.entry)
        })
        .map(result => result.entry)
      yield* results
      return
    }
    for (const node of filter.nodes ?? this.nodes) {
      if (filter.node && !filter.node(node as any)) continue
      yield* (node as SnapshotEntryNode).filter(filter)
    }
  }

  #updateSearch(entry: Entry) {
    this.#search.add({
      id: entry.filePath,
      title: entry.title,
      searchableText: entry.searchableText,
      entry
    })
  }

  #mkNode(id: string): SnapshotEntryNode {
    if (this.#byId.has(id)) return this.#byId.get(id)!
    const files = this.#filesById.get(id)!
    const collection = new SnapshotEntryCollection(
      files.map(file => this.versions.get(file)!)
    )
    const [first, ...rest] = collection.values()
    const parentId = this.#byDir.get(first.parentDir) ?? null
    for (const language of rest) {
      const otherParentId = this.#byDir.get(language.parentDir) ?? null
      assert(
        parentId === otherParentId,
        `Expected matching parents for entries "${first.selfDir}" and "${language.selfDir}"`
      )
    }
    const parent = parentId ? this.#mkNode(parentId) : null
    const type = this.config.schema[collection.type]
    const node = new SnapshotEntryNode(this, type, parent, collection)
    this.#byId.set(id, node)
    return node
  }
}

function parseVersionRow(
  config: Config,
  seeds: Map<string, Seed>,
  filePath: string,
  sha: string,
  blob: Uint8Array
): EntryVersionRow {
  const text = new TextDecoder().decode(blob)
  const raw = JSON.parse(text)
  const {meta, data: recordData} = parseRecord(raw)
  const entryType = config.schema[meta.type]
  const segments = filePath.split('/')
  const fileName = paths.basename(filePath, '.json')
  const [path, status] = entryInfo(fileName)
  const parentDir = paths.dirname(filePath)
  const childrenDir = `${parentDir}/${path}`
  const seed = seeds.get(childrenDir)
  const data: Record<string, unknown> = {path, ...recordData, ...seed?.data}
  const singleWorkspace = Config.multipleWorkspaces(config)
    ? undefined
    : keys(config.workspaces)[0]
  let segmentIndex = 0
  const workspace = singleWorkspace ?? segments[segmentIndex++]
  const workspaceConfig = config.workspaces[workspace]
  assert(workspaceConfig, `Invalid workspace: ${workspace} in ${filePath}`)
  const root = segments[segmentIndex++]
  const rootConfig = workspaceConfig[root]
  assert(rootConfig, `Invalid root: ${root} for workspace ${workspace}`)
  const i18n = getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    locale = segments[segmentIndex++].toLowerCase()
    for (const localeCandidate of i18n.locales) {
      if (locale === localeCandidate.toLowerCase()) {
        locale = localeCandidate
        break
      }
    }
    assert(i18n.locales.includes(locale), `Invalid locale: ${locale}`)
  }
  let levelOffset = 1
  if (!singleWorkspace) levelOffset += 1
  if (i18n) levelOffset += 1
  const level = segments.length - levelOffset - 1
  return {
    rowId: filePath,
    versionId: filePath,
    nodeId: meta.id,
    languageId: languageId(meta.id, locale),
    id: meta.id,
    type: meta.type,
    index: meta.index,
    title: data.title as string,
    searchableText: Type.searchableText(entryType, recordData),
    seeded: meta.seeded ?? null,
    rowHash: sha,
    fileHash: sha,
    data,
    status,
    locale,
    workspace,
    root,
    path,
    parentDir,
    childrenDir,
    filePath,
    level
  }
}

interface EntryLanguageBuild {
  inheritedStatus: EntryStatus | undefined
  row: EntryLanguageRow
  versions: Array<EntryVersionRow>
}

function createEntryRowsFromVersions(
  config: Config,
  input: Array<EntryVersionRow>
): EntryRowStore {
  const versions = Array<EntryVersionRow>()
  const languages = Array<EntryLanguageRow>()
  const nodes = createNodeRowsFromVersions(input)
  const byLanguage = new Map<EntryLanguageId, Array<EntryVersionRow>>()
  for (const version of input) {
    const rows = byLanguage.get(version.languageId) ?? []
    rows.push(version)
    byLanguage.set(version.languageId, rows)
  }
  const parentIdByNode = parentIds(input)
  const built = new Map<EntryLanguageId, EntryLanguageBuild>()

  const build = (id: EntryLanguageId): EntryLanguageBuild => {
    const cached = built.get(id)
    if (cached) return cached
    const rows = byLanguage.get(id)
    if (!rows) throw new Error(`Missing language rows for ${id}`)
    const first = rows[0]
    const active =
      rows.find(row => row.status === 'draft') ??
      rows.find(row => row.status === 'published') ??
      rows.find(row => row.status === 'archived') ??
      first
    const parentId = parentIdByNode.get(first.nodeId)
    const parentLanguageId = parentId && languageId(parentId, first.locale)
    const parent =
      parentLanguageId && byLanguage.has(parentLanguageId)
        ? build(parentLanguageId)
        : undefined
    const inheritedStatus =
      parent?.inheritedStatus ??
      (rows.some(row => row.status === 'archived')
        ? 'archived'
        : rows.some(row => row.status === 'draft') &&
            !rows.some(row => row.status === 'published')
          ? 'draft'
          : undefined)
    const main = inheritedStatus
      ? active
      : (rows.find(row => row.status === 'published') ??
        rows.find(row => row.status === 'archived') ??
        rows.find(row => row.status === 'draft') ??
        active)
    const versionRows = inheritedStatus ? [active] : rows
    const parentPaths = parent
      ? parentPathRows(parent, built, parentIdByNode)
      : []
    const row = {
      languageId: id,
      nodeId: first.nodeId,
      locale: first.locale,
      parentDir: first.parentDir,
      selfDir: first.childrenDir,
      activeRowId: active.rowId,
      mainRowId: main.rowId,
      url: entryUrl(config.schema[main.type], {
        status: main.status,
        path: main.path,
        parentPaths,
        locale: main.locale,
        workspace: main.workspace,
        root: main.root
      }),
      path: main.path,
      seeded: main.seeded,
      versionRowIds: versionRows.map(row => row.rowId)
    }
    const result = {
      inheritedStatus,
      row,
      versions: versionRows.map(version => ({
        ...version,
        status: inheritedStatus ?? version.status
      }))
    }
    built.set(id, result)
    return result
  }

  for (const node of nodes) {
    for (const id of node.languageIds) {
      const language = build(id)
      languages.push(language.row)
      versions.push(...language.versions)
    }
  }
  return {versions, languages, nodes}
}

function updateSnapshotForChanges(
  snapshot: EntrySnapshot,
  changes: ChangesBatch['changes'],
  replacements: Array<VersionReplacement>,
  tree: FlatTree
): EntrySnapshot | undefined {
  const jsonChanges = changes.filter(change => change.path.endsWith('.json'))
  if (jsonChanges.some(change => change.op !== 'add')) return

  const replacementsByPath = new Map(
    replacements.map(replacement => [replacement.next.filePath, replacement])
  )
  for (const change of jsonChanges) {
    if (!replacementsByPath.has(change.path)) return
  }

  const positions = new Map(
    snapshot.rows.versions.map((version, index) => [version.rowId, index])
  )
  const versions = snapshot.rows.versions.slice()
  let changed = false

  for (const replacement of replacements) {
    if (!sameSnapshotShape(replacement.previous, replacement.next)) return
    const position = positions.get(replacement.next.rowId)
    if (position === undefined) continue
    versions[position] = {
      ...replacement.next,
      status: versions[position].status
    }
    changed = true
  }

  return {
    ...snapshot,
    graphSha: tree.sha,
    tree,
    rows: changed ? {...snapshot.rows, versions} : snapshot.rows
  }
}

function sameSnapshotShape(previous: EntryVersionRow, next: EntryVersionRow) {
  return (
    previous.rowId === next.rowId &&
    previous.versionId === next.versionId &&
    previous.nodeId === next.nodeId &&
    previous.languageId === next.languageId &&
    previous.id === next.id &&
    previous.type === next.type &&
    previous.index === next.index &&
    previous.seeded === next.seeded &&
    previous.status === next.status &&
    previous.locale === next.locale &&
    previous.workspace === next.workspace &&
    previous.root === next.root &&
    previous.path === next.path &&
    previous.parentDir === next.parentDir &&
    previous.childrenDir === next.childrenDir &&
    previous.filePath === next.filePath &&
    previous.level === next.level
  )
}

function parentPathRows(
  parent: EntryLanguageBuild,
  languages: Map<EntryLanguageId, EntryLanguageBuild>,
  parentIdByNode: Map<EntryNodeId, EntryNodeId | null>
) {
  const paths = Array<string>()
  let current: EntryLanguageBuild | undefined = parent
  while (current) {
    paths.unshift(current.row.path)
    const nextParentId = parentIdByNode.get(current.row.nodeId)
    current =
      nextParentId === null || nextParentId === undefined
        ? undefined
        : languages.get(languageId(nextParentId, current.row.locale))
  }
  return paths
}

function createNodeRowsFromVersions(
  versions: Array<EntryVersionRow>
): Array<EntryNodeRow> {
  const byNode = new Map<EntryNodeId, EntryVersionRow>()
  const languageIdsByNode = new Map<EntryNodeId, Set<EntryLanguageId>>()
  const parentIdByNode = parentIds(versions)
  const childrenByNode = new Map<EntryNodeId, Array<EntryNodeId>>()
  for (const [nodeId, parentId] of parentIdByNode) {
    if (!parentId) continue
    const children = childrenByNode.get(parentId) ?? []
    children.push(nodeId)
    childrenByNode.set(parentId, children)
  }
  for (const version of versions) {
    if (!byNode.has(version.nodeId)) byNode.set(version.nodeId, version)
    const ids = languageIdsByNode.get(version.nodeId) ?? new Set()
    ids.add(version.languageId)
    languageIdsByNode.set(version.nodeId, ids)
  }
  return Array.from(byNode, ([nodeId, first]) => ({
    nodeId,
    id: first.id,
    index: first.index,
    parentId: parentIdByNode.get(nodeId) ?? null,
    parents: parentsOf(nodeId, parentIdByNode),
    workspace: first.workspace,
    root: first.root,
    type: first.type,
    level: first.level,
    languageIds: Array.from(languageIdsByNode.get(nodeId) ?? []),
    childNodeIds: childrenByNode.get(nodeId) ?? []
  })).sort((a, b) => compareStrings(a.index, b.index))
}

function parentIds(versions: Array<EntryVersionRow>) {
  const byDir = new Map<string, EntryNodeId>()
  for (const version of versions) byDir.set(version.childrenDir, version.nodeId)
  const result = new Map<EntryNodeId, EntryNodeId | null>()
  for (const version of versions) {
    if (result.has(version.nodeId)) continue
    result.set(version.nodeId, byDir.get(version.parentDir) ?? null)
  }
  return result
}

function parentsOf(
  nodeId: EntryNodeId,
  parentIdByNode: Map<EntryNodeId, EntryNodeId | null>
) {
  const parents = Array<EntryNodeId>()
  let current = parentIdByNode.get(nodeId)
  while (current) {
    parents.unshift(current)
    current = parentIdByNode.get(current)
  }
  return parents
}

function getNodePath(filePath: string) {
  const lastSlash = filePath.lastIndexOf('/')
  const dir = filePath.slice(0, lastSlash)
  const name = filePath.slice(lastSlash + 1)
  const lastDot = name.lastIndexOf('.')
  let base = lastDot === -1 ? name : name.slice(0, lastDot)
  if (base.endsWith('.archived')) base = base.slice(0, -'.archived'.length)
  if (base.endsWith('.draft')) base = base.slice(0, -'.draft'.length)
  return `${dir}/${base}`
}

function languageId(id: string, locale: string | null): EntryLanguageId {
  return `${id}:${locale ?? '<null>'}`
}

interface Seed {
  seedId: string
  type: string
  workspace: string
  root: string
  locale: string | null
  data: Record<string, any>
}

function entrySeeds(config: Config): Map<string, Seed> {
  const result = new Map<string, Seed>()
  const typeNames = Schema.typeNames(config.schema)
  for (const [workspaceName, workspace] of entries(config.workspaces)) {
    for (const [rootName, root] of entries(workspace)) {
      const {i18n} = getRoot(root)
      const locales = i18n?.locales ?? [null]
      for (const locale of locales) {
        const pages: Array<readonly [string, Page]> = entries(root)
        while (pages.length > 0) {
          const [pagePath, page] = pages.shift()!
          const path = pagePath.split('/').map(slugify).join('/')
          if (!Page.isPage(page)) continue
          const {type, fields = {}} = Page.data(page)
          const filePath = Config.filePath(
            config,
            workspaceName,
            rootName,
            locale,
            `${path}.json`
          )
          const nodePath = getNodePath(filePath)
          const typeName = typeNames.get(type)
          if (!typeName) continue
          result.set(nodePath, {
            seedId: `${rootName}/${path}`,
            type: typeName,
            locale,
            workspace: workspaceName,
            root: rootName,
            data: {
              ...fields,
              path: path.split('/').pop(),
              title: fields.title ?? path
            }
          })
          const children = entries(page).map(
            ([childPath, child]) =>
              [`${path}/${childPath}`, child as Page] as const
          )
          pages.push(...children)
        }
      }
    }
  }
  return result
}
