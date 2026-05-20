import type {EntryStatus} from '../Entry.js'
import type {Entry} from '../Entry.js'
import type {Expr} from '../Expr.js'
import type {GraphQuery, Order, Projection, Status} from '../Graph.js'
import {querySource} from '../Graph.js'
import {getExpr, hasExpr} from '../Internal.js'
import {compileEntryFilter} from './EntryFilter.js'
import type {
  EntryQueryConstraints,
  EntryQueryOptions,
  EntryQueryPlan,
  TracedEntryQueryResult
} from './RxbEntryPlanner.js'
import {createQueryTrace, mergeQueryTraces} from './QueryTrace.js'
import type {
  RxbEntryArtifact,
  RxbEntryColumnName,
  RxbEntryRow
} from './RxbEntryArtifact.js'
import {decodeRxbEntryArtifact} from './RxbEntryArtifact.js'
import {RxbEntryPlanner} from './RxbEntryPlanner.js'

export interface RxbEntryEngineOptions {
  artifact: RxbEntryArtifact
  bytes?: Uint8Array
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
  entryCacheSize?: number
}

export interface OpenRxbEntryEngineOptions {
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
  entryCacheSize?: number
}

export class RxbEntryEngine {
  readonly #artifact: RxbEntryArtifact
  readonly #planner: RxbEntryPlanner
  readonly #entryCacheSize: number
  readonly #entries = new Map<string, Entry>()
  #rowOrdinals: Map<string, number> | undefined
  readonly #ordinalCache = new WeakMap<Array<string>, Array<number>>()
  readonly #columnCache = new Map<RxbEntryColumnName, Array<unknown>>()

