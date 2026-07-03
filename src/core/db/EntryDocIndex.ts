import type {Config} from '../Config.js'
import {Config as ConfigUtils} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import type {ChangesBatch} from '../source/Change.js'
import {ShaMismatchError} from '../source/ShaMismatchError.js'
import {bundleContents, type Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {compareStrings} from '../source/Utils.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {DocDB, type Doc, type DocDBOptions, type DocLink} from '../docdb/DocDB.js'
import type {
  EntryReference,
  EntryReferenceQuery,
  EntryReferenceResult
} from './EntryReference.js'
import {IndexEvent} from './IndexEvent.js'
import type {EntryCondition} from './EntryIndex.js'

interface EntryDocData {
  id: string
  type: string
  status: EntryStatus
  locale: string | null
  workspace: string
  root: string
  path: string
  title: string
  index: string
  seeded: string | null
  filePath: string
  parentDir: string
  childrenDir: string
  rowHash: string
  fileHash: string
  searchableText: string
  data: Record<string, unknown>
}

interface EntryDocVariant {
  [key: string]: string | null
  status: EntryStatus
  locale: string | null
}

interface EntryDocBuildContext {
  config: Config
  singleWorkspace: string | undefined
}

function isEntryStatus(input: string): input is EntryStatus {
  return input === 'draft' || input === 'published' || input === 'archived'
}

function getNodePath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/')
  const dir = lastSlash === -1 ? '' : filePath.slice(0, lastSlash)
  const name = filePath.slice(lastSlash + 1)
  const lastDot = name.lastIndexOf('.')
  if (lastDot === -1) return filePath
  let base = lastDot === -1 ? name : name.slice(0, lastDot)
  if (base.endsWith('.archived')) base = base.slice(0, -'.archived'.length)
  if (base.endsWith('.draft')) base = base.slice(0, -'.draft'.length)
  return dir ? `${dir}/${base}` : base
}

function entryIdFromFilePath(filePath: string): string {
  return `entry:${getNodePath(filePath)}`
}

function parseEntryDoc(
  ctx: EntryDocBuildContext,
  filePath: string,
  sha: string,
  contents: Uint8Array
): {id: string; parent: string | null; data: EntryDocData} {
  const text = new TextDecoder().decode(contents)
  const raw = JSON.parse(text)
  const {meta, data} = parseRecord(raw)
  const type = meta.type
  const entryType = ctx.config.schema[type]
  assert(entryType, `Type not found: ${type}`)
  const location = entryLocationFromFilePath(ctx, filePath)
  const id = meta.id
  assert(typeof id === 'string', `Invalid entry id in ${filePath}`)
  const parent =
    location.parentDir === location.rootDir
      ? null
      : entryIdFromFilePath(location.parentDir)
  const docData: EntryDocData = {
    id,
    type,
    status: location.status,
    locale: location.locale,
    workspace: location.workspace,
    root: location.root,
    path: location.path,
    title: data.title as string,
    index: meta.index,
    seeded: meta.seeded ?? null,
    filePath,
    parentDir: location.parentDir,
    childrenDir: location.childrenDir,
    rowHash: sha,
    fileHash: sha,
    searchableText: Type.searchableText(entryType, data),
    data
  }
  return {id: entryIdFromFilePath(filePath), parent, data: docData}
}

