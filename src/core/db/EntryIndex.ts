import * as paths from 'alinea/core/util/Paths'
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
import {ReadonlyTree} from '../source/Tree.js'
import {compareStrings} from '../source/Utils.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {entries, keys} from '../util/Objects.js'
import {slugify} from '../util/Slugs.js'
import {sourceChanges} from './CommitRequest.js'
import {EntryTransaction} from './EntryTransaction.js'
import {IndexEvent} from './IndexEvent.js'

export interface EntryFilter {
  ids?: ReadonlyArray<string>
  search?: string
  condition?(entry: Entry): boolean
}

export interface EntryCondition {
  search?: string
  nodes?: Iterable<EntryNode>
  node?(node: EntryNode): boolean
  language?(language: EntryLanguageNode): boolean
  row?(row: EntryRow): boolean
  entry?(entry: Entry): boolean
}

export function combineConditions(
  a: EntryCondition,
  b: EntryCondition
): EntryCondition {
  return {
    search: a.search ?? b.search,
    nodes: a.nodes ?? b.nodes,
    node(node) {
      return (a.node ? a.node(node) : true) && (b.node ? b.node(node) : true)
    },
    language(language) {
      return (
        (a.language ? a.language(language) : true) &&
        (b.language ? b.language(language) : true)
      )
    },
    row(row) {
      return (a.row ? a.row(row) : true) && (b.row ? b.row(row) : true)
    },
    entry(entry) {
      return (
        (a.entry ? a.entry(entry) : true) && (b.entry ? b.entry(entry) : true)
      )
    }
  }
}

interface EntryVersionData {
  id: string
  type: string
  index: string
  searchableText: string
  title: string
  data: Record<string, unknown>
  seeded: string | null
  rowHash: string
  fileHash: string
}

interface EntryVersion extends EntryVersionData {
  locale: string | null
  workspace: string
  root: string
  path: string
  status: EntryStatus
  parentDir: string
  childrenDir: string
  filePath: string
  level: number
}

export interface EntryRow {
  readonly id: string
  readonly type: string
  readonly index: string
  readonly searchableText: string
  readonly title: string
  readonly data: Record<string, unknown>
  readonly seeded: string | null
  readonly rowHash: string
  readonly fileHash: string
  readonly locale: string | null
  readonly workspace: string
  readonly root: string
  readonly path: string
  readonly status: EntryStatus
  readonly parentDir: string
  readonly childrenDir: string
  readonly filePath: string
  readonly level: number
  readonly parentId: string | null
  readonly active: boolean
  readonly main: boolean
  readonly parents: Array<string>
  readonly url: string
  field(name: string): unknown
  entryField(name: string): unknown
  toEntry(): Entry
}

class EntryLanguage {
  readonly locale: string | null
  readonly parentDir: string
  readonly selfDir: string
  #versions: Array<EntryVersion>
  #draft: EntryVersion | undefined
  #published: EntryVersion | undefined
  #archived: EntryVersion | undefined

  constructor(versions: Array<EntryVersion>) {
    this.#versions = versions
    this.locale = versions[0].locale
    this.parentDir = versions[0].parentDir
    this.selfDir = versions[0].childrenDir
    const first = versions[0]
    for (const version of versions) {
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
      switch (version.status) {
        case 'draft':
          this.#draft = version
          break
        case 'published':
          this.#published = version
          break
        case 'archived':
          this.#archived = version
          break
      }
    }
  }

  get(status: EntryStatus): EntryVersion | undefined {
    switch (status) {
      case 'draft':
        return this.#draft
      case 'published':
        return this.#published
      case 'archived':
        return this.#archived
    }
  }

  has(status: EntryStatus): boolean {
    return this.get(status) !== undefined
  }

  values(): IterableIterator<EntryVersion> {
    return this.#versions.values()
  }

  *[Symbol.iterator](): IterableIterator<[EntryStatus, EntryVersion]> {
    for (const version of this.#versions) yield [version.status, version]
  }
}

class EntryCollection {
  readonly type: string
  #languages: Array<[string | null, EntryLanguage]>