  constructor(options: RxbEntryEngineOptions) {
    this.#artifact = options.artifact
    this.#planner = new RxbEntryPlanner(options.artifact, {
      leafCacheSize: options.leafCacheSize,
      planCacheSize: options.planCacheSize,
      rowCacheSize: options.rowCacheSize
    })
    this.#entryCacheSize = options.entryCacheSize ?? 512
  }

  get graphSha() {
    return this.#artifact.meta.graphSha
  }

  get artifact() {
    return this.#artifact
  }

  query<Value>(
    plan: EntryQueryPlan,
    options: EntryQueryOptions & {trace: true}
  ): Promise<TracedEntryQueryResult<Value>>
  query<Value>(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): Promise<Value>
  async query<Value>(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): Promise<Value | TracedEntryQueryResult<Value>> {
    const unsupported = unsupportedRxbEntryQueryReason(plan.query)
    if (unsupported)
      throw new Error(`Unsupported RXB engine query: ${unsupported}`)

    const constraints =
      plan.constraints ?? compileRxbEntryQueryConstraints(plan.query)
    const candidatePlan = this.#planner.candidateRowIds(
      {...plan, constraints},
      options
    )
    const query = plan.query as GraphQuery<Projection>
    const predicate = isRxbFilterFullyIndexed(query.filter)
      ? undefined
      : compileEntryFilter(query.filter, readRowField)
    let rowIds = candidatePlan.rowIds
    if (predicate) {
      rowIds = this.#planner
        .rowsForIds(rowIds)
        .filter(row => predicate(row))
        .map(row => row.rowId)
    }
    if (
      !options?.trace &&
      !query.count &&
      !query.groupBy &&
      !query.orderBy &&
      !query.skip &&
      !query.take
    ) {
      return this.#projectRowIds(rowIds, query) as Value
    }
    let rows =
      query.count && !query.groupBy && !query.orderBy
        ? []
        : this.#planner.rowsForIds(rowIds)

    if (query.groupBy && !Array.isArray(query.groupBy))
      rows = groupRows(rows, query.groupBy)
    if (query.orderBy) orderRows(rows, query.orderBy)

    if (query.skip) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(query.skip)
      else rows.splice(0, query.skip)
    }
    if (query.take) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(0, query.take)
      else rows.splice(query.take)
    }
    if (!(query.count && !query.groupBy)) rowIds = rows.map(row => row.rowId)

    const value = (
      query.count
        ? query.groupBy
          ? rows.length
          : rowIds.length
        : query.get
          ? this.#projectRow(rows[0], query.select, rowIds[0])
          : query.first
            ? rowIds[0]
              ? this.#projectRow(rows[0], query.select, rowIds[0])
              : null
            : rows.map(row => this.#projectRow(row, query.select, row.rowId))
    ) as Value

    if (options?.trace) {
      return {
        value,
        trace: mergeQueryTraces(
          candidatePlan.trace,
          createQueryTrace({
            graphSha: this.graphSha,
            nodes: rows.map(row => row.id)
          })
        )
      }
    }
    return value
  }

  #entryForRow(row: RxbEntryRow): Entry {
    const cached = this.#entries.get(row.rowId)
    if (cached) return cached
    const {
      rowId: _rowId,
      versionId: _versionId,
      nodeId: _nodeId,
      languageId: _languageId,
      versionStatus: _versionStatus,
      ...entry
    } = row
    this.#entries.set(row.rowId, entry)
    if (this.#entries.size > this.#entryCacheSize) {
      const first = this.#entries.keys().next().value
      if (first) this.#entries.delete(first)
    }
    return entry
  }

  #projectRow(
    row: RxbEntryRow | undefined,
    projection: Projection | undefined,
    rowId?: string
  ): unknown {
    if (!projection) {
      if (!row) return undefined
      return this.#entryForRow(row)
    }
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      if (expr.type !== 'entryField')
        throw new Error(`Unsupported RXB engine projection: ${expr.type}`)
      if (rowId) {
        const columnValue = this.#columnValue(
          rowId,
          expr.name as keyof RxbEntryRow
        )
        if (columnValue.found) return columnValue.value
      }
      if (!row) return undefined
      return row[expr.name as keyof RxbEntryRow]
    }
    return Object.fromEntries(
      Object.entries(projection as Record<string, Projection>).map(
        ([key, value]) => [key, this.#projectRow(row, value, rowId)]
      )
    )
  }

  #projectRowIds(
    rowIds: Array<string>,
    query: GraphQuery<Projection>
  ): unknown {
    if (!query.select) {
      if (query.get)
        return this.#projectRow(this.#planner.row(rowIds[0]), undefined)
      if (query.first)
        return rowIds[0]
          ? this.#projectRow(this.#planner.row(rowIds[0]), undefined)
          : null
      return rowIds.map(rowId =>
        this.#projectRow(this.#planner.row(rowId), undefined)
      )
    }
    if (query.get) {
      const ordinal = this.#rowOrdinal(rowIds[0])
      return ordinal === undefined
        ? undefined
        : this.#projectOrdinal(ordinal, query.select)
    }
    if (query.first) {
      const rowId = rowIds[0]
      const ordinal = rowId ? this.#rowOrdinal(rowId) : undefined
      return ordinal === undefined
        ? null
        : this.#projectOrdinal(ordinal, query.select)
    }
    const ordinals = this.#ordinalsForRowIds(rowIds)
    return ordinals.map(ordinal => this.#projectOrdinal(ordinal, query.select))
  }

  #columnValue(
    rowId: string,
    name: keyof RxbEntryRow
  ): {found: boolean; value: unknown} {
    if (name === 'data') return {found: false, value: undefined}
    const columns = this.#artifact.payload.columns
    if (!columns) return {found: false, value: undefined}
    const ordinal = this.#rowOrdinal(rowId)
    if (ordinal === undefined) return {found: false, value: undefined}
    const values = this.#columnValues(name as RxbEntryColumnName)
    return {found: true, value: values[ordinal]}
  }

  #rowOrdinal(rowId: string): number | undefined {
    if (this.#rowOrdinals) return this.#rowOrdinals.get(rowId)
    const rowIds = Array.from(this.#artifact.payload.columns.rowIds)
    const ordinals = new Map<string, number>()
    for (let i = 0; i < rowIds.length; i++) ordinals.set(rowIds[i], i)
    this.#rowOrdinals = ordinals
    return ordinals.get(rowId)
  }

  #columnValues(name: RxbEntryColumnName): Array<unknown> {
    const cached = this.#columnCache.get(name)
    if (cached) return cached
    const values = Array.from(
      this.#artifact.payload.columns.values[name] as ReadonlyArray<unknown>
    )
    this.#columnCache.set(name, values)
    return values
  }

  #ordinalsForRowIds(rowIds: Array<string>): Array<number> {
    const cached = this.#ordinalCache.get(rowIds)
    if (cached) return cached
    const ordinals = rowIds
      .map(rowId => this.#rowOrdinal(rowId))
      .filter((ordinal): ordinal is number => ordinal !== undefined)
    this.#ordinalCache.set(rowIds, ordinals)
    return ordinals
  }

  #projectOrdinal(
    ordinal: number,
    projection: Projection | undefined
  ): unknown {
    if (!projection) {
      const rowId = this.#columnValues('rowId')[ordinal] as string
      return this.#projectRow(this.#planner.row(rowId), undefined)
    }
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      if (expr.type !== 'entryField')
        throw new Error(`Unsupported RXB engine projection: ${expr.type}`)
      if (expr.name === 'data') {
        const rowId = this.#columnValues('rowId')[ordinal] as string
        return this.#planner.row(rowId)?.data
      }
      return this.#columnValues(expr.name as RxbEntryColumnName)[ordinal]
    }
    return Object.fromEntries(
      Object.entries(projection as Record<string, Projection>).map(
        ([key, value]) => [key, this.#projectOrdinal(ordinal, value)]
      )
    )
  }
}