function entryLocationFromFilePath(
  ctx: EntryDocBuildContext,
  filePath: string
): {
  workspace: string
  root: string
  locale: string | null
  path: string
  status: EntryStatus
  parentDir: string
  childrenDir: string
  rootDir: string
} {
  const segments = filePath.split('/')
  const baseName = segments.at(-1)
  assert(baseName, `Invalid entry file path: ${filePath}`)
  const lastDot = baseName.lastIndexOf('.')
  assert(lastDot !== -1, `Invalid entry file path: ${filePath}`)
  const fileName = baseName.slice(0, lastDot)
  const [path, status] = entryInfo(fileName)
  assert(isEntryStatus(status), `Invalid entry status: ${status}`)
  const parentDir = segments.slice(0, -1).join('/')
  const childrenDir = `${parentDir}/${path}`
  let segmentIndex = 0
  const workspace = ctx.singleWorkspace ?? segments[segmentIndex++]
  const workspaceConfig = ctx.config.workspaces[workspace]
  assert(workspaceConfig, `Invalid workspace: ${workspace} in ${filePath}`)
  const root = segments[segmentIndex++]
  const rootConfig = workspaceConfig[root]
  assert(rootConfig, `Invalid root: ${root} for workspace ${workspace}`)
  const i18n = getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    locale = segments[segmentIndex++].toLowerCase()
    const resolvedLocale = i18n.locales.find(
      candidate => candidate.toLowerCase() === locale
    )
    assert(resolvedLocale, `Invalid locale: ${locale}`)
    locale = resolvedLocale
  }
  return {
    workspace,
    root,
    locale,
    path,
    status,
    parentDir,
    childrenDir,
    rootDir: ConfigUtils.filePath(ctx.config, workspace, root, locale)
  }
}

function entryFromDoc(
  doc: Doc,
  parentId: string | null,
  parents: Array<string>,
  url: string
): Entry {
  const data = doc.data as unknown as EntryDocData
  return {
    id: data.id,
    status: data.status,
    title: data.title,
    type: data.type,
    seeded: data.seeded,
    workspace: data.workspace,
    root: data.root,
    level: doc.level,
    filePath: data.filePath,
    parentDir: data.parentDir,
    childrenDir: data.childrenDir,
    index: data.index,
    parentId,
    parents,
    locale: data.locale,
    rowHash: data.rowHash,
    active: false,
    main: false,
    path: data.path,
    fileHash: data.fileHash,
    url,
    data: data.data,
    searchableText: data.searchableText
  }
}

function statusRank(status: EntryStatus): number {
  switch (status) {
    case 'draft':
      return 0
    case 'published':
      return 1
    case 'archived':
      return 2
  }
}

function nodeIdOfEntryId(id: string): string {
  return id.startsWith('entry:') ? id : `entry:${id}`
}

class EntryDocLanguageNode {
  inheritedStatus: EntryStatus | undefined
  main: Entry
  active: Entry
  locale: string | null
  path: string
  readonly seeded: string | null

  constructor(
    private node: EntryDocNode,
    private entriesByStatus: Map<EntryStatus, Entry>
  ) {
    const [first] = entriesByStatus.values()
    assert(first, 'EntryDocLanguageNode missing entries')
    this.locale = first.locale
    const active =
      entriesByStatus.get('draft') ||
      entriesByStatus.get('published') ||
      entriesByStatus.get('archived')
    assert(active, 'EntryDocLanguageNode missing active entry')
    const parentStatus = node.parent?.get(this.locale)?.inheritedStatus
    if (parentStatus) this.inheritedStatus = parentStatus
    else if (entriesByStatus.has('archived')) this.inheritedStatus = 'archived'
    else if (entriesByStatus.has('draft') && !entriesByStatus.has('published'))
      this.inheritedStatus = 'draft'
    else this.inheritedStatus = undefined
    const main =
      this.inheritedStatus !== undefined
        ? active
        : entriesByStatus.get('published') ||
          entriesByStatus.get('archived') ||
          entriesByStatus.get('draft')
    assert(main, 'EntryDocLanguageNode missing main entry')
    this.active = active
    this.main = main
    this.path = main.path
    this.seeded = main.seeded
  }

  [Symbol.iterator](): IterableIterator<[EntryStatus, Entry]> {
    return this.entriesByStatus[Symbol.iterator]()
  }

  has(status: EntryStatus): boolean {
    return this.entriesByStatus.has(status)
  }

