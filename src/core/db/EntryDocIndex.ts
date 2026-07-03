import type {Config} from '../Config.js'
import {Config as ConfigUtils} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {createRecord, parseRecord} from '../EntryRecord.js'
import type {Status} from '../Graph.js'
import {getRoot} from '../Internal.js'
import type {ChangesBatch} from '../source/Change.js'
import {ShaMismatchError} from '../source/ShaMismatchError.js'
import {bundleContents, type Source} from '../source/Source.js'
import {ReadonlyTree, WriteableTree} from '../source/Tree.js'
import {compareStrings} from '../source/Utils.js'
import {Type} from '../Type.js'
import {assert} from '../util/Assert.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {
  DocDB,
  type Doc,
  type DocCondition,
  type DocDBOptions,
  type DocLink,
  type DocOrder,
  type DocQuery,
  type DocVariantRecord
} from '../docdb/DocDB.js'
import type {
  EntryReference,
  EntryReferenceQuery,
  EntryReferenceResult
} from './EntryReference.js'
import {IndexEvent, type IndexOp} from './IndexEvent.js'

export interface EntryDocData {
  id: string
  type: string
  status: EntryStatus
  effectiveStatus: EntryStatus
  active: boolean
  main: boolean
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

interface EntryDocVariant extends DocVariantRecord {
  status: EntryStatus
  locale: string | null
}

interface EntryDocBuildContext {
  config: Config
  singleWorkspace: string | undefined
}

export interface EntryDocQuery {
  ids?: ReadonlyArray<string>
  nodeIds?: ReadonlyArray<string>
  parentNodeId?: string | null
  descendantOfNodeId?: string
  type?: string | ReadonlyArray<string>
  locale?: string | null
  status?: Status
  search?: string
  level?: number | {gt?: number; gte?: number; lt?: number; lte?: number}
  where?: DocCondition
  orderBy?: Array<DocOrder>
  skip?: number
  take?: number
}

export interface EntryDocReadCache {
  states: Map<string, EntryDocLanguageState>
}

interface EntryDocLanguageState {
  active: Doc
  main: Doc
  inheritedStatus: EntryStatus | undefined
}

interface MaterializedLanguageState {
  active: Doc
  main: Doc
  inheritedStatus: EntryStatus | undefined
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
  return nodeIdOfEntryId(getNodePath(filePath))
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
  return {
    id: entryIdFromFilePath(filePath),
    parent,
      data: {
        id,
        type,
        status: location.status,
        effectiveStatus: location.status,
        active: false,
        main: false,
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
  }
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

export function entryData(doc: Doc): EntryDocData {
  return doc.data as unknown as EntryDocData
}

function variantOf(data: EntryDocData): EntryDocVariant {
  return {status: data.status, locale: data.locale}
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

function docStatusRank(doc: Doc): number {
  return statusRank(entryData(doc).status)
}

function sameDocVersion(a: Doc, b: Doc): boolean {
  const aData = entryData(a)
  const bData = entryData(b)
  return (
    a.id === b.id &&
    aData.status === bData.status &&
    aData.locale === bData.locale
  )
}

function stateKey(id: string, locale: string | null): string {
  return `${id}\0${locale ?? ''}`
}

export function nodeIdOfEntryId(id: string): string {
  return id.startsWith('entry:') ? id : `entry:${id}`
}

function schemaFieldIndexPaths(config: Config): Array<string> {
  const paths = new Set<string>()
  for (const type of Object.values(config.schema)) {
    for (const field of Object.keys(Type.fields(type))) {
      paths.add(`data.${field}`)
    }
  }
  return [...paths]
}

function entryIdOfNodeId(id: string): string {
  return id.startsWith('entry:') ? id.slice('entry:'.length) : id
}

function valueAtPath(value: unknown, path: ReadonlyArray<string>): unknown {
  let current = value
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function pathDepth(path: string): number {
  return path.split('/').length
}

function createEntryDocIndexEvent(data: IndexOp): IndexEvent {
  const event = Object.create(IndexEvent.prototype) as IndexEvent
  Object.defineProperties(event, {
    type: {
      value: IndexEvent.type,
      enumerable: true
    },
    data: {
      value: data,
      enumerable: true
    },
    defaultPrevented: {
      value: false,
      writable: true
    },
    preventDefault: {
      value() {
        Object.defineProperty(this, 'defaultPrevented', {
          value: true,
          writable: true
        })
      }
    },
    stopPropagation: {
      value() {}
    },
    stopImmediatePropagation: {
      value() {}
    }
  })
  return event
}

export class EntryDocIndex extends EventTarget {
  tree = ReadonlyTree.EMPTY
  initialSync: ReadonlyTree | undefined
  #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  #singleWorkspace: string | undefined
  #entryCount: number | undefined

  constructor(
    public config: Config,
    public docs: DocDB
  ) {
    super()
    this.#singleWorkspace = ConfigUtils.multipleWorkspaces(config)
      ? undefined
      : Object.keys(config.workspaces)[0]
  }

  static createDocDB(config: Config, database: DocDB): DocDB {
    void config
    return database
  }

  get sha(): string {
    return this.tree.sha
  }

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ): void {
    void options
    if (!callback) return
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(callback)
    this.#listeners.set(type, listeners)
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void {
    void options
    if (!callback) return
    this.#listeners.get(type)?.delete(callback)
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.#listeners.get(event.type)
    if (!listeners) return true
    for (const listener of listeners) {
      if (typeof listener === 'function') listener.call(this, event)
      else listener.handleEvent(event)
    }
    return !event.defaultPrevented
  }

  createReadCache(): EntryDocReadCache {
    return {states: new Map()}
  }

  async hydrateTreeFromDocs(): Promise<string> {
    const tree = new WriteableTree()
    const paths = new Map<string, string>()
    for (const doc of this.docs.query({kind: 'entry'})) {
      const data = entryData(doc)
      const existing = paths.get(data.filePath)
      assert(
        existing === undefined || existing === data.fileHash,
        `Mismatched hashes for ${data.filePath}`
      )
      paths.set(data.filePath, data.fileHash)
      tree.add(data.filePath, data.fileHash)
    }
    this.tree = await tree.compile()
    if (!this.initialSync) this.initialSync = this.tree
    this.#entryCount = paths.size
    return this.tree.sha
  }

  docForEntry(
    id: string,
    status: EntryStatus,
    locale: string | null
  ): Doc | undefined {
    return this.docs.query({
      kind: 'entry',
      id: nodeIdOfEntryId(id),
      variantWhere: {status, locale}
    })[0]
  }

  queryDocs(query: EntryDocQuery): Array<Doc> {
    const prepared = this.queryPreparedDataEq(query)
    if (prepared) return prepared
    const conditions = Array<NonNullable<DocQuery['where']>>()
    if (query.ids) conditions.push({path: 'id', in: [...query.ids]})
    if (query.type)
      conditions.push({
        path: 'type',
        in: Array.isArray(query.type) ? [...query.type] : [query.type]
      })
    if (query.where) conditions.push(query.where)
    switch (query.status) {
      case 'published':
      case 'draft':
      case 'archived':
        conditions.push({path: 'effectiveStatus', eq: query.status})
        break
      case 'preferDraft':
        conditions.push({path: 'active', eq: true})
        break
      case 'preferPublished':
        conditions.push({path: 'main', eq: true})
        break
      case 'all':
      case undefined:
        break
    }
    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : {and: conditions}
    const variantWhere: DocVariantRecord = {}
    if (query.locale !== undefined) variantWhere.locale = query.locale
    const docs = this.docs.query({
      kind: 'entry',
      id: query.nodeIds?.map(nodeIdOfEntryId),
      parent:
        query.parentNodeId === undefined
          ? undefined
          : query.parentNodeId === null
            ? null
            : nodeIdOfEntryId(query.parentNodeId),
      descendantOf:
        query.descendantOfNodeId === undefined
          ? undefined
          : nodeIdOfEntryId(query.descendantOfNodeId),
      variantWhere:
        Object.keys(variantWhere).length > 0 ? variantWhere : undefined,
      level: query.level,
      where,
      search: query.search,
      orderBy: query.orderBy,
      skip: query.skip,
      take: query.take
    })
    if (query.search || (query.orderBy && query.orderBy.length > 0)) return docs
    return docs.sort((a, b) => {
        const index = compareStrings(a.index ?? '', b.index ?? '')
        if (index !== 0) return index
        return docStatusRank(a) - docStatusRank(b)
      })
  }

  private queryPreparedDataEq(query: EntryDocQuery): Array<Doc> | undefined {
    if (!query.ids || query.ids.length !== 1) return undefined
    if (query.nodeIds || query.parentNodeId !== undefined) return undefined
    if (query.descendantOfNodeId || query.level !== undefined) return undefined
    if (query.search || query.where) return undefined
    if (query.orderBy && query.orderBy.length > 0) return undefined
    const conditions = Array<{path: string; value: unknown}>()
    conditions.push({path: 'id', value: query.ids[0]})
    if (query.locale !== undefined)
      conditions.push({path: 'locale', value: query.locale})
    if (typeof query.type === 'string')
      conditions.push({path: 'type', value: query.type})
    else if (Array.isArray(query.type) && query.type.length === 1)
      conditions.push({path: 'type', value: query.type[0]})
    else if (Array.isArray(query.type) && query.type.length > 1)
      return undefined
    switch (query.status) {
      case 'published':
      case 'draft':
      case 'archived':
        conditions.push({path: 'effectiveStatus', value: query.status})
        break
      case 'preferDraft':
        conditions.push({path: 'active', value: true})
        break
      case 'preferPublished':
        conditions.push({path: 'main', value: true})
        break
      case 'all':
        break
      case undefined:
        return undefined
    }
    return this.docs.getByDataEq(conditions, query.take)
  }

  matchesStatus(doc: Doc, status: Status, cache: EntryDocReadCache): boolean {
    switch (status) {
      case 'published':
      case 'draft':
      case 'archived':
        return this.entryField(doc, 'status', undefined, cache) === status
      case 'preferDraft':
        return this.entryField(doc, 'active', undefined, cache) === true
      case 'preferPublished':
        return this.entryField(doc, 'main', undefined, cache) === true
      case 'all':
        return true
    }
  }

  field(doc: Doc, name: string): unknown {
    return entryData(doc).data[name]
  }

  entryField(
    doc: Doc,
    name: string,
    path: ReadonlyArray<string> | undefined,
    cache: EntryDocReadCache
  ): unknown {
    const data = entryData(doc)
    if (path) return valueAtPath(data.data, [...path, name])
    switch (name) {
      case 'id':
        return data.id
      case 'status':
        return data.effectiveStatus
      case 'title':
        return data.title
      case 'type':
        return data.type
      case 'seeded':
        return data.seeded
      case 'workspace':
        return data.workspace
      case 'root':
        return data.root
      case 'level':
        return doc.level
      case 'filePath':
        return data.filePath
      case 'parentDir':
        return data.parentDir
      case 'childrenDir':
        return data.childrenDir
      case 'index':
        return data.index
      case 'parentId':
        return doc.parent ? this.parentData(doc, cache).id : null
      case 'parents':
        return this.parentChain(doc, cache).map(parent => parent.id)
      case 'locale':
        return data.locale
      case 'rowHash':
        return data.rowHash
      case 'active':
        return data.active
      case 'main':
        return data.main
      case 'path':
        return data.path
      case 'fileHash':
        return data.fileHash
      case 'url':
        return this.url(doc, cache)
      case 'data':
        return data.data
      case 'searchableText':
        return data.searchableText
      default:
        return (doc as unknown as Record<string, unknown>)[name]
    }
  }

  mainDoc(
    nodeId: string,
    locale: string | null,
    cache: EntryDocReadCache
  ): Doc {
    return this.languageState(nodeId, locale, cache).main
  }

  parentDocs(
    doc: Doc,
    locale: string | null,
    cache: EntryDocReadCache
  ): Array<Doc> {
    const parents = Array<Doc>()
    let current = doc.parent
    while (current) {
      const state = this.languageState(current, locale, cache)
      parents.unshift(state.main)
      current = state.main.parent
    }
    return parents
  }

  url(doc: Doc, cache: EntryDocReadCache): string {
    const data = entryData(doc)
    const entryType = this.config.schema[data.type]
    assert(entryType, `Type not found: ${data.type}`)
    return entryUrl(entryType, {
      status: data.status,
      path: data.path,
      parentPaths: this.parentChain(doc, cache).map(parent => parent.path),
      locale: data.locale,
      workspace: data.workspace,
      root: data.root
    })
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const cache = this.createReadCache()
    const status = query.status ?? 'published'
    const references = this.docs
      .referencesTo(nodeIdOfEntryId(query.targetId))
      .map(reference => {
        const source = this.docs.get(reference.id, reference.variant)
        if (!source) return undefined
        const data = entryData(source)
        const result: EntryReference = {
          targetId: query.targetId,
          sourceId: data.id,
          sourceFilePath: data.filePath,
          sourceType: data.type,
          sourceLocale: data.locale,
          sourceStatus: this.entryField(
            source,
            'status',
            undefined,
            cache
          ) as EntryStatus,
          sourceActive:
            this.entryField(source, 'active', undefined, cache) === true,
          sourceMain:
            this.entryField(source, 'main', undefined, cache) === true,
          fieldPath: reference.path
        }
        return result
      })
      .filter((reference): reference is EntryReference => {
        if (!reference) return false
        if (
          query.locale !== undefined &&
          reference.sourceLocale !== query.locale
        )
          return false
        switch (status) {
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
        scanned: this.entryCount(),
        total: this.entryCount(),
        complete: true
      }
    }
  }

  async referencesFrom(sourceId: string): Promise<Array<EntryReference>> {
    const result = Array<EntryReference>()
    const cache = this.createReadCache()
    for (const reference of this.docs.referencesFrom(
      nodeIdOfEntryId(sourceId)
    )) {
      const source = this.docs.get(reference.id, reference.variant)
      if (!source) continue
      const data = entryData(source)
      result.push({
        targetId: entryIdOfNodeId(reference.target),
        sourceId: data.id,
        sourceFilePath: data.filePath,
        sourceType: data.type,
        sourceLocale: data.locale,
        sourceStatus: this.entryField(
          source,
          'status',
          undefined,
          cache
        ) as EntryStatus,
        sourceActive:
          this.entryField(source, 'active', undefined, cache) === true,
        sourceMain: this.entryField(source, 'main', undefined, cache) === true,
        fieldPath: reference.path
      })
    }
    return result
  }

  withPreviewEntry<Result>(entry: Entry, run: () => Result): Result {
    const ctx: EntryDocBuildContext = {
      config: this.config,
      singleWorkspace: this.#singleWorkspace
    }
    const contents = new TextEncoder().encode(
      JSON.stringify(createRecord(entry, entry.status), null, 2)
    )
    const parsed = parseEntryDoc(ctx, entry.filePath, entry.fileHash, contents)
    return this.docs.withOverlay(
      {
        overlay: [
          {
            op: 'put',
            doc: {
              id: parsed.id,
              parent: parsed.parent,
              kind: 'entry',
              index: parsed.data.index,
              variant: variantOf(parsed.data),
              data: parsed.data as unknown as Record<string, unknown>
            }
          }
        ]
      },
      () => {
        this.materializeEntryStates()
        return run()
      }
    )
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
        case 'delete': {
          const location = entryLocationFromFilePath(ctx, change.path)
          removals.push({
            id: entryIdFromFilePath(change.path),
            variant: {
              status: location.status,
              locale: location.locale
            }
          })
          break
        }
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
            variant: variantOf(parsed.data),
            data: parsed.data
          })
          break
        }
      }
    }
    const canMaterializeBeforeInsert =
      this.tree.sha === ReadonlyTree.EMPTY.sha && removals.length === 0
    if (canMaterializeBeforeInsert) this.materializeInputStates(inserts)
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
    if (!canMaterializeBeforeInsert) this.materializeEntryStates()
    this.#entryCount = undefined
    this.tree = await this.tree.withChanges(batch)
    const emitted = new Set<string>()
    for (const change of batch.changes) {
      const id = entryIdOfNodeId(entryIdFromFilePath(change.path))
      if (emitted.has(id)) continue
      emitted.add(id)
      this.dispatchEvent(createEntryDocIndexEvent({op: 'entry', id}))
    }
    this.dispatchEvent(
      createEntryDocIndexEvent({op: 'index', sha: this.tree.sha})
    )
    return this.tree.sha
  }