  constructor(public versions: Array<EntryVersion>) {
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
    const byLanguage = new Map<string | null, Array<EntryVersion>>()
    for (const language of versions) {
      const collection = byLanguage.get(language.locale) ?? []
      collection.push(language)
      byLanguage.set(language.locale, collection)
    }
    this.#languages = Array.from(byLanguage, ([locale, entries]) => {
      return [locale, new EntryLanguage(entries)]
    })
  }

  values(): IterableIterator<EntryLanguage> {
    return this.#languages.map(([, language]) => language).values()
  }

  [Symbol.iterator](): IterableIterator<[string | null, EntryLanguage]> {
    return this.#languages.values()
  }
}

class EntryLanguageNode {
  inheritedStatus: EntryStatus | undefined
  main: EntryVersion
  active: EntryVersion
  #url: string | undefined
  locale: string | null
  path: string
  #rows: Array<EntryRow> | undefined
  readonly seeded: string | null = null
  constructor(
    private node: EntryNode,
    private language: EntryLanguage
  ) {
    this.locale = language.locale
    const active =
      language.get('draft') ||
      language.get('published') ||
      language.get('archived')
    const parentStatus = node.parent?.get(language.locale)?.inheritedStatus
    if (parentStatus) this.inheritedStatus = parentStatus
    else if (language.has('archived')) this.inheritedStatus = 'archived'
    else if (language.has('draft') && !language.has('published'))
      this.inheritedStatus = 'draft'
    else this.inheritedStatus = undefined
    let main: EntryVersion | undefined
    if (this.inheritedStatus) main = active
    else
      main =
        language.get('published') ||
        language.get('archived') ||
        language.get('draft')
    assert(main, `EntryLanguageNode missing main version`)
    this.main = main
    assert(active, `EntryLanguageNode missing active version`)
    this.active = active
    this.path = this.main.path
    this.seeded = this.main.seeded
  }

  get url(): string {
    this.#url ??= entryUrl(this.node.entryType, {
      status: this.main.status,
      path: this.main.path,
      parentPaths: this.parentPaths,
      locale: this.main.locale,
      workspace: this.node.workspace,
      root: this.node.root
    })
    return this.#url
  }

  [Symbol.iterator]() {
    return this.language[Symbol.iterator]()
  }

  has(status: EntryStatus) {
    return this.language.has(status)
  }

  get parentPaths() {
    let current = this.node.parent
    const paths: Array<string> = []
    while (current) {
      const parentLanguage = current.get(this.locale)
      assert(parentLanguage, `Missing parent language node`)
      paths.unshift(parentLanguage.main.path)
      current = current.parent
    }
    return paths
  }

  get rows() {
    if (this.#rows) return this.#rows
    const rows = (
      this.inheritedStatus ? [this.active] : [...this.language.values()]
    ).map(version => {
      return new EntryRowImpl(this.node, this, version)
    })
    this.#rows = rows
    return rows
  }

  *rowsMatching(filter: EntryCondition): Generator<EntryRow> {
    for (const row of this.rows) {
      if (filter.row && !filter.row(row)) continue
      if (filter.entry && !filter.entry(row.toEntry())) continue
      yield row
    }
  }
}

class EntryRowImpl implements EntryRow {
  #entry: Entry | undefined

  constructor(
    private node: EntryNode,
    private language: EntryLanguageNode,
    private version: EntryVersion
  ) {}

  get id() {
    return this.version.id
  }

  get type() {
    return this.version.type
  }

  get index() {
    return this.version.index
  }

  get searchableText() {
    return this.version.searchableText
  }

  get title() {
    return this.version.title
  }

  get data() {
    return this.version.data
  }

  get seeded() {
    return this.version.seeded
  }

  get rowHash() {
    return this.version.rowHash
  }

  get fileHash() {
    return this.version.fileHash
  }

  get locale() {
    return this.version.locale
  }