export function openRxbEntryEngine(
  buffer: Uint8Array,
  options: OpenRxbEntryEngineOptions = {}
): RxbEntryEngine {
  return new RxbEntryEngine({
    artifact: decodeRxbEntryArtifact(buffer),
    bytes: buffer,
    ...options
  })
}

export function compileRxbEntryQueryConstraints(
  query: GraphQuery
): EntryQueryConstraints | undefined {
  const unsupported = unsupportedRxbEntryQueryReason(query)
  if (unsupported)
    throw new Error(`Unsupported RXB engine query: ${unsupported}`)

  const constraints: EntryQueryConstraints = {}
  const id = stringValues(query.id)
  if (id) constraints.id = id
  const parentId = nullableStringValues(query.parentId)
  if (parentId !== undefined) constraints.parentId = parentId
  const path = stringValues(query.path)
  if (path) constraints.path = path
  const url = stringValues(query.url)
  if (url) constraints.url = url
  const level = numberValues(query.level)
  if (level !== undefined) constraints.level = level
  const workspace = stringValues(query.workspace)
  if (workspace) constraints.workspace = workspace
  const root = stringValues(query.root)
  if (root) constraints.root = root
  if (query.locale !== undefined) {
    constraints.locale = query.locale
  } else if (query.preferredLocale) {
    constraints.locale = [query.preferredLocale.toLowerCase(), null]
  }
  const type = stringValues(query.type)
  if (type) constraints.type = type
  applyStatusConstraint(constraints, query.status)

  return Object.keys(constraints).length > 0 ? constraints : undefined
}

export function unsupportedRxbEntryQueryReason(
  query: GraphQuery
): string | undefined {
  if (querySource(query)) return 'edges'
  if (query.select) {
    const reason = unsupportedEntryProjectionReason(query.select as Projection)
    if (reason) return `projection ${reason}`
  }
  if (query.include) return 'include'
  if (query.search) return 'search'
  if (query.location) return 'location'
  if (query.orderBy) {
    const reason = unsupportedEntryOrderReason(query.orderBy)
    if (reason) return `orderBy ${reason}`
  }
  if (query.groupBy) {
    const reason = unsupportedEntryGroupReason(query.groupBy)
    if (reason) return `groupBy ${reason}`
  }
  if (query.preview) return 'preview'
  if (query.type && !stringValues(query.type)) return 'non-string type'
  if (query.workspace && !stringValues(query.workspace))
    return 'non-string workspace'
  if (query.root && !stringValues(query.root)) return 'non-string root'
  if (
    query.status &&
    query.status !== 'all' &&
    query.status !== 'preferDraft' &&
    query.status !== 'preferPublished' &&
    !statusValues(query.status)
  )
    return `status "${query.status}"`
}

function readRowField(row: RxbEntryRow, name: string): unknown {
  if (name in row) return row[name as keyof RxbEntryRow]
  return row.data[name]
}

function unsupportedEntryProjectionReason(
  projection: Projection | undefined
): string | undefined {
  if (!projection) return
  if (hasExpr(projection as any)) {
    const expr = getExpr(projection as any)
    if (expr.type === 'entryField') return
    return expr.type
  }
  if (!isRecord(projection)) return 'non-object projection'
  if (querySource(projection)) return 'edges'
  for (const value of Object.values(projection)) {
    const reason = unsupportedEntryProjectionReason(value as Projection)
    if (reason) return reason
  }
}

function unsupportedEntryOrderReason(
  orderBy: Order | Array<Order> | undefined
): string | undefined {
  if (!orderBy) return
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  for (const order of orders) {
    const expr = order.asc ?? order.desc
    if (!expr) return 'missing expression'
    if (!hasExpr(expr as any)) return 'non-expression'
    const internal = getExpr(expr as any)
    if (internal.type !== 'entryField') return internal.type
  }
}

