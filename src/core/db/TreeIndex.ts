import {Config} from 'alinea/core/Config'
import type {Entry, EntryStatus} from 'alinea/core/Entry'
import {type EntryRecord, parseRecord} from 'alinea/core/EntryRecord'
import {getRoot} from 'alinea/core/Internal'
import {Page} from 'alinea/core/Page'
import {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import {entryInfo, entryUrl} from 'alinea/core/util/EntryFilenames'
import {entries, keys} from 'alinea/core/util/Objects'
import {slugify} from 'alinea/core/util/Slugs'
import MiniSearch from 'minisearch'
import type {EntryData} from '../Entry.js'
import type {Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {assert} from '../source/Utils.js'
import {accumulate} from '../util/Async.js'
import {assign} from '../util/Objects.js'

interface Seed {
  seedId: string
  type: string
  workspace: string
  root: string
  locale: string | null
  data: Record<string, any>
}

const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u
const DIACRITIC = /\p{Diacritic}/gu

export interface EntryFilter {
  ids?: ReadonlyArray<string>
  search?: string
  condition?: (entry: Entry) => boolean
}

export class TreeIndex {
  config: Config
  entries = new Map<string, EntryNode>()
  #singleWorkspace: string | undefined
  #built = new WeakMap<EntryInfo, Entry>()
  #seeds: Map<string, Seed>
  #search!: MiniSearch
  #sha = ReadonlyTree.EMPTY.sha

  constructor(config: Config) {
    this.config = config
    this.#seeds = entrySeeds(config)
    this.#singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
    this.clear()
  }

  get sha() {
    return this.#sha
  }

  findFirst(filter: (entry: Entry) => boolean): Entry | undefined {
    const [entry] = this.findMany(filter)
    return entry
  }

  *findMany(filter: (entry: Entry) => boolean): Iterable<Entry> {
    for (const node of this.entries.values())
      for (const entry of node.entries()) if (filter(entry)) yield entry
  }

  filter({ids, search, condition}: EntryFilter, preview?: Entry): Array<Entry> {
    if (search) {
      const entries = this.filter({ids, condition})
      for (const entry of entries) {
        if (!this.#search.has(entry.filePath)) {
          this.updateSearch(entry)
        }
      }
      return this.#search
        .search(search, {
          prefix: true,
          fuzzy: 0.1,
          boost: {title: 2},
          filter: result => {
            if (ids) return ids.includes(result.entry.id)
            if (condition) return condition(result.entry)
            return true
          }
        })
        .map(result => result.entry)
    }
    const nodes = ids
      ? ids.map(id => this.entries.get(id))
      : this.entries.values()
    const results = []
    for (const node of nodes) {
      if (!node) continue
      for (const e of node.entries()) {
        const entry =
          preview && e.id === preview.id && e.locale === preview.locale
            ? preview
            : e
        if (condition && !condition(entry)) continue
        results.push(entry)
      }
    }
    if (preview) {
      if (!condition || condition?.(preview)) results.push(preview)
    }
    return results
  }

  async updateSearch(entry: Entry) {
    this.#search.add({
      id: entry.filePath,
      title: entry.title,
      searchableText: entry.searchableText,
      entry
    })
  }

  clear() {
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
  }

  async build(source: Source) {
    this.clear()
    const entries = new Map<string, EntryNode>()
    const tree = await source.getTree()
    const root = TreeLevel.create(tree)
    const todo = Array.from(root.index())
    const shas = todo
      .filter(info => !this.#built.has(info))
      .map(info => info.sha)
    const blobs = new Map(await accumulate(source.getBlobs(shas)))
    let entry: Entry | undefined
    for (const info of todo) {
      const prebuilt = this.#built.get(info)
      if (prebuilt) {
        entry = prebuilt
      } else {
        entry = this.create(info, blobs.get(info.sha)!, entry)
        this.#built.set(info, entry)
      }
      const node = entries.get(entry.id)
      if (!node) {
        const newNode = new EntryNode(entry)
        entries.set(entry.id, newNode)
      } else {
        assert(
          node.id === entry.id,
          `Invalid ID: ${entry.id} in ${entry.filePath}`
        )
        node.add(entry)
      }
    }
    this.entries = entries
    this.#sha = tree.sha
  }

  create(
    {sha, segments, status, active, main}: EntryInfo,
    contents: Uint8Array,
    previous: Entry | undefined
  ): Entry {
    const path = segments.at(-1)
    assert(path)

    const parentDir = segments.slice(0, -1).join('/')
    const childrenDir = `${parentDir}/${segments}`
    const file = `${parentDir}/${path}.json`

    let raw: unknown
    try {
      const data = new TextDecoder().decode(contents)
      raw = JSON.parse(data)
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${file} - ${error}`)
    }
    assert(typeof raw === 'object')

    const {meta: record, data: fields} = parseRecord(raw as EntryRecord)
    const data: Record<string, unknown> = {
      path: segments,
      // ...seed?.data, <--- todo
      ...fields
    }
    const id = record.id
    const type = record.type
    const index = record.index

    const parentId =
      previous?.id === id
        ? previous.parentId
        : previous?.parentDir === parentDir
          ? previous.id
          : null

    let segmentIndex = 0
    const workspace = this.#singleWorkspace ?? segments[segmentIndex++]
    const workspaceConfig = this.config.workspaces[workspace]
    assert(workspaceConfig, `Invalid workspace: ${workspace} in ${file}`)
    const root = segments[segmentIndex++]
    const rootConfig = workspaceConfig[root]

    assert(rootConfig, `Invalid root: ${root}`)
    const i18n = getRoot(rootConfig).i18n
    let levelOffset = 1
    if (!this.#singleWorkspace) levelOffset += 1
    if (i18n) levelOffset += 1
    const level = segments.length - levelOffset
    const entryData = {
      id,
      parentId,
      type,
      index,
      workspace,
      root,
      level
    }

    const title = data.title as string
    let locale: string | null = null
    if (i18n) {
      locale = segments[segmentIndex++].toLowerCase()
      for (const localeCandidate of i18n.locales) {
        if (locale === localeCandidate.toLowerCase()) {
          locale = localeCandidate
          break
        }
      }
    }
    const entryType = this.config.schema[type]
    assert(entryType, `Invalid type: ${type} in ${file} (${workspace}/${root})`)
    const searchableText = Type.searchableText(entryType, data)

    const url = entryUrl(entryType, {
      locale,
      status,
      path,
      parentPaths: segments.slice(0, -1)
    })

    return {
      ...entryData,

      rowHash: sha,
      fileHash: sha,

      filePath: file,
      seeded: record.seeded ?? null,

      status,

      parentDir,
      childrenDir,
      locale,

      path,
      title,
      data,
      searchableText,

      url,
      active,
      main
    }
  }
}

interface EntryInfo {
  sha: string
  status: EntryStatus
  segments: Array<string>
  active: boolean
  main: boolean
}

class TreeLevel {
  #tree: ReadonlyTree
  #versions: Versions
  #segments: Array<string>
  #children = new Map<string, TreeLevel>()

  private constructor(tree: ReadonlyTree, segments: Array<string>) {
    this.#tree = tree
    this.#segments = segments
    this.#versions = new Versions(segments)
    for (const [key, entry] of tree.nodes) {
      if (entry.type === 'blob') {
        const fileName = key.slice(0, -'.json'.length)
        const [name, status] = entryInfo(fileName)
        const level = this.#create(name)
        level.#versions.set(status, {sha: entry.sha})
      } else {
        this.#create(key)
      }
    }
  }

  static #cached = new Map<string, TreeLevel>()
  static create(tree: ReadonlyTree, segments: Array<string> = []) {
    const key = [tree.sha, ...segments].join('.')
    if (TreeLevel.#cached.has(key)) return TreeLevel.#cached.get(key)!
    const level = new TreeLevel(tree, segments)
    TreeLevel.#cached.set(key, level)
    return level
  }

  #create(name: string): TreeLevel {
    if (this.#children.has(name)) return this.#children.get(name)!
    const children = this.#tree.get(name)
    const node = TreeLevel.create(
      children?.type === 'tree' ? children : ReadonlyTree.EMPTY,
      this.#segments.concat(name)
    )
    this.#children.set(name, node)
    return node
  }

  *index(): Generator<EntryInfo> {
    if (this.#versions.size > 0) {
      for (const status of this.#versions.keys()) {
        yield this.#versions.info(status)
      }
    }
    for (const node of this.#children.values()) {
      yield* node.index()
    }
  }
}

class EntryNode implements EntryData {
  id!: string
  parentId!: string | null
  type!: string
  workspace!: string
  root!: string
  level!: number
  index!: string

  locales = new Map<string | null, Map<EntryStatus, Entry>>()

  constructor(from: EntryData) {
    assign(this, from)
  }

  pathOf(locale: string | null): string | undefined {
    const versions = this.locales.get(locale)
    if (!versions) return
    const [version] = versions.values()
    if (!version) return
    return version.path
  }

  *entries() {
    for (const locale of this.locales.values()) {
      for (const entry of locale.values()) {
        yield entry
      }
    }
  }

  add(entry: Entry) {
    if (!this.locales.has(entry.locale))
      this.locales.set(entry.locale, new Map())
    const locale = this.locales.get(entry.locale)!
    locale.set(entry.status, entry)

    assert(this.id === entry.id, `Invalid ID: ${entry.id}`)
    assert(
      this.parentId === entry.parentId,
      `Invalid parent ID: ${entry.parentId}`
    )
    assert(this.type === entry.type, `Invalid type: ${entry.type}`)
    assert(
      this.workspace === entry.workspace,
      `Invalid workspace: ${entry.workspace}`
    )
    assert(this.root === entry.root, `Invalid root: ${entry.root}`)
    assert(this.level === entry.level, `Invalid level: ${entry.level}`)
  }
}

interface VersionInfo {
  sha: string
}

class Versions extends Map<EntryStatus, VersionInfo> {
  #cache = new Map<EntryStatus, EntryInfo>()
  #segments: Array<string>
  constructor(segments: Array<string>) {
    super()
    this.#segments = segments
  }
  info(status: EntryStatus): EntryInfo {
    let info = this.#cache.get(status)
    if (info) return info
    info = {
      sha: this.get(status)!.sha,
      segments: this.#segments,
      status,
      active: this.active === status,
      main: this.main === status
    }
    this.#cache.set(status, info)
    return info as EntryInfo
  }
  get active(): EntryStatus {
    if (this.has('draft')) return 'draft'
    if (this.has('published')) return 'published'
    if (this.has('archived')) return 'archived'
    throw new Error('No active version found')
  }
  get main(): EntryStatus {
    if (this.has('published')) return 'published'
    if (this.has('archived')) return 'archived'
    if (this.has('draft')) return 'draft'
    throw new Error('No main version found')
  }
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