  get entries(): Array<Entry> {
    const entries = this.inheritedStatus
      ? [this.active]
      : [...this.entriesByStatus.values()]
    return entries.map(entry => ({
      ...entry,
      status: this.inheritedStatus ?? entry.status,
      active: entry === this.active,
      main: entry === this.main
    }))
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const entry of this.entries) {
      if (filter.entry && !filter.entry(entry)) continue
      yield entry
    }
  }
}

class EntryDocNode extends Map<string | null, EntryDocLanguageNode> {
  readonly id: string
  readonly index: string
  readonly parentId: string | null
  readonly parents: Array<string>
  readonly workspace: string
  readonly root: string
  readonly type: string
  readonly level: number

  constructor(
    public graph: EntryDocGraph,
    public parent: EntryDocNode | null,
    private childIds: Array<string>,
    docs: Array<Doc>
  ) {
    super()
    const [first] = docs
    assert(first, 'EntryDocNode missing docs')
    const firstData = first.data as unknown as EntryDocData
    this.id = firstData.id
    this.index = firstData.index
    this.workspace = firstData.workspace
    this.root = firstData.root
    this.type = firstData.type
    this.level = first.level
    this.parentId = parent?.id ?? null
    this.parents = parent ? [...parent.parents, parent.id] : []
    const byLocale = new Map<string | null, Map<EntryStatus, Entry>>()
    for (const doc of docs) {
      const data = doc.data as unknown as EntryDocData
      const locale = data.locale
      const group = byLocale.get(locale) ?? new Map<EntryStatus, Entry>()
      const parentPaths = this.parentPaths(locale)
      const entryType = graph.config.schema[data.type]
      assert(entryType, `Type not found: ${data.type}`)
      const entry = entryFromDoc(
        doc,
        this.parentId,
        this.parents,
        entryUrl(entryType, {
          status: data.status,
          path: data.path,
          parentPaths,
          locale,
          workspace: data.workspace,
          root: data.root
        })
      )
      group.set(data.status, entry)
      byLocale.set(locale, group)
    }
    for (const [locale, entries] of byLocale) {
      this.set(locale, new EntryDocLanguageNode(this, entries))
    }
  }

  children(): Iterable<EntryDocNode> {
    return this.childIds
      .map(id => this.graph.byNodeId(id))
      .filter((node): node is EntryDocNode => Boolean(node))
  }

  parentPaths(locale: string | null): Array<string> {
    let current = this.parent
    const paths = Array<string>()
    while (current) {
      const parentLanguage = current.get(locale)
      assert(parentLanguage, 'Missing parent language node')
      paths.unshift(parentLanguage.main.path)
      current = current.parent
    }
    return paths
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const node of this.values()) {
      if (filter.language && !filter.language(node as never)) continue
      yield* node.filter(filter)
    }
  }
}

export class EntryDocGraph {
  #byId = new Map<string, EntryDocNode>()
  #byNodeId = new Map<string, EntryDocNode>()
  #docsByNodeId = new Map<string, Array<Doc>>()
  #childrenByNodeId = new Map<string, Array<string>>()
  nodes: Array<EntryDocNode>