  get workspace() {
    return this.version.workspace
  }

  get root() {
    return this.version.root
  }

  get path() {
    return this.version.path
  }

  get status() {
    return this.language.inheritedStatus ?? this.version.status
  }

  get parentDir() {
    return this.version.parentDir
  }

  get childrenDir() {
    return this.version.childrenDir
  }

  get filePath() {
    return this.version.filePath
  }

  get level() {
    return this.version.level
  }

  get parentId() {
    return this.node.parentId
  }

  get active() {
    return this.version === this.language.active
  }

  get main() {
    return this.version === this.language.main
  }

  get parents() {
    return this.node.parents
  }

  get url() {
    return this.language.url
  }

  field(name: string) {
    return this.version.data[name]
  }

  entryField(name: string) {
    switch (name) {
      case 'id':
        return this.id
      case 'type':
        return this.type
      case 'index':
        return this.index
      case 'searchableText':
        return this.searchableText
      case 'title':
        return this.title
      case 'data':
        return this.data
      case 'seeded':
        return this.seeded
      case 'rowHash':
        return this.rowHash
      case 'fileHash':
        return this.fileHash
      case 'locale':
        return this.locale
      case 'workspace':
        return this.workspace
      case 'root':
        return this.root
      case 'path':
        return this.path
      case 'status':
        return this.status
      case 'parentDir':
        return this.parentDir
      case 'childrenDir':
        return this.childrenDir
      case 'filePath':
        return this.filePath
      case 'level':
        return this.level
      case 'parentId':
        return this.parentId
      case 'active':
        return this.active
      case 'main':
        return this.main
      case 'parents':
        return this.parents
      case 'url':
        return this.url
      default:
        return undefined
    }
  }

  toEntry(): Entry {
    if (this.#entry) return this.#entry
    const row = this
    this.#entry = {
      ...this.version,
      status: this.status,
      parentId: this.parentId,
      active: this.active,
      main: this.main,
      get parents() {
        return row.parents
      },
      get url() {
        return row.url
      }
    }
    return this.#entry
  }
}

export class EntryNode extends Map<string | null, EntryLanguageNode> {
  readonly id: string
  readonly index: string
  readonly parentId: string | null
  #parents: Array<string> | undefined
  readonly workspace: string
  readonly root: string
  readonly type: string
  readonly level: number

  constructor(
    public graph: EntryGraph,
    public entryType: Type,
    public parent: EntryNode | null,
    public children: () => Iterable<EntryNode>,
    collection: EntryCollection
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
    for (const [locale, language] of collection) {
      this.set(locale, new EntryLanguageNode(this, language))
    }
  }

  get parents(): Array<string> {
    if (this.#parents) return this.#parents
    const parents = Array<string>()
    let next = this.parent
    while (next) {
      assert(!parents.includes(next.id), `Cyclic parent reference: ${parents}`)
      parents.unshift(next.id)
      next = next.parent
    }
    this.#parents = parents
    return parents
  }

  *rows(filter: EntryCondition): Generator<EntryRow> {
    for (const node of this.values()) {
      if (filter.language && !filter.language(node)) continue
      yield* node.rowsMatching(filter)
    }
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const row of this.rows(filter)) yield row.toEntry()
  }
}

const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u
const DIACRITIC = /\p{Diacritic}/gu

export class EntryGraph {
  #config: Config
  #versionData: Map<string, EntryVersionData>
  #filesById = new Map<string, Array<string>>()
  #byId = new Map<string, EntryNode>()
  #byDir = new Map<string, string>()
  nodes: Array<EntryNode>
  #singleWorkspace: string | undefined
  #search: MiniSearch
  #seeds: Map<string, Seed>

