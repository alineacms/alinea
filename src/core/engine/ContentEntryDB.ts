import type {Config} from '../Config.js'
import type {Entry} from '../Entry.js'
import type {Expr} from '../Expr.js'
import {Field} from '../Field.js'
import type {
  AnyQueryResult,
  GraphQuery,
  Order,
  Projection,
  Status
} from '../Graph.js'
import {Graph} from '../Graph.js'
import {getExpr, hasExpr, hasField, hasRoot, hasWorkspace} from '../Internal.js'
import {getScope, type Scope} from '../Scope.js'
import {Type, type Type as AlineaType} from '../Type.js'
import {EntryIndex} from '../db/EntryIndex.js'
import {ScalarShape} from '../shape/ScalarShape.js'
import type {Source} from '../source/Source.js'
import {entries, fromEntries} from '../util/Objects.js'
import {
  ContentDB,
  type ContentShape,
  type FieldDirective,
  type Filter
} from './ContentDB.js'

type AnyRecord = Record<string, any>

type ContentQueryPlan = {
  filter: Filter<AnyRecord>
  searchTerms?: string[]
  select: (id: number) => unknown
  needsPostProcessing: boolean
  orders?: Array<CompiledOrder>
}

type CompiledOrder = {
  order: Order
  read: (id: number) => unknown
  fastString: boolean
}

type ContentEntryMeta = {
  _id: string
  _type: string
  _status: Entry['status']
  _active: boolean
  _main: boolean
  _workspace: string
  _root: string
  _parentId: string | null
  _locale: string | null
  _path: string
  _url: string
  _level: number
  _index: string
  _filePath: string
}

type ContentEntryDerived = {}

const globalFields: Record<string, FieldDirective> = {
  _id: 'exact',
  _type: 'dictionary',
  _status: 'dictionary',
  _active: 'column',
  _main: 'column',
  _workspace: 'dictionary',
  _root: 'dictionary',
  _parentId: 'dictionary',
  _locale: 'dictionary',
  _path: 'exact',
  _url: 'exact',
  _level: 'range',
  _index: 'column',
  _seeded: 'payload',
  _parentDir: 'column',
  _childrenDir: 'column',
  _fileHash: 'column',
  _searchableText: 'column',
  _title: 'column',
  _parents: 'payload',
  _rowHash: 'payload'
}

const entryFieldAliases: Record<string, string> = {
  id: '_id',
  status: '_status',
  title: '_title',
  type: '_type',
  seeded: '_seeded',
  workspace: '_workspace',
  root: '_root',
  level: '_level',
  filePath: '_filePath',
  parentDir: '_parentDir',
  childrenDir: '_childrenDir',
  index: '_index',
  parentId: '_parentId',
  parents: '_parents',
  locale: '_locale',
  rowHash: '_rowHash',
  active: '_active',
  main: '_main',
  path: '_path',
  fileHash: '_fileHash',
  url: '_url',
  searchableText: '_searchableText'
}

export class ContentEntryDB extends Graph {
  readonly #scope: Scope
  #db: ContentDB<ContentEntryMeta, ContentEntryDerived>
  #plans = new WeakMap<GraphQuery, ContentQueryPlan>()
  #sha: string | undefined
  #bytes: Uint8Array | undefined

  constructor(
    public config: Config,
    source?: ArrayBuffer | Uint8Array
  ) {
    super()
    this.#scope = getScope(config)
    const parsed = source ? parseContentEntryBytes(source) : undefined
    const buffer = parsed?.buffer
    this.#db = new ContentDB(createContentEntryShape(config), buffer)
    this.#sha = parsed?.sha
    this.#bytes = source instanceof Uint8Array ? source : undefined
  }

  static fromIndex(config: Config, index: EntryIndex): ContentEntryDB {
    const db = new ContentEntryDB(config)
    db.#replaceFromIndex(index)
    return db
  }

  static open(config: Config, bytes: Uint8Array): ContentEntryDB {
    return new ContentEntryDB(config, bytes)
  }

  get sha(): string | undefined {
    return this.#sha
  }