  constructor(
    public config: Config,
    docs: Array<Doc>
  ) {
    for (const doc of docs) {
      const list = this.#docsByNodeId.get(doc.id) ?? []
      list.push(doc)
      this.#docsByNodeId.set(doc.id, list)
      if (doc.parent) {
        const children = this.#childrenByNodeId.get(doc.parent) ?? []
        children.push(doc.id)
        this.#childrenByNodeId.set(doc.parent, children)
      }
    }
    this.nodes = [...this.#docsByNodeId.keys()]
      .map(id => this.#mkNode(id))
      .sort((a, b) => compareStrings(a.index, b.index))
  }

  byId(id: string): EntryDocNode | undefined {
    return this.#byId.get(id)
  }

  byNodeId(id: string): EntryDocNode | undefined {
    return this.#byNodeId.get(id)
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const node of filter.nodes ?? this.nodes) {
      const docNode = node as unknown as EntryDocNode
      if (filter.node && !filter.node(docNode as never)) continue
      yield* docNode.filter(filter)
    }
  }

  #mkNode(id: string): EntryDocNode {
    const cached = this.#byNodeId.get(id)
    if (cached) return cached
    const docs = this.#docsByNodeId.get(id)
    assert(docs, `Missing docs for node: ${id}`)
    const parentId = docs[0].parent
    const parent = parentId ? this.#mkNode(parentId) : null
    const childIds = this.#childrenByNodeId.get(id) ?? []
    const sortedDocs = docs.sort((a, b) => {
      const dataA = a.data as unknown as EntryDocData
      const dataB = b.data as unknown as EntryDocData
      return statusRank(dataA.status) - statusRank(dataB.status)
    })
    const node = new EntryDocNode(this, parent, childIds, sortedDocs)
    this.#byNodeId.set(id, node)
    this.#byId.set(node.id, node)
    return node
  }
}

export class EntryDocIndex extends EventTarget {
  tree = ReadonlyTree.EMPTY
  initialSync: ReadonlyTree | undefined
  graph: EntryDocGraph
  #singleWorkspace: string | undefined

  constructor(
    public config: Config,
    public docs: DocDB
  ) {
    super()
    this.#singleWorkspace = ConfigUtils.multipleWorkspaces(config)
      ? undefined
      : Object.keys(config.workspaces)[0]
    this.graph = new EntryDocGraph(config, [])
  }

  static createDocDB(config: Config, database: DocDB): DocDB {
    void config
    return database
  }

  get sha(): string {
    return this.tree.sha
  }

  filter(filter: EntryCondition): Iterable<Entry> {
    return this.graph.filter(filter)
  }

  findFirst<Data extends Record<string, unknown>>(
    filter: (entry: Entry) => boolean
  ): Entry<Data> | undefined {
    const [entry] = this.findMany(filter)
    return entry as Entry<Data> | undefined
  }

  findMany(filter: (entry: Entry) => boolean): Iterable<Entry> {
    return this.graph.filter({entry: filter})
  }

  byId(id: string): EntryDocNode | undefined {
    return this.graph.byId(id)
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const all = this.docs.referencesTo(nodeIdOfEntryId(query.targetId))
    const references = all
      .map(reference => {
        const source = this.docs.get(reference.id, reference.variant)
        if (!source) return undefined
        const data = source.data as unknown as EntryDocData
        const entry = this.findFirst(item => {
          return (
            item.id === data.id &&
            item.locale === data.locale &&
            item.status === data.status
          )
        })
        if (!entry) return undefined
        const result: EntryReference = {
          targetId: query.targetId,
          sourceId: entry.id,
          sourceFilePath: entry.filePath,
          sourceType: entry.type,
          sourceLocale: entry.locale,
          sourceStatus: entry.status,
          sourceActive: entry.active,
          sourceMain: entry.main,
          fieldPath: reference.path
        }
        return result
      })
      .filter((reference): reference is EntryReference => {
        if (!reference) return false
        if (query.locale !== undefined && reference.sourceLocale !== query.locale)
          return false
        switch (query.status ?? 'published') {
          case 'published':
            return reference.sourceStatus === 'published'
          case 'draft':
            return reference.sourceStatus === 'draft'
          case 'archived':
            return reference.sourceStatus === 'archived'
          case 'preferDraft':
            return reference.sourceActive
          case 'preferPublished':
            return reference.sourceMain
          case 'all':
            return true
        }
      })
    return {
      references,
      total: references.length,
      scan: {
        scanned: this.docs.count({}),
        total: this.docs.count({}),
        complete: true
      }
    }
  }