  constructor(
    config: Config,
    versionData: Map<string, EntryVersionData>,
    seeds: Map<string, Seed>
  ) {
    this.#config = config
    this.#versionData = versionData
    this.#seeds = seeds
    this.#singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
    this.#search = new MiniSearch({
      fields: ['title', 'searchableText'],
      tokenize(text) {
        return text
          .normalize('NFD')
          .replace(DIACRITIC, '')
          .split(SPACE_OR_PUNCTUATION)
      }
    })
    for (const [file, version] of versionData) {
      const files = this.#filesById.get(version.id) ?? []
      files.push(file)
      this.#filesById.set(version.id, files)
      const dir = getNodePath(file)
      this.#byDir.set(dir, version.id)
    }

    this.nodes = [...this.#filesById.keys()]
      .map(file => this.#mkNode(file))
      .sort((a, b) => compareStrings(a.index, b.index))
  }

  byId(id: string) {
    return this.#byId.get(id)
  }

  get config() {
    return this.#config
  }

  byDir(dir: string) {
    const id = this.#byDir.get(dir)
    if (!id) return undefined
    return this.byId(id)
  }

  withChanges(batch: ChangesBatch) {
    const parser = getParser(this.#config)
    const versions = new Map(this.#versionData)
    for (const change of batch.changes) {
      switch (change.op) {
        case 'delete':
          assert(versions.delete(change.path), 'Missing version to delete')
          break
        case 'add':
          assert(change.contents, 'Missing contents')
          versions.set(change.path, parser.parse(change.sha, change.contents))
          break
      }
    }
    return new EntryGraph(this.#config, versions, this.#seeds)
  }

  *rows({search, ...filter}: EntryCondition): Generator<EntryRow> {
    if (search) {
      const found = new Map<string, EntryRow>()
      for (const row of this.rows(filter)) {
        found.set(row.filePath, row)
        if (!this.#search.has(row.filePath)) this.#updateSearch(row)
      }
      const results = this.#search
        .search(search, {
          prefix: true,
          fuzzy: 0.1,
          boost: {title: 2},
          filter: result => found.has(result.id)
        })
        .map(result => found.get(result.id)!)
      yield* results
      return
    }
    for (const node of filter.nodes ?? this.nodes) {
      if (filter.node && !filter.node(node)) continue
      yield* node.rows(filter)
    }
  }

  *filter(filter: EntryCondition): Generator<Entry> {
    for (const row of this.rows(filter)) yield row.toEntry()
  }

  #updateSearch(row: EntryRow) {
    this.#search.add({
      id: row.filePath,
      title: row.title,
      searchableText: row.searchableText
    })
  }

  #mkEntry(filePath: string): EntryVersion {
    const version = this.#versionData.get(filePath)!
    const segments = filePath.split('/')
    const baseName = segments.at(-1)
    assert(baseName)
    const lastDot = baseName.lastIndexOf('.')
    assert(lastDot !== -1)
    const fileName = baseName.slice(0, lastDot)
    const [path, status] = entryInfo(fileName)
    const parentDir = segments.slice(0, -1).join('/')
    const childrenDir = `${parentDir}/${path}`
    const seed = this.#seeds.get(childrenDir)
    const data: Record<string, unknown> = {path, ...version.data, ...seed?.data}
    let segmentIndex = 0
    const workspace = this.#singleWorkspace ?? segments[segmentIndex++]
    const workspaceConfig = this.#config.workspaces[workspace]
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
    if (!this.#singleWorkspace) levelOffset += 1
    if (i18n) levelOffset += 1
    const level = segments.length - levelOffset - 1

    return {
      ...version,
      data,
      title: data.title as string,
      locale,
      workspace,
      root,
      path,
      status,
      parentDir,
      childrenDir,
      filePath,
      level
    }
  }

  #mkNode(id: string): EntryNode {
    if (this.#byId.has(id)) return this.#byId.get(id)!
    const files = this.#filesById.get(id)!
    // Todo: these can be cached
    const collection = new EntryCollection(
      files.map(file => this.#mkEntry(file))
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
    const type = this.#config.schema[collection.type]
    function* children(this: EntryGraph) {
      for (const node of this.nodes) {
        if (node.parentId === id) yield node
      }
    }
    const node = new EntryNode(
      this,
      type,
      parent,
      children.bind(this),
      collection
    )
    this.#byId.set(id, node)
    return node
  }
}

class VersionParser extends Map<string, EntryVersionData> {
  #config: Config
  constructor(config: Config) {
    super()
    this.#config = config
  }
  parse(sha: string, blob: Uint8Array): EntryVersionData {
    if (super.has(sha)) return super.get(sha)!
    const decoder = new TextDecoder()
    const text = decoder.decode(blob)
    const raw = JSON.parse(text)
    const {meta, data} = parseRecord(raw)
    const entryType = this.#config.schema[meta.type]
    assert(entryType, `Unknown type: ${meta.type}`)
    let searchableText: string | undefined
    const version: EntryVersionData = {
      id: meta.id,
      type: meta.type,
      index: meta.index,
      data,
      title: data.title as string,
      seeded: meta.seeded ?? null,
      rowHash: sha,
      fileHash: sha,
      get searchableText() {
        searchableText ??= Type.searchableText(entryType, data)
        return searchableText
      }
    }
    this.set(sha, version)
    return version
  }
}

class ParserCache extends WeakMap<Config, VersionParser> {
  get = (config: Config) => {
    if (!this.has(config)) this.set(config, new VersionParser(config))
    return super.get(config)!
  }
}

const getParser = new ParserCache().get

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

export class EntryIndex extends EventTarget {
  tree = ReadonlyTree.EMPTY
  initialSync: ReadonlyTree | undefined
  graph: EntryGraph
  #config: Config
  #seeds: Map<string, Seed>
  #singleWorkspace: string | undefined
  constructor(config: Config) {
    super()
    this.#config = config
    this.#seeds = entrySeeds(config)
    this.graph = new EntryGraph(config, new Map(), this.#seeds)
    this.#singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
  }
  get sha() {
    return this.tree.sha
  }
  filter(filter: EntryCondition): Iterable<Entry> {
    return this.graph.filter(filter)
  }
  rows(filter: EntryCondition): Iterable<EntryRow> {
    return this.graph.rows(filter)
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
  async syncWith(source: Source): Promise<string> {
    const tree = await source.getTree()
    if (!this.initialSync) this.initialSync = tree
    const batch = await bundleContents(source, this.tree.diff(tree))
    if (batch.changes.length === 0) return tree.sha
    return this.indexChanges(batch)
  }
  async indexChanges(batch: ChangesBatch) {
    const {fromSha, changes} = batch
    if (fromSha !== this.tree.sha)
      throw new ShaMismatchError(fromSha, this.tree.sha)
    if (changes.length === 0) return this.tree.sha
    const changed = new Set<EntryNode>()
    for (const change of changes) {
      if (change.op !== 'delete') continue
      const nodePath = getNodePath(change.path)
      const node = this.graph.byDir(nodePath)
      assert(node, `Missing node for deleted path: ${change.path}`)
      changed.add(node)
    }
    this.graph = this.graph.withChanges(batch)
    for (const change of changes) {
      if (change.op !== 'add') continue
      const nodePath = getNodePath(change.path)
      const node = this.graph.byDir(nodePath)
      assert(node, `Missing node for added path: ${change.path}`)
      changed.add(node)
    }
    const updatedTree = await this.tree.withChanges(batch)
    const sha = updatedTree.sha
    this.tree = updatedTree
    const pool = Array.from(changed)
    while (pool.length > 0) {
      const node = pool.shift()!
      this.dispatchEvent(new IndexEvent({op: 'entry', id: node.id}))
      for (const child of node.children()) {
        if (!changed.has(child)) pool.push(child)
      }
    }
    this.dispatchEvent(new IndexEvent({op: 'index', sha}))
    return sha
  }
  async seed(source: Source) {
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
        // Find by seeded path
        const pathSegments = nodePath
          .split('/')
          .slice(this.#singleWorkspace ? 1 : 2)
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
  byId(id: string): EntryNode | undefined {
    return this.graph.byId(id)
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
            locale: locale,
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
