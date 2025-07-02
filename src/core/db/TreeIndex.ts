import {Config} from '../Config.js'
import type {Entry, EntryData, EntryStatus} from '../Entry.js'
import {type EntryRecord, parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import {Type} from '../Type.js'
import type {Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {assert} from '../source/Utils.js'
import {accumulate} from '../util/Async.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {assign, keys} from '../util/Objects.js'

export class TreeIndex {
  #config: Config
  #entries = new Map<string, EntryNode>()
  #singleWorkspace: string | undefined
  #built = new WeakMap<EntryInfo, Entry>()

  constructor(config: Config) {
    this.#config = config
    this.#singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
  }

  async build(source: Source) {
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
      entry = prebuilt ?? this.create(info, blobs.get(info.sha)!, entry)
      this.#built.set(info, entry)
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
    this.#entries = entries
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
    const workspaceConfig = this.#config.workspaces[workspace]
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
    const entryType = this.#config.schema[type]
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

  #locales = new Map<string | null, Map<EntryStatus, Entry>>()

  constructor(from: EntryData) {
    assign(this, from)
  }

  add(entry: Entry) {
    if (!this.#locales.has(entry.locale))
      this.#locales.set(entry.locale, new Map())
    const locale = this.#locales.get(entry.locale)!
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