  async referencesFrom(sourceId: string): Promise<Array<EntryReference>> {
    const result = Array<EntryReference>()
    for (const reference of this.docs.referencesFrom(nodeIdOfEntryId(sourceId))) {
      const source = this.docs.get(reference.id, reference.variant)
      if (!source) continue
      const data = source.data as unknown as EntryDocData
      const entry = this.findFirst(item => {
        return (
          item.id === data.id &&
          item.locale === data.locale &&
          item.status === data.status
        )
      })
      if (!entry) continue
      result.push({
        targetId: reference.target.slice('entry:'.length),
        sourceId: entry.id,
        sourceFilePath: entry.filePath,
        sourceType: entry.type,
        sourceLocale: entry.locale,
        sourceStatus: entry.status,
        sourceActive: entry.active,
        sourceMain: entry.main,
        fieldPath: reference.path
      })
    }
    return result
  }

  async syncWith(source: Source): Promise<string> {
    const tree = await source.getTree()
    if (!this.initialSync) this.initialSync = tree
    const batch = await bundleContents(source, this.tree.diff(tree))
    if (batch.changes.length === 0) return tree.sha
    return this.indexChanges(batch)
  }

  async indexChanges(batch: ChangesBatch): Promise<string> {
    if (batch.fromSha !== this.tree.sha)
      throw new ShaMismatchError(batch.fromSha, this.tree.sha)
    const inserts = Array<{
      id: string
      parent: string | null
      variant: EntryDocVariant
      data: EntryDocData
    }>()
    const removals = Array<{id: string; variant?: EntryDocVariant}>()
    const ctx: EntryDocBuildContext = {
      config: this.config,
      singleWorkspace: this.#singleWorkspace
    }
    for (const change of batch.changes) {
      switch (change.op) {
        case 'delete':
          const location = entryLocationFromFilePath(ctx, change.path)
          removals.push({
            id: entryIdFromFilePath(change.path),
            variant: {
              status: location.status,
              locale: location.locale
            }
          })
          break
        case 'add': {
          assert(change.contents, `Missing contents for ${change.path}`)
          const parsed = parseEntryDoc(
            ctx,
            change.path,
            change.sha,
            change.contents
          )
          inserts.push({
            id: parsed.id,
            parent: parsed.parent,
            variant: {
              status: parsed.data.status,
              locale: parsed.data.locale
            },
            data: parsed.data
          })
          break
        }
      }
    }
    if (removals.length > 0) this.docs.remove(removals)
    if (inserts.length > 0) {
      this.docs.insert(
        inserts.map(insert => ({
          id: insert.id,
          parent: insert.parent,
          kind: 'entry',
          index: insert.data.index,
          variant: insert.variant,
          data: insert.data as unknown as Record<string, unknown>
        }))
      )
    }
    this.tree = await this.tree.withChanges(batch)
    this.refreshGraph()
    const emitted = new Set<string>()
    for (const change of batch.changes) {
      const id = entryIdFromFilePath(change.path).slice('entry:'.length)
      if (emitted.has(id)) continue
      emitted.add(id)
      this.dispatchEvent(new IndexEvent({op: 'entry', id}))
    }
    this.dispatchEvent(new IndexEvent({op: 'index', sha: this.tree.sha}))
    return this.tree.sha
  }

  refreshGraph(): void {
    this.graph = new EntryDocGraph(this.config, this.docs.query({kind: 'entry'}))
  }
}

export function createEntryDocOptions(config: Config): DocDBOptions {
  return {
    extractLinks(data) {
      const entry = data as unknown as EntryDocData
      const type = config.schema[entry.type]
      if (!type) return []
      return Type.references(type, entry.data).map((target): DocLink => {
        return {
          path: target.fieldPath,
          id: nodeIdOfEntryId(target.targetId)
        }
      })
    },
    searchableText(data) {
      const entry = data as unknown as EntryDocData
      return {
        title: entry.title,
        body: entry.searchableText
      }
    },
    indexPaths: ['type', 'path', 'workspace', 'root', 'title'],
    variantIndexPaths: ['status', 'locale']
  }
}