  private parentData(doc: Doc, cache: EntryDocReadCache): EntryDocData {
    assert(doc.parent, `Entry has no parent: ${doc.id}`)
    return entryData(
      this.languageState(doc.parent, entryData(doc).locale, cache).main
    )
  }

  private entryCount(): number {
    this.#entryCount ??= this.docs.count({kind: 'entry'})
    return this.#entryCount
  }

  private parentChain(doc: Doc, cache: EntryDocReadCache): Array<EntryDocData> {
    return this.parentDocs(doc, entryData(doc).locale, cache).map(entryData)
  }

  private materializeInputStates(
    inputs: Array<{
      id: string
      parent: string | null
      variant: EntryDocVariant
      data: EntryDocData
    }>
  ): void {
    const groups = new Map<string, typeof inputs>()
    for (const input of inputs) {
      const key = stateKey(input.id, input.data.locale)
      const group = groups.get(key) ?? []
      group.push(input)
      groups.set(key, group)
    }
    const states = new Map<string, {inheritedStatus: EntryStatus | undefined}>()
    const orderedGroups = [...groups.entries()].sort(([, a], [, b]) => {
      return pathDepth(a[0].data.filePath) - pathDepth(b[0].data.filePath)
    })
    for (const [key, versions] of orderedGroups) {
      versions.sort((a, b) => statusRank(a.data.status) - statusRank(b.data.status))
      const active =
        versions.find(input => input.data.status === 'draft') ??
        versions.find(input => input.data.status === 'published') ??
        versions.find(input => input.data.status === 'archived')
      assert(active, `Entry language missing active version: ${key}`)
      const parentStatus = active.parent
        ? states.get(stateKey(active.parent, active.data.locale))
            ?.inheritedStatus
        : undefined
      const hasArchived = versions.some(input => {
        return input.data.status === 'archived'
      })
      const hasDraft = versions.some(input => {
        return input.data.status === 'draft'
      })
      const hasPublished = versions.some(input => {
        return input.data.status === 'published'
      })
      const inheritedStatus =
        parentStatus ??
        (hasArchived
          ? 'archived'
          : hasDraft && !hasPublished
            ? 'draft'
            : undefined)
      const main =
        inheritedStatus !== undefined
          ? active
          : (versions.find(input => input.data.status === 'published') ??
            versions.find(input => input.data.status === 'archived') ??
            versions.find(input => input.data.status === 'draft'))
      assert(main, `Entry language missing main version: ${key}`)
      states.set(key, {inheritedStatus})
      for (const input of versions) {
        input.data = {
          ...input.data,
          effectiveStatus: inheritedStatus ?? input.data.status,
          active: input === active,
          main: input === main
        }
      }
    }
  }

