import {reportWarning} from 'alinea/cli/util/Report'
import type {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import {type EntryRecord, parseRecord} from 'alinea/core/EntryRecord'
import {getRoot} from 'alinea/core/Internal'
import {Page} from 'alinea/core/Page'
import {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import {entryInfo, entryUrl} from 'alinea/core/util/EntryFilenames'
import {isValidOrderKey} from 'alinea/core/util/FractionalIndexing'
import {entries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import MiniSearch from 'minisearch'
import type {Change} from '../source/Change.js'
import {type Source, bundleContents} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {assert, compareStrings} from '../source/Utils.js'
import {sourceChanges} from './CommitRequest.js'
import {EntryResolver} from './EntryResolver.js'
import {EntryTransaction} from './EntryTransaction.js'
import {IndexEvent} from './IndexEvent.js'

const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u
const DIACRITIC = /\p{Diacritic}/gu

export class EntryIndex extends EventTarget {
  tree = ReadonlyTree.EMPTY
  entries = Array<Entry>()
  byPath = new Map<string, EntryNode>()
  byId = new Map<string, EntryNode>()
  resolver: EntryResolver
  #config: Config
  #seeds: Map<string, Seed>
  #search: MiniSearch

  constructor(config: Config) {
    super()
    this.#config = config
    this.#seeds = entrySeeds(config)
    this.resolver = new EntryResolver(config, this)
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

  search(terms: string, condition?: (entry: Entry) => boolean): Array<Entry> {
    return this.#search
      .search(terms, {
        prefix: true,
        fuzzy: 0.2,
        boost: {title: 2},
        filter: condition && (result => condition(result.entry))
      })
      .map(result => result.entry)
  }

  get sha() {
    return this.tree.sha
  }

  findFirst(filter: (entry: Entry) => boolean): Entry | undefined {
    const [entry] = this.findMany(filter)
    return entry
  }

  *findMany(filter: (entry: Entry) => boolean): Iterable<Entry> {
    for (const entry of this.entries) if (filter(entry)) yield entry
  }

  async syncWith(source: Source): Promise<string> {
    const tree = await source.getTree()
    const changes = await bundleContents(source, this.tree.diff(tree))
    if (changes.length === 0) return tree.sha
    // for (const {op, path} of changes) console.log(`sync> ${op} ${path}`)
    return this.indexChanges(changes)
  }

  async seed(source: Source) {
    for (const [filePath, seed] of this.#seeds) {
      const {type, workspace, root, locale, data} = seed
      const node = this.byPath.get(filePath)
      if (node) {
        assert(node.type === type, 'Type mismatch')
      } else {
        const tx = await this.transaction(source)
        const parentPath = paths.dirname(filePath)
        const parentNode = this.byPath.get(getNodePath(parentPath))
        const request = await tx
          .create({
            parentId: parentNode?.id ?? null,
            locale,
            type,
            workspace,
            root,
            data
          })
          .toRequest()
        const contentChanges = sourceChanges(request.changes)
        await source.applyChanges(contentChanges)
        await this.indexChanges(contentChanges)
      }
    }
  }

  async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.#config, this, source, from)
  }

  async indexChanges(changes: Array<Change>) {
    if (changes.length === 0) return this.tree.sha
    this.#applyChanges(changes)
    this.tree = await this.tree.withChanges(changes)
    const sha = this.tree.sha
    this.dispatchEvent(new IndexEvent({op: 'index', sha}))
    return sha
  }

  #applyChanges(changes: Array<Change>) {
    const recompute = new Set<string>()
    for (const change of changes) {
      if (!change.path.endsWith('.json')) continue
      const nodePath = getNodePath(change.path)
      switch (change.op) {
        case 'delete': {
          const node = this.byPath.get(nodePath)
          if (!node) continue
          const entry = node.byFile.get(change.path)
          if (!entry) continue
          assert(
            entry.fileHash === change.sha,
            `SHA mismatch: ${entry.fileHash} != ${change.sha}`
          )
          if (node.remove(change.path) === 0) {
            this.byId.delete(node.id)
            this.byPath.delete(nodePath)
          } else {
            recompute.add(node.id)
          }
          this.#search.discard(change.path)
          break
        }
        case 'add': {
          const contents = change.contents
          assert(contents, 'Missing contents')
          const segments = change.path.split('/').slice(0, -1)
          const parentPath = segments.join('/')
          const parent = this.byPath.get(parentPath)
          const entry = this.#parseEntry({
            sha: change.sha,
            file: change.path,
            contents: contents
          })
          const node =
            this.byId.get(entry.id) ?? new EntryNode(this.#config, entry)
          node.add(entry, parent)
          if (parent) recompute.add(parent.id)
          else recompute.add(node.id)
          this.byPath.set(nodePath, node)
          this.byId.set(entry.id, node)
          if (this.#search.has(change.path)) this.#search.discard(change.path)
          this.#search.add({
            id: change.path,
            title: entry.title,
            searchableText: entry.searchableText,
            entry
          })
          break
        }
      }
    }

    const entries = Array<Entry>()
    for (const [id, node] of this.byId) {
      let needsSync = recompute.has(id)
      let parentId = node.parentId
      while (!needsSync && parentId) {
        const parent = this.byId.get(parentId)
        if (!parent) break
        needsSync = recompute.has(parent.id)
        parentId = parent.parentId
      }
      if (needsSync) {
        node.sync(this.byId)
        recompute.add(id)
      }
      entries.push(...node.entries)
    }
    this.entries = entries.sort((a, b) => compareStrings(a.index, b.index))
    for (const id of recompute)
      this.dispatchEvent(new IndexEvent({op: 'entry', id}))
  }

  #parseEntry({sha, file, contents}: ParseRequest): Entry {
    const segments = file.split('/')
    const baseName = segments.at(-1)
    assert(baseName)
    const lastDot = baseName.lastIndexOf('.')
    assert(lastDot !== -1)
    const fileName = baseName.slice(0, lastDot)
    const [path, status] = entryInfo(fileName)

    const parentDir = segments.slice(0, -1).join('/')
    const childrenDir = `${parentDir}/${path}`

    let raw: unknown
    try {
      raw = JSON.parse(new TextDecoder().decode(contents))
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${file}`)
    }
    assert(typeof raw === 'object')
    const {meta: record, data: fields} = parseRecord(raw as EntryRecord)
    const data: Record<string, unknown> = {
      path,
      ...fields
    }
    const id = record.id
    const type = record.type
    const index = record.index
    const title = data.title as string

    const workspace = segments[0]
    const workspaceConfig = this.#config.workspaces[workspace]
    assert(workspaceConfig, `Invalid workspace: ${workspace} in ${file}`)
    const root = segments[1]
    const rootConfig = workspaceConfig[root]
    assert(rootConfig, `Invalid root: ${root}`)
    const hasI18n = getRoot(rootConfig).i18n
    const locale = hasI18n ? segments[2] : null
    const entryType = this.#config.schema[type]
    const searchableText = Type.searchableText(entryType, data)

    return {
      rowHash: sha,
      fileHash: sha,

      workspace,
      root,
      filePath: file,
      seeded: null,

      id,
      status,
      type,

      parentDir,
      childrenDir,
      parentId: null,
      level: segments.length - (hasI18n ? 3 : 2),
      index,
      locale,

      path,
      title,
      data,
      searchableText,

      // Derived
      url: '',
      active: false,
      main: false
    }
  }
}

interface ParseRequest {
  sha: string
  file: string
  contents: Uint8Array
}

class EntryNode {
  #config: Config
  id: string
  type: string
  byFile = new Map<string, Entry>()
  locales = new Map<string | null, Map<EntryStatus, Entry>>()
  constructor(config: Config, from: Entry) {
    this.#config = config
    this.id = from.id
    this.type = from.type
  }
  get index() {
    const [entry] = this.byFile.values()
    return entry.index
  }
  get parentId() {
    const [entry] = this.byFile.values()
    return entry.parentId
  }
  get entries() {
    return Array.from(this.byFile.values())
  }
  pathOf(locale: string | null): string | undefined {
    const versions = this.locales.get(locale)
    if (!versions) return
    const [version] = versions.values()
    if (!version) return
    return version.path
  }
  add(entry: Entry, parent: EntryNode | undefined) {
    if (this.byFile.has(entry.filePath)) this.remove(entry.filePath)
    const [from] = this.byFile.values()
    if (from) this.#validate(from, entry)
    const locale = entry.locale
    const versions = this.locales.get(locale) ?? new Map()
    this.locales.set(locale, versions)

    // Per ID: all have locale or none have locale
    if (locale === null) assert(this.locales.size === 1)

    if (parent) {
      const hasArchived = parent.locales.get(locale)?.get('archived')
      if (hasArchived) {
        entry.status = 'archived'
      } else {
        const hasPublished = parent.locales.get(locale)?.get('published')
        // Per ID&locale&published: all parents are published
        if (!hasPublished)
          assert(
            entry.status === 'draft',
            `Entry ${entry.filePath} needs a published parent`
          )
      }
    }

    // Per ID&locale: one of published or archived, but not both
    if (entry.status === 'published') {
      assert(!versions.has('archived'))
    }
    if (entry.status === 'archived') assert(!versions.has('published'))
    // Per ID&locale: only one draft
    if (entry.status === 'draft') assert(!versions.has('draft'))

    entry.parentId = parent ? parent.id : null
    versions.set(entry.status, entry)
    this.byFile.set(entry.filePath, entry)
  }
  sync(byId: Map<string, EntryNode>) {
    const parent = this.parentId ? byId.get(this.parentId) : undefined

    for (const [locale, versions] of this.locales) {
      const parentIsArchived = parent?.locales.get(locale)?.get('archived')
      let path: string
      for (const [status, version] of versions) {
        path ??= version.path
        assert(
          version.path === path,
          `Invalid path: ${version.path} != ${path}`
        )
        const isDraft = status === 'draft'
        const isPublished = status === 'published'
        const isArchived = status === 'archived'
        const hasDraft = versions.has('draft')
        const hasPublished = versions.has('published')
        const hasArchived = versions.has('archived')
        const active =
          isDraft ||
          (isPublished && !hasDraft) ||
          (isArchived && !hasDraft && !hasPublished)
        const main =
          isPublished ||
          (isArchived && !hasPublished) ||
          (isDraft && !hasPublished && !hasArchived)
        version.active = active
        version.main = main
        const parentPaths = version.parentDir.split('/').slice(locale ? 3 : 2)
        const type = this.#config.schema[version.type]
        const url = entryUrl(type, {
          locale,
          status,
          path: version.path,
          parentPaths
        })
        version.url = url
        version.status = parentIsArchived ? 'archived' : status

        // Per ID: all have same index, index is valid fractional index
        assert(isValidOrderKey(version.index), 'Invalid index')
        if (version.index !== this.index)
          reportWarning(
            `This translation has a different _index field (${version.index} != ${this.index})`,
            version.filePath
          )
      }
    }
  }
  has(filePath: string) {
    return this.byFile.has(filePath)
  }
  remove(filePath: string) {
    const entry = this.byFile.get(filePath)
    assert(entry, 'Entry not found')
    const locale = entry.locale
    const versions = this.locales.get(locale)
    assert(versions, 'Locale not found')
    versions.delete(entry.status)
    if (versions.size === 0) this.locales.delete(locale)
    this.byFile.delete(filePath)
    return this.byFile.size
  }
  #validate(a: Entry, b: Entry) {
    assert(a.id === b.id, 'ID mismatch')
    assert(a.root === b.root, 'Root mismatch')
    // Per ID: all have same type
    assert(a.type === b.type, 'Type mismatch')
  }
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

interface Seed {
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
      const locales = i18n?.locales ?? [undefined]
      for (const locale of locales) {
        const pages: Array<readonly [string, Page]> = entries(root)
        const target = locale ? `/${locale.toLowerCase()}` : ''
        while (pages.length > 0) {
          const [pagePath, page] = pages.shift()!
          const path = pagePath.split('/').map(slugify).join('/')
          if (!Page.isPage(page)) continue
          const {type, fields = {}} = Page.data(page)
          const filePath = getNodePath(
            `${workspaceName}/${rootName}${target}/${path}.json`
          )
          const typeName = typeNames.get(type)
          if (!typeName) continue
          result.set(filePath, {
            type: typeName,
            locale: locale ?? null,
            workspace: workspaceName,
            root: rootName,
            data: {
              ...fields,
              path,
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
