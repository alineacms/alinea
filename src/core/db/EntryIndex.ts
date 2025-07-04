import {Config} from 'alinea/core/Config'
import type {Entry, EntryStatus} from 'alinea/core/Entry'
import {
  type EntryRecord,
  createRecord,
  parseRecord
} from 'alinea/core/EntryRecord'
import {getRoot} from 'alinea/core/Internal'
import {Page} from 'alinea/core/Page'
import {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import {entryInfo, entryUrl} from 'alinea/core/util/EntryFilenames'
import {entries, keys} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import MiniSearch from 'minisearch'
import type {EntryData} from '../Entry.js'
import {createId} from '../Id.js'
import {hashBlob} from '../source/GitUtils.js'
import type {Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {assert, compareStrings} from '../source/Utils.js'
import {accumulate} from '../util/Async.js'
import {assign} from '../util/Objects.js'
import {sourceChanges} from './CommitRequest.js'
import {EntryTransaction} from './EntryTransaction.js'
import {IndexEvent} from './IndexEvent.js'

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

export class EntryIndex extends EventTarget {
  config: Config
  sorted: Array<Entry> = []
  byId = new Map<string, EntryNode>()
  byPath = new Map<string, EntryNode>()
  initialSync: ReadonlyTree | undefined
  #singleWorkspace: string | undefined
  #built = new WeakMap<EntryInfo, Entry>()
  #seeds: Map<string, Seed>
  #search!: MiniSearch
  #sha = ReadonlyTree.EMPTY.sha

  constructor(config: Config) {
    super()
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
    for (const node of this.byId.values())
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
    const entries = ids
      ? ids
          .map(id => this.byId.get(id))
          .filter(Boolean)
          .sort((a, b) => compareStrings(a!.index, b!.index))
          .flatMap(node => Array.from(node!.entries()))
      : this.sorted
    const results = []
    for (const e of entries) {
      const entry =
        preview && e.id === preview.id && e.locale === preview.locale
          ? preview
          : e
      if (condition && !condition(entry)) continue
      results.push(entry)
    }
    if (preview && !results.includes(preview)) {
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

  async syncWith(source: Source) {
    this.clear()
    const byId = new Map<string, EntryNode>()
    const byPath = new Map<string, EntryNode>()
    const tree = await source.getTree()
    if (!this.initialSync) this.initialSync = tree
    const root = TreeLevel.create(tree)
    const todo = Array.from(root.index())
    const shas = todo
      .filter(info => !this.#built.has(info))
      .map(info => info.sha)
    const blobs = new Map(await accumulate(source.getBlobs(shas)))
    let entry: Entry | undefined
    const changed = new Set<string>()
    for (const info of todo) {
      const prebuilt = this.#built.get(info)
      if (prebuilt) {
        entry = prebuilt
      } else {
        const parent = byPath.get(info.segments.slice(0, -1).join('/'))
        entry = this.create(info, blobs.get(info.sha)!, parent)
        this.#built.set(info, entry)
        changed.add(entry.id)
      }
      let node = byId.get(entry.id)
      if (!node) {
        node = new EntryNode({
          id: entry.id,
          parentId: entry.parentId,
          type: entry.type,
          workspace: entry.workspace,
          root: entry.root,
          level: entry.level,
          index: entry.index
        })
        byId.set(entry.id, node)
      } else {
        assert(
          node.id === entry.id,
          `Invalid ID: ${entry.id} in ${entry.filePath}`
        )
      }
      byPath.set(entry.childrenDir, node)
      const parent = entry.parentId ? byId.get(entry.parentId) : undefined
      node.add(entry, parent)
      for (const entryId of changed) {
        this.dispatchEvent(new IndexEvent({op: 'entry', id: entryId}))
      }
      this.dispatchEvent(new IndexEvent({op: 'index', sha: tree.sha}))
    }

    this.byId = byId
    this.byPath = byPath
    this.sorted = []
    for (const node of byId.values()) {
      for (const path of node.paths()) {
        this.byPath.set(path, node)
      }
      this.sorted.push(...node.entries())
    }
    this.sorted.sort((a, b) => compareStrings(a.index, b.index))
    this.#sha = tree.sha
  }

  async fix(source: Source) {
    const tree = await source.getTree()
    const tx = await this.transaction(source)
    for (const node of this.byId.values()) {
      for (const entry of node.entries()) {
        const record = createRecord(entry, entry.status)
        const contents = new TextEncoder().encode(
          JSON.stringify(record, null, 2)
        )
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
    }
    if (tx.empty) return
    const request = await tx.toRequest()
    const contentChanges = sourceChanges(request)
    if (contentChanges.changes.length) await source.applyChanges(contentChanges)
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
      const node = this.byPath.get(nodePath)
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
          const parentNode = this.byPath.get(getNodePath(parentPath))
          let id = createId()
          if (locale) {
            const level = pathSegments.length - 1
            const pathEnd = `/${pathSegments.slice(1).join('/')}.json`
            const from = this.findFirst(entry => {
              return (
                entry.locale !== locale &&
                entry.root === root &&
                entry.workspace === workspace &&
                entry.path === path &&
                entry.level === level &&
                entry.parentId === (parentNode?.id ?? null) &&
                entry.seeded !== null &&
                entry.seeded.endsWith(pathEnd)
              )
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
            await source.applyChanges(contentChanges)
            await this.syncWith(source)
          }
        }
      }
    }
  }

  async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.config, this, source, from)
  }

  create(
    {sha, segments, status, active, main}: EntryInfo,
    contents: Uint8Array,
    parent: EntryNode | undefined
  ): Entry {
    const path = segments.at(-1)
    assert(path)

    const parentDir = segments.slice(0, -1).join('/')
    const childrenDir = `${parentDir}/${path}`
    const suffix = status === 'published' ? '' : `.${status}`
    const file = `${childrenDir}${suffix}.json`

    let raw: unknown
    try {
      const data = new TextDecoder().decode(contents)
      raw = JSON.parse(data)
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${file} - ${error}`)
    }
    assert(typeof raw === 'object')

    const {meta: record, data: fields} = parseRecord(raw as EntryRecord)
    const nodePath = getNodePath(file)
    const seed = this.#seeds.get(nodePath)
    const data: Record<string, unknown> = {
      path,
      ...seed?.data,
      ...fields
    }
    const id = record.id
    const type = record.type
    const index = record.index

    const parentId = parent?.id ?? null

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
      parentPaths: segments.slice(levelOffset, -1)
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

class Entries {
  byId: Map<string, EntryNode>
  byPath = new Map<string, EntryNode>()
  constructor(nodes: Map<string, EntryNode>) {
    this.byId = nodes
    for (const node of nodes.values()) {
      for (const path of node.paths()) {
        this.byPath.set(path, node)
      }
    }
  }
  get(ids: Array<string>, locale: string | null) {}
}

interface EntryInfo {
  sha: string
  status: EntryStatus
  segments: Array<string>
  active: boolean
  main: boolean
}

class TreeNode {
  versions: Versions
  children?: TreeLevel

  constructor(segments: Array<string>) {
    this.versions = new Versions(segments)
  }

  *index(): Generator<EntryInfo> {
    if (this.versions.size > 0) {
      for (const status of this.versions.keys()) {
        yield this.versions.get(status)
      }
    }
    if (this.children) yield* this.children.index()
  }
}

class TreeLevel {
  #tree: ReadonlyTree
  #segments: Array<string>
  #nodes: Map<string, TreeNode> = new Map()

  private constructor(tree: ReadonlyTree, segments: Array<string>) {
    this.#tree = tree
    this.#segments = segments
    for (const [key, entry] of tree.nodes) {
      if (entry.type === 'blob') {
        const fileName = key.slice(0, -'.json'.length)
        const [name, status] = entryInfo(fileName)
        const node = this.#create(name)
        node.versions.add(status, entry.sha)
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

  #create(name: string): TreeNode {
    if (this.#nodes.has(name)) return this.#nodes.get(name)!
    const segments = this.#segments.concat(name)
    const node = new TreeNode(segments)
    const children = this.#tree.get(name)
    if (children && children.type === 'tree')
      node.children = TreeLevel.create(children, segments)
    this.#nodes.set(name, node)
    return node
  }

  *index(): Generator<EntryInfo> {
    for (const node of this.#nodes.values()) {
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

  locales = new Map<string | null, EntryVersions>()

  constructor(from: EntryData) {
    assign(this, from)
  }

  inheritStatus(locale: string | null): EntryStatus | undefined {
    const versions = this.locales.get(locale)
    if (!versions) return
    if (versions.inheritedStatus) return versions.inheritedStatus
    if (versions.has('archived')) return 'archived'
    if (versions.has('draft') && !versions.has('published')) return 'draft'
  }

  *paths() {
    for (const versions of this.locales.values()) {
      const [entry] = versions.values()
      yield getNodePath(entry.filePath)
    }
  }

  pathOf(locale: string | null): string | undefined {
    const versions = this.locales.get(locale)
    if (!versions) return
    const [version] = versions.values()
    if (!version) return
    return version.path
  }

  *entries(): Generator<Entry> {
    for (const locale of this.locales.values()) {
      yield* locale.versions()
    }
  }

  add(entry: Entry, parent: EntryNode | undefined) {
    const inheritedStatus = parent?.inheritStatus(entry.locale)
    if (!this.locales.has(entry.locale)) {
      this.locales.set(entry.locale, new EntryVersions(inheritedStatus))
    }
    const locale = this.locales.get(entry.locale)!
    locale.set(
      entry.status,
      inheritedStatus ? {...entry, status: inheritedStatus} : entry
    )

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

class EntryVersions extends Map<EntryStatus, Entry> {
  inheritedStatus: EntryStatus | undefined
  constructor(inheritedStatus?: EntryStatus) {
    super()
    this.inheritedStatus = inheritedStatus
  }
  *versions(): Generator<Entry> {
    if (this.inheritedStatus) yield this.active
    else yield* this.values()
  }
  get active(): Entry {
    const result =
      this.get('draft') ?? this.get('published') ?? this.get('archived')
    assert(result)
    return result
  }
}

class Versions extends Map<EntryStatus, EntryInfo> {
  #segments: Array<string>
  constructor(segments: Array<string>) {
    super()
    this.#segments = segments
  }
  add(status: EntryStatus, sha: string) {
    const self = this
    this.set(status, {
      sha,
      segments: this.#segments,
      status,
      get active() {
        return self.active === status
      },
      get main() {
        return self.main === status
      }
    })
  }
  get(status: EntryStatus): EntryInfo {
    const info = super.get(status)
    if (!info) throw new Error(`No entry info for status: ${status}`)
    return info
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