  private materializeEntryStates(): void {
    const groups = new Map<string, Array<Doc>>()
    const docs = this.docs
      .query({kind: 'entry'})
      .sort((a, b) => a.level - b.level || docStatusRank(a) - docStatusRank(b))
    for (const doc of docs) {
      const data = entryData(doc)
      const key = stateKey(doc.id, data.locale)
      const group = groups.get(key) ?? []
      group.push(doc)
      groups.set(key, group)
    }

    const states = new Map<string, MaterializedLanguageState>()
    const updates = Array<{
      id: string
      parent: string | null
      variant: EntryDocVariant
      data: EntryDocData
    }>()

    for (const [key, versions] of groups) {
      versions.sort((a, b) => docStatusRank(a) - docStatusRank(b))
      const active =
        versions.find(doc => entryData(doc).status === 'draft') ??
        versions.find(doc => entryData(doc).status === 'published') ??
        versions.find(doc => entryData(doc).status === 'archived')
      assert(active, `Entry language missing active version: ${key}`)
      const activeData = entryData(active)
      const parentStatus = active.parent
        ? states.get(stateKey(active.parent, activeData.locale))
            ?.inheritedStatus
        : undefined
      const hasArchived = versions.some(doc => {
        return entryData(doc).status === 'archived'
      })
      const hasDraft = versions.some(doc => {
        return entryData(doc).status === 'draft'
      })
      const hasPublished = versions.some(doc => {
        return entryData(doc).status === 'published'
      })
      const inheritedStatus =
        parentStatus ??
        (hasArchived
          ? 'archived'
          : hasDraft && !hasPublished
            ? 'draft'
            : undefined)
      const main =
        inheritedStatus !== undefined
          ? active
          : (versions.find(doc => entryData(doc).status === 'published') ??
            versions.find(doc => entryData(doc).status === 'archived') ??
            versions.find(doc => entryData(doc).status === 'draft'))
      assert(main, `Entry language missing main version: ${key}`)
      states.set(key, {active, main, inheritedStatus})
      for (const doc of versions) {
        const data = entryData(doc)
        const nextData: EntryDocData = {
          ...data,
          effectiveStatus: inheritedStatus ?? data.status,
          active: sameDocVersion(doc, active),
          main: sameDocVersion(doc, main)
        }
        if (
          nextData.effectiveStatus === data.effectiveStatus &&
          nextData.active === data.active &&
          nextData.main === data.main
        )
          continue
        updates.push({
          id: doc.id,
          parent: doc.parent,
          variant: variantOf(data),
          data: nextData
        })
      }
    }

    if (updates.length === 0) return
    this.docs.insert(
      updates.map(update => {
        return {
          id: update.id,
          parent: update.parent,
          kind: 'entry',
          index: update.data.index,
          variant: update.variant,
          data: update.data as unknown as Record<string, unknown>
        }
      })
    )
  }

