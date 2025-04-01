import {reportWarning} from 'alinea/cli/util/Report'
import type {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import {type EntryRecord, parseRecord} from 'alinea/core/EntryRecord'
import {getRoot} from 'alinea/core/Internal'
import {Page} from 'alinea/core/Page'
import {Schema} from 'alinea/core/Schema'
import type {EntryUrlMeta} from 'alinea/core/Type'
import {entryInfo} from 'alinea/core/util/EntryFilenames'
import {isValidOrderKey} from 'alinea/core/util/FractionalIndexing'
import {entries, keys} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import type {Change} from '../source/Change.js'
import {type Source, bundleContents} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {assert, compareStrings} from '../source/Utils.js'
import {sourceChanges} from './CommitRequest.js'
import {EntryResolver} from './EntryResolver.js'
import {EntryTransaction} from './EntryTransaction.js'
import {EntryUpdate, IndexUpdate} from './IndexEvent.js'

export class EntryIndex extends EventTarget {
  tree = ReadonlyTree.EMPTY
  entries = Array<Entry>()
  byPath = new Map<string, EntryNode>()
  byId = new Map<string, EntryNode>()
  #config: Config
  #workspace: string
  #seeds: Map<string, Seed>
  resolver: EntryResolver

  constructor(config: Config) {
    super()
    const workspaces = keys(config.workspaces)
    assert(workspaces.length === 1, 'Multiple workspaces not supported')
    this.#config = config
    this.#workspace = workspaces[0]
    this.#seeds = entrySeeds(config)
    this.resolver = new EntryResolver(config, this)
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
    //for (const {op, path} of changes) console.log(`sync> ${op} ${path}`)
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
    this.dispatchEvent(new IndexUpdate(sha))
    return sha
  }

  #applyChanges(changes: Array<Change>) {
    const recompute = new Set<EntryNode>()
    for (const change of changes) {
      if (!change.path.endsWith('.json')) continue
      const nodePath = getNodePath(change.path)
      switch (change.op) {
        case 'delete': {
          const node = this.byPath.get(nodePath)
          assert(node, `Entry not found: ${change.path}`)
          const entry = node.byFile.get(change.path)
          assert(entry, `File not found: ${change.path}`)
          assert(
            entry.fileHash === change.sha,
            `SHA mismatch: ${entry.fileHash} != ${change.sha}`
          )
          if (node.remove(change.path) === 0) this.byId.delete(node.id)
          else recompute.add(node)
          this.byPath.delete(nodePath)
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
          const node = this.byId.get(entry.id) ?? new EntryNode(entry)
          if (parent) {
            node.setParent(parent)
            recompute.add(parent)
          }
          node.add(entry)
          this.byPath.set(nodePath, node)
          this.byId.set(entry.id, node)
          recompute.add(node)
          break
        }
      }
    }
    for (const node of recompute) node.sync()

    this.entries = Array.from(this.byId.values(), node => node.entries)
      .flat()
      .sort((a, b) => compareStrings(a.index, b.index))

    for (const node of recompute) this.dispatchEvent(new EntryUpdate(node.id))
  }

  #parseEntry({sha, file, contents}: ParseRequest): Entry {
    const workspace = this.#workspace
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
      ...fields,
      path
    }
    const id = record.id
    const type = record.type
    const index = record.index
    const title = data.title as string

    const root = segments[0]
    const rootConfig = this.#config.workspaces[workspace][root]
    assert(rootConfig, 'Invalid root')
    const hasI18n = getRoot(rootConfig).i18n
    const locale = hasI18n ? segments[1] : null

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
      level: segments.length - (hasI18n ? 2 : 1),
      index,
      locale,

      path,
      title,
      data,

      // Derived
      url: '',
      active: false,
      main: false,
      searchableText: ''
    }
  }
}

interface ParseRequest {
  sha: string
  file: string
  contents: Uint8Array
}

class EntryNode {
  id: string
  index: string
  type: string
  byFile = new Map<string, Entry>()
  locales = new Map<string | null, Map<EntryStatus, Entry>>()
  #parent: EntryNode | undefined
  #children = Array<EntryNode>()
  constructor(from: Entry) {
    this.id = from.id
    this.index = from.index
    this.type = from.type
  }
  setParent(parent: EntryNode) {
    if (this.#parent === parent) return
    // Per ID: all point to same parent/root
    assert(!this.#parent, 'Node has different parent')
    parent.addChild(this)
    this.#parent = parent
  }
  addChild(node: EntryNode) {
    const index = this.#children.indexOf(node)
    const [path] = this.byFile.keys()
    assert(index === -1, `Child already exists ${path}`)
    this.#children = [...this.#children, node].sort((a, b) =>
      compareStrings(a.index, b.index)
    )
  }
  removeChild(node: EntryNode) {
    const index = this.#children.indexOf(node)
    // Assert here? ...
    if (index === -1) return
    this.#children.splice(index, 1)
  }
  get entries() {
    return Array.from(this.byFile.values())
  }
  get parentEntries() {
    return this.#parent?.entries ?? []
  }
  get childrenEntries() {
    return this.#children.flatMap(node => node.entries)
  }
  add(entry: Entry) {
    if (this.byFile.has(entry.filePath)) this.remove(entry.filePath)
    const [from] = this.byFile.values()
    if (from) this.#validate(from, entry)
    const locale = entry.locale
    const versions = this.locales.get(locale) ?? new Map()
    this.locales.set(locale, versions)

    // Per ID: all have locale or none have locale
    if (locale === null) assert(this.locales.size === 1)

    if (this.#parent) {
      const hasArchived = this.#parent.locales.get(locale)?.get('archived')
      if (hasArchived) {
        entry.status = 'archived'
      } else {
        const hasDraft = this.#parent.locales.get(locale)?.get('draft')
        // Per ID&locale&published: all parents are published
        if (hasDraft)
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
    const [other] = versions.values()
    // Per ID&locale: all have same path
    if (other) assert(other.path === entry.path)

    entry.parentId = this.#parent ? this.#parent.id : null
    versions.set(entry.status, entry)
    this.byFile.set(entry.filePath, entry)
  }
  sync() {
    for (const [locale, versions] of this.locales) {
      for (const [status, version] of versions) {
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
        const parentPaths = version.parentDir.split('/').slice(locale ? 2 : 1)
        const url = entryUrl({
          locale,
          status,
          path: version.path,
          parentPaths
        })
        version.url = url
      }
    }
    for (const node of this.#children) node.sync()
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
    if (this.byFile.size === 0) {
      const parent = this.#parent
      if (parent) parent.removeChild(this)
    }
    return this.byFile.size
  }
  #validate(a: Entry, b: Entry) {
    assert(a.id === b.id, 'ID mismatch')
    assert(a.root === b.root, 'Root mismatch')
    // Per ID: all have same type
    assert(a.type === b.type, 'Type mismatch')
    // Per ID: all have same index, index is valid fractional index
    assert(isValidOrderKey(a.index), 'Invalid index')
    if (a.index !== b.index) {
      reportWarning(
        `These translations have a different _index field (${a.index} != ${b.index})`,
        a.filePath,
        b.filePath
      )
      b.index = a.index
    }
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

function entryUrl(meta: EntryUrlMeta) {
  const segments = meta.locale ? [meta.locale.toLowerCase()] : []
  return `/${segments
    .concat(
      meta.parentPaths
        .concat(meta.path)
        .filter(segment => segment !== 'index' && segment !== '')
    )
    .join('/')}`
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
          const filePath = getNodePath(`${rootName}${target}/${path}.json`)
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