  async syncWith(source: Source): Promise<string> {
    const tree =
      this.#sha === undefined
        ? await source.getTree()
        : await source.getTreeIfDifferent(this.#sha)
    if (!tree) return this.#sha!
    const index = new EntryIndex(this.config)
    const sha = await index.syncWith(source)
    if (this.#sha === sha) return sha
    this.#replaceFromIndex(index)
    return sha
  }

  upsert(entry: Entry) {
    this.#bytes = undefined
    const meta: ContentEntryMeta = {
      _id: entry.id,
      _type: entry.type,
      _status: entry.status,
      _active: entry.active,
      _main: entry.main,
      _workspace: entry.workspace,
      _root: entry.root,
      _parentId: entry.parentId,
      _locale: entry.locale,
      _path: entry.path,
      _url: entry.url,
      _level: entry.level,
      _index: entry.index,
      _filePath: entry.filePath
    }
    const payload = {
      ...entry.data,
      ...fromEntries(
        entries(entryFieldAliases).map(([field, alias]) => [
          alias,
          (entry as any)[field]
        ])
      )
    }
    if (payload._rowHash === payload._fileHash) delete payload._rowHash
    this.#db.upsert(meta, payload)
  }

  exportBytes(): Uint8Array {
    return (this.#bytes ??= encodeContentEntryBytes(
      this.#db.compile(),
      this.#sha
    ))
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const plan = this.#plan(query)
    if (
      query.count &&
      !plan.searchTerms &&
      !query.orderBy &&
      !query.groupBy &&
      !query.skip &&
      !query.take
    )
      return this.#db.count(plan.filter) as AnyQueryResult<Query>
    const ids = this.#matchingIds(plan)
    const ordered =
      query.orderBy || query.groupBy ? this.#orderIds(ids, query, plan) : ids
    if (query.skip) ordered.splice(0, query.skip)
    if (query.take) ordered.splice(query.take)
    if (query.count) return ordered.length as AnyQueryResult<Query>
    const projection = query as GraphQuery<Projection>
    const projected =
      query.first || query.get
        ? ordered.length > 0
          ? [plan.select(ordered[0]!)]
          : []
        : ordered.map(plan.select)
    if (plan.needsPostProcessing) {
      const loaders = new Map<string, ContentEntryLinkLoader>()
      await Promise.all(
        projected.map((row, index) =>
          this.#postRow(
            getLinkLoader(
              loaders,
              this,
              query.status ?? 'published',
              () => this.#read(ordered[index], '_locale') as string | null
            ),
            row,
            projection
          )
        )
      )
    }
    const result = query.first || query.get ? projected[0] : projected
    return result as AnyQueryResult<Query>
  }