  private languageState(
    id: string,
    locale: string | null,
    cache: EntryDocReadCache
  ): EntryDocLanguageState {
    const key = stateKey(id, locale)
    const cached = cache.states.get(key)
    if (cached) return cached
    const docs = this.docs
      .query({id, kind: 'entry', variantWhere: {locale}})
      .sort((a, b) => docStatusRank(a) - docStatusRank(b))
    const active =
      docs.find(doc => entryData(doc).active) ??
      docs.find(doc => entryData(doc).status === 'draft') ??
      docs.find(doc => entryData(doc).status === 'published') ??
      docs.find(doc => entryData(doc).status === 'archived')
    assert(active, `Entry language missing active version: ${id}`)
    const main =
      docs.find(doc => entryData(doc).main) ??
      docs.find(doc => entryData(doc).status === 'published') ??
      docs.find(doc => entryData(doc).status === 'archived') ??
      docs.find(doc => entryData(doc).status === 'draft')
    assert(main, `Entry language missing main version: ${id}`)
    const activeData = entryData(active)
    const inheritedStatus =
      activeData.effectiveStatus === activeData.status
        ? undefined
        : activeData.effectiveStatus
    const state = {active, main, inheritedStatus}
    cache.states.set(key, state)
    return state
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
    indexPaths: [
      'id',
      'type',
      'path',
      'workspace',
      'root',
      'title',
      'effectiveStatus',
      'active',
      'main',
      ...schemaFieldIndexPaths(config)
    ],
    variantIndexPaths: ['status', 'locale']
  }
}