function unsupportedEntryGroupReason(
  groupBy: Expr | Array<Expr> | undefined
): string | undefined {
  if (!groupBy) return
  if (Array.isArray(groupBy)) return 'multiple fields'
  if (!hasExpr(groupBy as any)) return 'non-expression'
  const internal = getExpr(groupBy as any)
  if (internal.type !== 'entryField') return internal.type
}

function orderRows(rows: Array<RxbEntryRow>, orderBy: Order | Array<Order>) {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  rows.sort((a, b) => {
    for (const order of orders) {
      const expr = order.asc ?? order.desc
      if (!expr || !hasExpr(expr as any)) continue
      const internal = getExpr(expr as any)
      if (internal.type !== 'entryField') continue
      const result = compareValues(
        a[internal.name as keyof RxbEntryRow],
        b[internal.name as keyof RxbEntryRow],
        order.caseSensitive
      )
      if (result !== 0) return order.asc ? result : -result
    }
    return 0
  })
}

function groupRows(
  rows: Array<RxbEntryRow>,
  groupBy: Expr
): Array<RxbEntryRow> {
  const groups = new Map<unknown, RxbEntryRow>()
  const internal = getExpr(groupBy as any)
  for (const row of rows) {
    const value =
      internal.type === 'entryField'
        ? row[internal.name as keyof RxbEntryRow]
        : undefined
    if (!groups.has(value)) groups.set(value, row)
  }
  return Array.from(groups.values())
}

function compareValues(
  a: unknown,
  b: unknown,
  caseSensitive: boolean | undefined
) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') {
    return caseSensitive
      ? a.localeCompare(b)
      : a.localeCompare(b, undefined, {numeric: true})
  }
  return 0
}

function isRxbFilterFullyIndexed(filter: unknown): boolean {
  if (!filter) return true
  if (!isRecord(filter)) return false
  if (isOnlyFilterKey(filter, 'and'))
    return filter.and.filter(Boolean).every(isRxbFilterFullyIndexed)
  if (isOnlyFilterKey(filter, 'or'))
    return filter.or.filter(Boolean).every(isRxbFilterFullyIndexed)
  return Object.values(filter).every(isRxbFieldConditionFullyIndexed)
}

function isRxbFieldConditionFullyIndexed(condition: unknown): boolean {
  if (isPrimitiveIndexValue(condition)) return true
  if (!isRecord(condition)) return false
  for (const key of Object.keys(condition)) {
    switch (key) {
      case 'is':
        if (!isPrimitiveIndexValue(condition.is)) return false
        break
      case 'in':
        if (
          !Array.isArray(condition.in) ||
          !condition.in.every(isPrimitiveIndexValue)
        )
          return false
        break
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        if (typeof condition[key] !== 'number') return false
        break
      case 'has':
      case 'includes':
        if (!isRxbFilterFullyIndexed(condition[key])) return false
        break
      default:
        return false
    }
  }
  return true
}

function isPrimitiveIndexValue(
  value: unknown
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isOnlyFilterKey<T extends string>(
  input: object,
  key: T
): input is Record<T, Array<unknown>> {
  const keys = Object.keys(input)
  return keys.length === 1 && keys[0] === key
}

function stringValues(input: unknown): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'string')
    if (values.length > 0) return values
  }
}

function nullableStringValues(
  input: unknown
): string | null | Array<string | null> | undefined {
  if (input === null || typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(
      value => value === null || typeof value === 'string'
    )
    if (values.length > 0) return values
  }
}

function numberValues(input: unknown): number | Array<number> | undefined {
  if (typeof input === 'number') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'number')
    if (values.length > 0) return values
  }
}

function statusValues(
  input: Status | undefined
): EntryStatus | Array<EntryStatus> | undefined {
  if (!input) return undefined
  if (Array.isArray(input)) {
    const values = input.filter(isExactStatus)
    if (values.length === input.length) return values
    return
  }
  if (isExactStatus(input)) return input
}

function applyStatusConstraint(
  constraints: EntryQueryConstraints,
  input: Status | undefined
) {
  switch (input) {
    case 'all':
      return
    case 'preferDraft':
      constraints.active = true
      return
    case 'preferPublished':
      constraints.main = true
      return
    default: {
      const status = statusValues(input ?? 'published')
      if (status) constraints.status = status
    }
  }
}

function isExactStatus(input: unknown): input is EntryStatus {
  return input === 'published' || input === 'draft' || input === 'archived'
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}