  #replaceFromIndex(index: EntryIndex) {
    this.#db = new ContentDB(createContentEntryShape(this.config))
    this.#plans = new WeakMap()
    this.#sha = index.sha
    this.#bytes = undefined
    for (const entry of index.filter({})) this.upsert(entry)
  }

  #plan(query: GraphQuery): ContentQueryPlan {
    const cached = this.#plans.get(query)
    if (cached) return cached
    const projection = query as GraphQuery<Projection>
    const orders = query.orderBy
      ? (Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy]).map(
          order => {
            const expr = (order.asc ?? order.desc)!
            const field = this.#exprField(expr)
            return {
              order,
              read: this.#exprReader(expr),
              fastString: field === '_id' || field === '_type'
            }
          }
        )
      : undefined
    const plan = {
      filter: this.#filter(query),
      searchTerms: Array.isArray(query.search)
        ? query.search.map(term => term.toLowerCase())
        : query.search
          ? [query.search.toLowerCase()]
          : undefined,
      select: this.#selector(projection.select),
      needsPostProcessing: needsPostProcessing(projection.select),
      orders
    }
    this.#plans.set(query, plan)
    return plan
  }

  #matchingIds(plan: ContentQueryPlan): Array<number> {
    const ids = Array.from(this.#db.find(plan.filter))
    return plan.searchTerms
      ? ids.filter(id => {
          const text = this.#searchTextFor(id)
          return plan.searchTerms!.every(term => text.includes(term))
        })
      : ids
  }

  #filter(query: GraphQuery): Filter<AnyRecord> {
    const and = Array<Filter<AnyRecord>>()
    and.push(this.#statusFilter(query.status ?? 'published'))
    if (query.id !== undefined) and.push({_id: query.id} as Filter<AnyRecord>)
    if (query.parentId !== undefined)
      and.push({_parentId: query.parentId} as Filter<AnyRecord>)
    if (query.path !== undefined)
      and.push({_path: query.path} as Filter<AnyRecord>)
    if (query.url !== undefined)
      and.push({_url: query.url} as Filter<AnyRecord>)
    if (query.level !== undefined)
      and.push({_level: query.level} as Filter<AnyRecord>)
    const workspace =
      query.workspace &&
      typeof query.workspace === 'object' &&
      hasWorkspace(query.workspace)
        ? this.#scope.nameOf(query.workspace)
        : query.workspace
    if (workspace !== undefined)
      and.push({_workspace: workspace} as Filter<AnyRecord>)
    const root =
      query.root && typeof query.root === 'object' && hasRoot(query.root)
        ? this.#scope.nameOf(query.root)
        : query.root
    if (root !== undefined) and.push({_root: root} as Filter<AnyRecord>)
    if (query.locale !== undefined)
      and.push({_locale: query.locale} as Filter<AnyRecord>)
    if (query.type) and.push(this.#typeFilter(query.type))
    if (query.filter) and.push(normalizeFilter(query.filter as AnyRecord))
    if (query.location) {
      const location = Array.isArray(query.location)
        ? query.location
        : this.#scope.locationOf(query.location)
      if (location) and.push(locationFilter(location))
    }
    return and.length === 1 ? and[0] : {and}
  }

  #statusFilter(status: Status): Filter<AnyRecord> {
    switch (status) {
      case 'published':
      case 'draft':
      case 'archived':
        return {_status: status}
      case 'preferDraft':
        return {_active: true}
      case 'preferPublished':
        return {_main: true}
      case 'all':
        return {}
    }
  }

  #typeFilter(type: unknown): Filter<AnyRecord> {
    const types = Array.isArray(type) ? type : [type]
    const names = types.map(type =>
      typeof type === 'string' ? type : this.#scope.nameOf(type as AlineaType)
    )
    return {_type: {in: names}}
  }

  #searchTextFor(id: number): string {
    return String(this.#read(id, '_searchableText') ?? '').toLowerCase()
  }

  #orderIds(
    ids: Array<number>,
    query: GraphQuery,
    plan: ContentQueryPlan
  ): Array<number> {
    let ordered = ids.slice()
    if (query.groupBy && !Array.isArray(query.groupBy)) {
      const groups = new Map<unknown, number>()
      const group = this.#exprReader(query.groupBy)
      for (const id of ordered) {
        const value = group(id)
        if (!groups.has(value)) groups.set(value, id)
      }
      ordered = Array.from(groups.values())
    }
    if (plan.orders) {
      const decorated = ordered.map(id => ({
        id,
        values: plan.orders!.map(order => order.read(id))
      }))
      decorated.sort((left, right) =>
        this.#compareOrderedValues(left.values, right.values, plan.orders!)
      )
      ordered = decorated.map(item => item.id)
    }
    return ordered
  }

  #compareOrderedValues(
    left: Array<unknown>,
    right: Array<unknown>,
    orders: Array<CompiledOrder>,
  ) {
    for (let index = 0; index < orders.length; index++) {
      const {order, fastString} = orders[index]!
      const valueA = left[index] as string | number
      const valueB = right[index] as string | number
      const strings = typeof valueA === 'string' && typeof valueB === 'string'
      const numbers = typeof valueA === 'number' && typeof valueB === 'number'
      if (strings) {
        const compare = fastString
          ? stringCompare(valueA, valueB)
          : order.caseSensitive
            ? CASE_SENSITIVE_COLLATOR.compare(valueA, valueB)
            : NATURAL_COLLATOR.compare(valueA, valueB)
        if (compare !== 0) return order.asc ? compare : -compare
      } else if (numbers && valueA !== valueB) {
        return order.asc ? valueA - valueB : valueB - valueA
      }
    }
    return 0
  }

  #selector(projection: Projection | undefined): (id: number) => unknown {
    if (!projection) return id => this.#fullRow(id)
    if (hasExpr(projection)) return this.#exprReader(projection as Expr)
    const fields = entries(projection as AnyRecord).map(([key, value]) => [
      key,
      this.#selector(value as Projection)
    ] as const)
    return id =>
      fromEntries(fields.map(([key, select]) => [key, select(id)]))
  }

  #exprReader(expr: Expr): (id: number) => unknown {
    const internal = getExpr(expr)
    switch (internal.type) {
      case 'entryField': {
        const field = entryFieldAliases[internal.name] ?? internal.name
        return id => this.#read(id, field)
      }
      case 'field': {
        const name = this.#scope.nameOf(expr)
        return name ? id => this.#read(id, name) : () => undefined
      }
      case 'value':
        return () => internal.value
      case 'call':
        return () => undefined
    }
  }

  #exprField(expr: Expr): string | undefined {
    const internal = getExpr(expr)
    if (internal.type === 'entryField')
      return entryFieldAliases[internal.name] ?? internal.name
    if (internal.type === 'field') return this.#scope.nameOf(expr)
  }

  async #postExpr(
    loader: ContentEntryLinkLoader,
    interim: unknown,
    expr: Expr
  ) {
    if (hasField(expr))
      await Field.shape(expr).applyLinks(interim, loader as any)
  }

  async #postRow(
    loader: ContentEntryLinkLoader,
    interim: unknown,
    query: GraphQuery<Projection>
  ) {
    if (!interim || !query.select) return
    if (hasExpr(query.select))
      return this.#postExpr(loader, interim, query.select as Expr)
    await Promise.all(
      entries(query.select as AnyRecord).map(([key, value]) => {
        if (value && hasExpr(value))
          return this.#postExpr(
            loader,
            (interim as AnyRecord)[key],
            value as Expr
          )
      })
    )
  }

  #read(id: number, field: string): unknown {
    const value = this.#db.read(id, field)
    if (value === undefined && field === '_rowHash')
      return this.#db.read(id, '_fileHash')
    return value
  }

  #fullRow(id: number): AnyRecord {
    const row = this.#db.hydrate(id) as AnyRecord
    row._rowHash ??= row._fileHash
    const data = fromEntries(
      entries(row).filter(([key]) => !key.startsWith('_'))
    )
    const entry = fromEntries(
      entries(entryFieldAliases).map(([field, alias]) => [field, row[alias]])
    )
    return {...entry, data}
  }
}

