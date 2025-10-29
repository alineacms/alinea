import MiniSearch from 'minisearch'
import {Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import type {ChangesBatch} from '../source/Change.js'
import {changedSource} from '../source/MemorySource.js'
import type {Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {compareStrings} from '../source/Utils.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {keys} from '../util/Objects.js'
import {EntryTransaction} from './EntryTransaction.js'
import {IndexEvent} from './IndexEvent.js'

export interface EntryFilter {
  ids?: ReadonlyArray<string>
  locales?: ReadonlyArray<string | null>
  search?: string
  condition?(entry: Entry): boolean
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

class EntryLanguage extends Map<EntryStatus, EntryVersion> {
  readonly locale: string | null
  readonly parentDir: string
  readonly selfDir: string
  constructor(versions: Array<EntryVersion>) {
    super(versions.map(phase => [phase.status, phase] as const))
    this.locale = versions[0].locale
    this.parentDir = versions[0].parentDir
    this.selfDir = versions[0].childrenDir
    const [first, ...rest] = versions
    for (const version of rest) {
      if (version.locale !== first.locale) throw new Error(`err: locale`)
      if (version.parentDir !== first.parentDir)
        throw new Error(`err: parentDir`)
      if (version.childrenDir !== first.childrenDir)
        throw new Error(`err: childrenDir`)
      if (version.path !== first.path) throw new Error(`err: path`)
    }
  }
}

class EntryCollection extends Map<string | null, EntryLanguage> {
  readonly type: string
  constructor(public versions: Array<EntryVersion>) {
    super()
    const [first, ...rest] = versions
    this.type = first.type
    for (const version of rest) {
      if (version.type !== first.type) throw new Error(`err: type`)
      if (version.index !== first.index) throw new Error(`err: index`)
      if (version.root !== first.root) throw new Error(`err: root`)
      if (version.workspace !== first.workspace)
        throw new Error(`err: workspace`)
    }
    const byLanguage = new Map<string | null, Array<EntryVersion>>()
    for (const language of versions) {
      const collection = byLanguage.get(language.locale) ?? []
      collection.push(language)
      byLanguage.set(language.locale, collection)
    }
    for (const [locale, entries] of byLanguage) {
      this.set(locale, new EntryLanguage(entries))
    }
  }
}

class EntryLanguageNode {
  inheritedStatus: EntryStatus | undefined
  main: EntryVersion
  active: EntryVersion
  url: string
  locale: string | null
  #entries: Array<Entry> | undefined
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
    this.url = entryUrl(node.type, {
      status: main.status,
      path: main.path,
      parentPaths: this.parentPaths,
      locale: main.locale
    })
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

  get entries() {
    if (this.#entries) return this.#entries
    const entries = (
      this.inheritedStatus ? [this.active] : [...this.language.values()]
    ).map((version): Entry => {
      return {
        ...version,
        parentId: this.node.parentId,
        parents: this.node.parents,
        url: this.url,
        active: version === this.active,
        main: version === this.main
      }
    })
    this.#entries = entries
    return entries
  }

  *filter(filter: EntryFilter): Generator<Entry> {
    for (const entry of this.entries) {
      if (filter.condition && !filter.condition(entry)) continue
      yield entry
    }
  }
}

class EntryNode extends Map<string | null, EntryLanguageNode> {
  readonly id: string
  readonly index: string
  readonly parentId: string | null
  readonly parents: Array<string>

  constructor(
    public type: Type,
    public parent: EntryNode | null,
    collection: EntryCollection
  ) {
    super()
    const first = collection.versions[0]
    this.id = first.id
    this.index = first.index
    this.parentId = parent ? parent.id : null
    this.parents = []
    let current = parent
    while (current) {
      this.parents.unshift(current.id)
      current = current.parentId ? parent : null
    }
    for (const [locale, language] of collection) {
      this.set(locale, new EntryLanguageNode(this, language))
    }
  }

  *filter(filter: EntryFilter): Generator<Entry> {
    for (const node of this.values()) {
      if (filter.locales && !filter.locales.includes(node.locale)) continue
      yield* node.filter(filter)
    }
  }
}

const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u
const DIACRITIC = /\p{Diacritic}/gu

class EntryGraph {
  #config: Config
  #versionData: Map<string, EntryVersionData>
  #filesById = new Map<string, Array<string>>()
  #byId = new Map<string, EntryNode>()
  #byDir = new Map<string, string>()
  #nodes: Array<EntryNode> | undefined
  #singleWorkspace: string | undefined
  #search: MiniSearch

  constructor(config: Config, versionData: Map<string, EntryVersionData>) {
    this.#config = config
    this.#versionData = versionData
    this.#singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
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
    for (const [file, version] of versionData) {
      const files = this.#filesById.get(version.id) ?? []
      files.push(file)
      this.#filesById.set(version.id, files)
      const dir = getNodePath(file)
      this.#byDir.set(dir, version.id)
    }
  }

  withChanges(batch: ChangesBatch) {
    const parser = getParser(this.#config)
    const versions = new Map(this.#versionData)
    for (const change of batch.changes) {
      switch (change.op) {
        case 'delete':
          versions.delete(change.path)
          break
        case 'add':
          if (!change.contents) throw new Error('Missing contents')
          versions.set(change.path, parser.parse(change.sha, change.contents))
          break
      }
    }
    return new EntryGraph(this.#config, versions)
  }

  validate() {
    // If we were able to build the nodes without errors, we're good
    assert(this.nodes)
  }

  *filter({search, ...filter}: EntryFilter): Generator<Entry> {
    if (search) {
      const found = new Set(this.filter(filter))
      for (const entry of found) {
        if (!this.#search.has(entry.filePath)) this.#updateSearch(entry)
      }
      return this.#search
        .search(search, {
          prefix: true,
          fuzzy: 0.1,
          boost: {title: 2},
          filter: result => found.has(result.entry)
        })
        .map(result => result.entry)
    }
    for (const node of this.nodes) {
      if (filter.ids && !filter.ids.includes(node.id)) continue
      yield* node.filter(filter)
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

  get nodes() {
    if (this.#nodes) return this.#nodes
    this.#nodes = [...this.#filesById.keys()]
      .map(file => this.#mkNode(file))
      .sort((a, b) => compareStrings(a.index, b.index))
    return this.#nodes
  }

  #mkEntry(filePath: string): EntryVersion {
    const data = this.#versionData.get(filePath)!
    const segments = filePath.toLowerCase().split('/')
    const baseName = segments.at(-1)
    assert(baseName)
    const lastDot = baseName.lastIndexOf('.')
    assert(lastDot !== -1)
    const fileName = baseName.slice(0, lastDot)
    const [path, status] = entryInfo(fileName)
    const parentDir = segments.slice(0, -1).join('/')
    const childrenDir = `${parentDir}/${path}`
    let segmentIndex = 0
    const workspace = this.#singleWorkspace ?? segments[segmentIndex++]
    const workspaceConfig = this.#config.workspaces[workspace]
    assert(workspaceConfig, `Invalid workspace: ${workspace} in ${filePath}`)
    const root = segments[segmentIndex++]
    const rootConfig = workspaceConfig[root]
    assert(rootConfig, `Invalid root: ${root}`)
    const i18n = getRoot(rootConfig).i18n
    let locale: string | null = null
    if (i18n) {
      locale = segments[segmentIndex++]
      for (const localeCandidate of i18n.locales) {
        if (locale === localeCandidate.toLowerCase()) {
          locale = localeCandidate
          break
        }
      }
    }
    let levelOffset = 1
    if (!this.#singleWorkspace) levelOffset += 1
    if (i18n) levelOffset += 1
    const level = segments.length - levelOffset - 1

    return {
      ...data,
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
      if (parentId !== otherParentId) throw new Error(`err: parentId`)
    }
    const parent = parentId ? this.#mkNode(parentId) : null
    const type = this.#config.schema[collection.type]
    const node = new EntryNode(type, parent, collection)
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
    const version = parseVersion(this.#config, sha, blob)
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

function parseVersion(config: Config, sha: string, blob: Uint8Array) {
  const decoder = new TextDecoder()
  const text = decoder.decode(blob)
  const raw = JSON.parse(text)
  const {meta, data} = parseRecord(raw)
  const entryType = config.schema[meta.type]
  const searchableText = Type.searchableText(entryType, data)
  return {
    id: meta.id,
    type: meta.type,
    index: meta.index,
    data,
    title: data.title as string,
    searchableText,
    seeded: meta.seeded ?? null,
    rowHash: sha,
    fileHash: sha
  }
}

export async function buildGraph(config: Config, source: Source) {
  const tree = await source.getTree()
  const index = tree.index()
  const parser = getParser(config)
  const contents = source.getBlobs(
    [...index.values()].filter(sha => !parser.has(sha))
  )
  for await (const [sha, blob] of contents) {
    parser.parse(sha, blob)
  }
  const entries = [...index].map(([file, sha]) => {
    const version = parser.get(sha)
    if (!version) throw new Error(`Missing version for sha: ${sha}`)
    return [file, version] as const
  })
  return new EntryGraph(config, new Map(entries))
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

export class EntryIndex extends EventTarget {
  tree = ReadonlyTree.EMPTY
  initialSync: ReadonlyTree | undefined
  #graph: EntryGraph
  #config: Config
  constructor(config: Config) {
    super()
    this.#config = config
    this.#graph = new EntryGraph(config, new Map())
  }
  get sha() {
    return this.tree.sha
  }
  findFirst<T extends Record<string, unknown>>(
    filter: (entry: Entry) => boolean
  ): Entry<T> | undefined {
    const [entry] = this.findMany(filter)
    return entry as Entry<T> | undefined
  }
  findMany(filter: (entry: Entry) => boolean): Iterable<Entry> {
    return this.#graph.filter({condition: filter})
  }
  async syncWith(source: Source): Promise<string> {
    const tree = await source.getTree()
    if (!this.initialSync) this.initialSync = tree
    const sha = tree.sha
    const graph = await buildGraph(this.#config, source)
    this.tree = tree
    this.#graph = graph
    this.dispatchEvent(new IndexEvent({op: 'index', sha}))
    return sha
  }
  async indexChanges(batch: ChangesBatch) {
    const {changes} = batch
    if (changes.length === 0) return this.tree.sha
    this.#graph = this.#graph.withChanges(batch)
    const updatedTree = await this.tree.withChanges(batch)
    const sha = updatedTree.sha
    this.tree = updatedTree
    this.dispatchEvent(new IndexEvent({op: 'index', sha}))
    return sha
  }
  async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.#config, this, source, from)
  }
}