class ContentEntryLinkLoader {
  readonly #cache = new Map<string, Promise<unknown>>()
  readonly #resolved = new Map<string, unknown>()
  readonly #queued = new Set<string>()
  #flush: Promise<void> | undefined
  #projection: Projection | undefined

  constructor(
    readonly db: ContentEntryDB,
    readonly status: Status,
    readonly locale: string | null
  ) {}

  includedAtBuild() {
    return true
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ) {
    const missing = entryIds.filter(id => !this.#cache.has(id))
    if (missing.length > 0) {
      this.#projection ??= projection
      for (const id of missing) this.#queued.add(id)
      this.#flush ??= Promise.resolve().then(() => this.#flushQueued())
      for (const id of missing) {
        this.#cache.set(
          id,
          this.#flush.then(() => this.#resolved.get(id))
        )
      }
    }
    return Promise.all(entryIds.map(id => this.#cache.get(id)))
  }

  async #flushQueued() {
    while (this.#queued.size > 0) {
      const ids = Array.from(this.#queued)
      this.#queued.clear()
      const rows = (await this.db.resolve({
        id: {in: ids},
        preferredLocale: this.locale ?? undefined,
        status: this.status,
        select: this.#projection
      } as any)) as Array<any>
      for (const row of rows) {
        const id = row.id ?? row.entryId ?? row._id
        if (typeof id === 'string') this.#resolved.set(id, row)
      }
    }
    this.#flush = undefined
  }
}

function getLinkLoader(
  loaders: Map<string, ContentEntryLinkLoader>,
  db: ContentEntryDB,
  status: Status,
  locale: () => string | null
) {
  const value = locale()
  const key = `${status}:${value ?? ''}`
  let loader = loaders.get(key)
  if (!loader) {
    loader = new ContentEntryLinkLoader(db, status, value)
    loaders.set(key, loader)
  }
  return loader
}

function needsPostProcessing(projection: Projection | undefined): boolean {
  if (!projection) return false
  if (hasField(projection)) return true
  if (hasExpr(projection)) return false
  return entries(projection as AnyRecord).some(([, value]) =>
    needsPostProcessing(value as Projection)
  )
}

function createContentEntryShape(
  config: Config
): ContentShape<ContentEntryMeta, ContentEntryDerived> {
  const fieldsByType = fromEntries(
    entries(config.schema).map(([typeName, type]) => {
      const directives = fromEntries(
        entries(Type.shape(type).shapes).map(([fieldName, shape]) => [
          fieldName,
          shape instanceof ScalarShape
            ? scalarDirective(shape)
            : 'payload'
        ])
      ) as Record<string, FieldDirective>
      return [typeName, directives]
    })
  )
  return {
    global: globalFields,
    lookup: '_filePath',
    derive() {
      return {}
    },
    type(meta) {
      return meta._type
    },
    fields(type) {
      return fieldsByType[type] ?? {}
    },
    paths() {
      return []
    }
  }
}

function scalarDirective(shape: ScalarShape<unknown>): FieldDirective {
  if (typeof shape.initialValue === 'string') return 'dictionary'
  if (typeof shape.initialValue === 'number') return 'range'
  return 'column'
}

const NATURAL_COLLATOR = new Intl.Collator(undefined, {numeric: true})
const CASE_SENSITIVE_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'variant'
})

function stringCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

const CONTENT_ENTRY_MAGIC = 0x414c4345
const CONTENT_ENTRY_VERSION = 1
const contentEntryEncoder = new TextEncoder()
const contentEntryDecoder = new TextDecoder()

function encodeContentEntryBytes(
  contentBuffer: ArrayBuffer,
  sha: string | undefined
): Uint8Array {
  const meta = contentEntryEncoder.encode(JSON.stringify({sha: sha ?? null}))
  const content = new Uint8Array(contentBuffer)
  const output = new Uint8Array(12 + meta.byteLength + content.byteLength)
  const view = new DataView(output.buffer)
  view.setUint32(0, CONTENT_ENTRY_MAGIC, true)
  view.setUint32(4, CONTENT_ENTRY_VERSION, true)
  view.setUint32(8, meta.byteLength, true)
  output.set(meta, 12)
  output.set(content, 12 + meta.byteLength)
  return output
}

function parseContentEntryBytes(
  source: ArrayBuffer | Uint8Array
): {buffer: ArrayBuffer; sha?: string} {
  const bytes =
    source instanceof Uint8Array
      ? source
      : new Uint8Array(source)
  if (bytes.byteLength < 12) return {buffer: toArrayBuffer(bytes)}
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== CONTENT_ENTRY_MAGIC)
    return {buffer: toArrayBuffer(bytes)}
  const version = view.getUint32(4, true)
  if (version !== CONTENT_ENTRY_VERSION)
    throw new Error(`Unsupported ContentEntryDB version ${version}`)
  const metaLength = view.getUint32(8, true)
  if (12 + metaLength > bytes.byteLength)
    throw new Error('ContentEntryDB metadata exceeds its buffer boundary')
  const meta = JSON.parse(
    contentEntryDecoder.decode(bytes.subarray(12, 12 + metaLength))
  ) as {sha?: unknown}
  return {
    buffer: toArrayBuffer(bytes.subarray(12 + metaLength)),
    sha: typeof meta.sha === 'string' ? meta.sha : undefined
  }
}

function normalizeFilter(filter: AnyRecord): Filter<AnyRecord> {
  if (Array.isArray(filter.and))
    return {and: filter.and.filter(Boolean).map(normalizeFilter)}
  if (Array.isArray(filter.or))
    return {or: filter.or.filter(Boolean).map(normalizeFilter)}
  return fromEntries(
    entries(filter).map(([key, value]) => [key, normalizeCondition(value)])
  )
}

function normalizeCondition(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const input = value as AnyRecord
  if (input.has) return {...input, has: normalizeFilter(input.has)}
  if (input.includes)
    return {...input, includes: normalizeFilter(input.includes)}
  return fromEntries(
    entries(input).map(([key, value]) => [key, normalizeCondition(value)])
  )
}

function locationFilter(location: Array<string>): Filter<AnyRecord> {
  switch (location.length) {
    case 1:
      return {_workspace: location[0]}
    case 2:
      return {_workspace: location[0], _root: location[1]}
    default:
      return {}
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}
