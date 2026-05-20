import type {Filter} from '../Filter.js'
import type {GraphQuery} from '../Graph.js'
import type {EntryStatus} from '../Entry.js'
import type {Config} from '../Config.js'
import {ReadonlyTree} from '../source/Tree.js'
import type {QueryTrace} from './QueryTrace.js'
import {
  hydrateRxbEntryRowAt,
  indexKey,
  indexValue,
  RxbEntryArtifactCursor,
  rxbEntryIsActive,
  rxbEntryIsMain,
  rxbEntryInfoFromRowId,
  rxbEntryStatusFromFlags
} from './RxbEntryArtifact.js'
import {createQueryTrace, emptyQueryTrace, traceIndex} from './QueryTrace.js'
import type {
  RxbEntryArtifact,
  RxbEntryPayload,
  RxbEntryRow
} from './RxbEntryArtifact.js'
import {rxbIndexValue} from './RxbEntryArtifact.js'

export interface EntryQueryPlan<Query = GraphQuery> {
  query: Query
  constraints?: EntryQueryConstraints
  preFilter?: EntryCandidateFilter
}

export interface EntryQueryConstraints {
  id?: string | ReadonlyArray<string>
  type?: string | ReadonlyArray<string>
  workspace?: string | ReadonlyArray<string>
  root?: string | ReadonlyArray<string>
  locale?: string | null | ReadonlyArray<string | null>
  status?: EntryStatus | ReadonlyArray<EntryStatus>
  active?: true
  main?: true
  parentId?: string | null | ReadonlyArray<string | null>
  path?: string | ReadonlyArray<string>
  url?: string | ReadonlyArray<string>
  level?: number | ReadonlyArray<number>
  filePath?: string | ReadonlyArray<string>
  dir?: string | ReadonlyArray<string>
  search?: string
}

export interface EntryCandidateFilter {
  rowIds?: Iterable<string>
  nodeIds?: Iterable<string>
  indexKeys?: Iterable<string>
}

export interface EntryQueryOptions {
  trace?: boolean
}

export interface TracedEntryQueryResult<Value> {
  value: Value
  trace: QueryTrace
}

export interface EntryCandidatePlan {
  rowIds: Array<string>
  trace?: QueryTrace
}

export interface RxbEntryCandidatePlan extends EntryCandidatePlan {
  rows: Array<RxbEntryRow>
}

export interface RxbEntryPlannerOptions {
  bytes?: Uint8Array
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
}

export class RxbEntryPlanner {
  readonly #config: Config
  readonly #payload: RxbEntryPayload
  readonly #graphSha: string
  readonly #leafCacheSize: number
  readonly #planCacheSize: number
  readonly #rowCacheSize: number
  readonly #cursor: RxbEntryArtifactCursor | undefined
  readonly #leafCache = new Map<string, Array<string>>()
  readonly #numberCache = new Map<string, Array<[number, string]>>()
  readonly #entryFieldIndexCache = new Map<
    keyof RxbEntryRow,
    Map<string, Array<string>>
  >()
  readonly #planCache = new Map<string, Array<string>>()
  readonly #rowCache = new Map<string, RxbEntryRow>()
  readonly #rowInfoCache = new Map<string, ReturnType<typeof rxbEntryInfoFromRowId>>()
  #rowOrdinals: Map<string, number> | undefined
  #rowIds: Array<string> | undefined
  #flags: Array<number> | undefined
  #sparseFlagReads = 0
  #fileHashes: Map<string, string> | undefined

  constructor(
    config: Config,
    artifact: RxbEntryArtifact,
    options: RxbEntryPlannerOptions = {}
  ) {
    this.#config = config
    this.#payload = artifact.payload
    this.#graphSha = artifact.meta.graphSha
    this.#leafCacheSize = options.leafCacheSize ?? 256
    this.#planCacheSize = options.planCacheSize ?? 256
    this.#rowCacheSize = options.rowCacheSize ?? 16384
    this.#cursor = options.bytes
      ? new RxbEntryArtifactCursor(options.bytes)
      : undefined
  }

  candidates(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): EntryCandidatePlan {
    return this.candidateRowIds(plan, options)
  }

  candidateRows(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): RxbEntryCandidatePlan {
    const result = this.candidateRowIds(plan, options)
    return {
      rowIds: result.rowIds,
      rows: this.rowsForIds(result.rowIds),
      trace: result.trace
    }
  }

  candidateRowIds(
    plan: EntryQueryPlan,
    options: EntryQueryOptions = {}
  ): EntryCandidatePlan {
    const cacheKey =
      !options.trace && !plan.preFilter ? candidateCacheKey(plan) : undefined
    if (cacheKey) {
      const cached = this.#planCache.get(cacheKey)
      if (cached) {
        this.#planCache.delete(cacheKey)
        this.#planCache.set(cacheKey, cached)
        return {rowIds: cached}
      }
    }

    let trace = options.trace ? emptyQueryTrace(this.#graphSha) : undefined
    let candidates: Array<string> | undefined

    const apply = (
      name: string,
      values: ReadonlyArray<string | number | boolean | null>,
      rowIds: Array<string>
    ) => {
      if (trace) {
        for (const value of values) {
          trace = traceIndex(
            trace,
            indexKey(name, value === null ? null : String(value))
          )
        }
      }
      if (
        candidates &&
        candidates.length <= 16 &&
        candidates.length <= rowIds.length &&
        canMatchIndexOnRow(name)
      ) {
        const expected = new Set(values.map(value => String(value)))
        candidates = candidates.filter(rowId =>
          this.#rowMatchesIndex(rowId, name, expected)
        )
      } else {
        candidates = intersectRowIds(candidates, rowIds)
      }
    }

    const fieldRowIds = this.#filterRowIds((plan.query as any).filter, trace)
    if (fieldRowIds) {
      candidates = intersectRowIds(candidates, fieldRowIds.rowIds)
      trace = fieldRowIds.trace
    }

    const constraints = plan.constraints
    if (constraints) {
      for (const [name, values, rowIds] of this.#constraintIndexes(
        constraints
      )) {
        apply(name, values, rowIds)
      }
      if (constraints.search && trace) {
        trace = traceIndex(trace, indexKey('search', constraints.search))
      }
    }

    if (plan.preFilter?.rowIds) {
      candidates = intersectRowIds(
        candidates,
        Array.from(plan.preFilter.rowIds)
      )
    }
    if (plan.preFilter?.nodeIds) {
      const rowIds = this.#rowIdsFromOrdinals(
        Array.from(plan.preFilter.nodeIds).flatMap(
          nodeId => this.#payload.indexes.byId[nodeId] ?? []
        )
      )
      candidates = intersectRowIds(candidates, rowIds)
    }
    if (plan.preFilter?.indexKeys && trace) {
      for (const key of plan.preFilter.indexKeys) trace = traceIndex(trace, key)
    }

    const rowIds = candidates ?? this.#rowIdsArray()
    if (trace) {
      if (!constraints && !plan.preFilter && !fieldRowIds)
        trace = traceIndex(trace, 'all')
      return {
        rowIds,
        trace: createQueryTrace({
          graphSha: trace.graphSha,
          rows: rowIds,
          indexes: trace.indexes
        })
      }
    }
    if (cacheKey) this.#cachePlan(cacheKey, rowIds)
    return {rowIds}
  }

  row(rowId: string): RxbEntryRow | undefined {
    const cached = this.#rowCache.get(rowId)
    if (cached) {
      this.#rowCache.delete(rowId)
      this.#rowCache.set(rowId, cached)
      return cached
    }
    const ordinal = this.#rowOrdinal(rowId)
    const row =
      ordinal === undefined
        ? undefined
        : hydrateRxbEntryRowAt(
            this.#config,
            this.#payload,
            ordinal,
            this.#fileHashAt(rowId)
          )
    if (row) {
      this.#rowCache.set(rowId, row)
      if (this.#rowCache.size > this.#rowCacheSize) {
        const first = this.#rowCache.keys().next().value
        if (first) this.#rowCache.delete(first)
      }
    }
    return row
  }

  rowsForIds(rowIds: Array<string>): Array<RxbEntryRow> {
    return rowIds
      .map(rowId => this.row(rowId))
      .filter((row): row is RxbEntryRow => Boolean(row))
  }

  *#constraintIndexes(
    constraints: EntryQueryConstraints
  ): Generator<
    [
      name: string,
      values: Array<string | number | boolean | null>,
      rowIds: Array<string>
    ]
  > {
    if (constraints.id)
      yield this.#fromIndex(
        'id',
        valuesOf(constraints.id),
        this.#payload.indexes.byId
      )
    if (constraints.type)
      yield this.#fromIndex(
        'type',
        valuesOf(constraints.type),
        this.#payload.indexes.byType
      )
    if (constraints.status) {
      const values = valuesOf(constraints.status)
      yield ['status', values, this.#statusRowIds(values)]
    }
    if (constraints.active)
      yield ['active', [true], this.#flagRowIds('active', [true])]
    if (constraints.main)
      yield ['main', [true], this.#flagRowIds('main', [true])]
    if (constraints.workspace)
      yield this.#fromEntryFieldIndex('workspace', valuesOf(constraints.workspace))
    if (constraints.root)
      yield this.#fromEntryFieldIndex('root', valuesOf(constraints.root))
    if (constraints.locale !== undefined)
      yield this.#fromEntryFieldIndex('locale', valuesOf(constraints.locale))
    if (constraints.parentId !== undefined)
      yield this.#fromEntryFieldIndex('parentId', valuesOf(constraints.parentId))
    if (constraints.level !== undefined)
      yield this.#fromEntryFieldIndex('level', valuesOf(constraints.level))
    if (constraints.path)
      yield this.#fromEntryFieldIndex('path', valuesOf(constraints.path))
    if (constraints.url)
      yield this.#fromEntryFieldIndex('url', valuesOf(constraints.url))
    if (constraints.filePath)
      yield this.#fromEntryFieldIndex('filePath', valuesOf(constraints.filePath))
    if (constraints.dir)
      yield this.#fromEntryFieldIndex('childrenDir', valuesOf(constraints.dir))
  }

  #fromIndex(
    name: string,
    values: Array<string | number | boolean | null>,
    index: Record<string, Array<number>>
  ): [
    name: string,
    values: Array<string | number | boolean | null>,
    rowIds: Array<string>
  ] {
    if (values.length === 1) {
      const key = indexValue(values[0] as any)
      return [
        name,
        values,
        this.#cachedLeaf(`index:${name}:${key}`, () => index[key] ?? [])
      ]
    }
    return [
      name,
      values,
      uniqueRowIds(
        values.flatMap(value => {
          const key = indexValue(value as any)
          return this.#cachedLeaf(
            `index:${name}:${key}`,
            () => index[key] ?? []
          )
        })
      )
    ]
  }

  #fromEntryFieldIndex(
    field: keyof RxbEntryRow,
    values: Array<string | number | boolean | null>
  ): [
    name: string,
    values: Array<string | number | boolean | null>,
    rowIds: Array<string>
  ] {
    return [
      field,
      values,
      uniqueRowIds(
        values.flatMap(value =>
          this.#cachedRowIds(
            `runtime:${String(field)}:${rxbIndexValue(value)}`,
            () => this.#entryFieldIndex(field).get(rxbIndexValue(value)) ?? []
          )
        )
      )
    ]
  }

  #filterRowIds(
    filter: Filter | undefined,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} | undefined {
    const result = filter && this.#compileFilter(filter, '', trace)
    if (!result) return
    return result
  }

  #compileFilter(
    filter: Filter,
    prefix: string,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} | undefined {
    if (!isRecord(filter)) return
    if (isOnlyKey(filter, 'and')) {
      let rowIds: Array<string> | undefined
      for (const item of filter.and.filter(Boolean)) {
        const result = this.#compileFilter(item as Filter, prefix, trace)
        if (!result) continue
        rowIds = intersectRowIds(rowIds, result.rowIds)
        trace = result.trace
      }
      return rowIds ? {rowIds, trace} : undefined
    }
    if (isOnlyKey(filter, 'or')) {
      const parts = Array<Array<string>>()
      for (const item of filter.or.filter(Boolean)) {
        const result = this.#compileFilter(item as Filter, prefix, trace)
        if (!result) return
        parts.push(result.rowIds)
        trace = result.trace
      }
      return {rowIds: uniqueRowIds(parts.flat()), trace}
    }

    let rowIds: Array<string> | undefined
    for (const [name, condition] of Object.entries(filter)) {
      if (condition === undefined) continue
      const path = prefix ? `${prefix}.${name}` : name
      const result = this.#compileField(path, condition, trace)
      if (!result) continue
      rowIds = intersectRowIds(rowIds, result.rowIds)
      trace = result.trace
    }
    return rowIds ? {rowIds, trace} : undefined
  }

  #compileField(
    path: string,
    condition: unknown,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} | undefined {
    const entryField = ENTRY_FIELD_ALIASES[path]
    if (entryField) return this.#entryFieldRowIds(path, entryField, condition, trace)
    if (isPrimitiveIndexValue(condition))
      return this.#exactRowIds(path, [condition], trace)
    if (!isRecord(condition)) return
    const parts = Array<Array<string>>()
    if (isPrimitiveIndexValue(condition.is)) {
      const result = this.#exactRowIds(path, [condition.is], trace)
      if (result) {
        parts.push(result.rowIds)
        trace = result.trace
      }
    }
    if (Array.isArray(condition.in)) {
      const values = condition.in.filter(isPrimitiveIndexValue)
      if (values.length > 0) {
        const result = this.#exactRowIds(path, values, trace)
        if (result) {
          parts.push(result.rowIds)
          trace = result.trace
        }
      }
    }
    const range = this.#numberRangeRowIds(path, condition, trace)
    if (range) {
      parts.push(range.rowIds)
      trace = range.trace
    }
    if (condition.has) {
      const result = this.#compileFilter(condition.has as Filter, path, trace)
      if (result) {
        parts.push(result.rowIds)
        trace = result.trace
      }
    }
    if (condition.includes) {
      const result = this.#compileFilter(
        condition.includes as Filter,
        path,
        trace
      )
      if (result) {
        parts.push(result.rowIds)
        trace = result.trace
      }
    }
    if (parts.length === 0) return
    return {rowIds: parts.reduce(intersectRowIds), trace}
  }

  #exactRowIds(
    path: string,
    values: Array<string | number | boolean | null>,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} {
    const parts = values.map(value => {
      const key = `field:${path}:${rxbIndexValue(value)}`
      if (trace) trace = traceIndex(trace, key)
      return this.#cachedLeaf(key, () => {
        return (
          this.#payload.fieldIndexes.exact[path]?.[rxbIndexValue(value)] ?? []
        )
      })
    })
    return {rowIds: uniqueRowIds(parts.flat()), trace}
  }

  #entryFieldRowIds(
    path: string,
    field: keyof RxbEntryRow,
    condition: unknown,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} | undefined {
    const values = conditionValues(condition)
    if (!values) return
    if (trace) {
      for (const value of values)
        trace = traceIndex(trace, `field:${path}:${rxbIndexValue(value)}`)
    }
    if (field === 'id')
      return {
        rowIds: uniqueRowIds(
          values.flatMap(value =>
            this.#cachedLeaf(`index:id:${indexValue(value as any)}`, () => {
              return this.#payload.indexes.byId[indexValue(value as any)] ?? []
            })
          )
        ),
        trace
      }
    if (field === 'type')
      return {
        rowIds: uniqueRowIds(
          values.flatMap(value =>
            this.#cachedLeaf(`index:type:${indexValue(value as any)}`, () => {
              return this.#payload.indexes.byType[indexValue(value as any)] ?? []
            })
          )
        ),
        trace
      }
    if (field === 'status')
      return {rowIds: this.#statusRowIds(values), trace}
    if (field === 'active' || field === 'main')
      return {rowIds: this.#flagRowIds(field, values), trace}
    return {
      rowIds: uniqueRowIds(
        values.flatMap(value =>
          this.#cachedRowIds(
            `runtime:${String(field)}:${rxbIndexValue(value)}`,
            () => this.#entryFieldIndex(field).get(rxbIndexValue(value)) ?? []
          )
        )
      ),
      trace
    }
  }

  #numberRangeRowIds(
    path: string,
    condition: Record<string, unknown>,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} | undefined {
    const index = this.#numberIndex(path)
    if (!index) return
    const gt = typeof condition.gt === 'number' ? condition.gt : undefined
    const gte = typeof condition.gte === 'number' ? condition.gte : undefined
    const lt = typeof condition.lt === 'number' ? condition.lt : undefined
    const lte = typeof condition.lte === 'number' ? condition.lte : undefined
    if (
      gt === undefined &&
      gte === undefined &&
      lt === undefined &&
      lte === undefined
    )
      return
    if (trace) trace = traceIndex(trace, `field:${path}:range`)
    const start =
      gt !== undefined
        ? upperNumberBound(index, gt)
        : gte !== undefined
          ? lowerNumberBound(index, gte)
          : 0
    const end =
      lt !== undefined
        ? lowerNumberBound(index, lt)
        : lte !== undefined
          ? upperNumberBound(index, lte)
          : index.length
    return {
      rowIds: Array.from(index.slice(start, end), ([, rowId]) => rowId),
      trace
    }
  }

  #cachedLeaf(key: string, read: () => Array<number>): Array<string> {
    return this.#cachedRowIds(key, () => this.#rowIdsFromOrdinals(read()))
  }

  #cachedRowIds(key: string, read: () => Array<string>): Array<string> {
    const cached = this.#leafCache.get(key)
    if (cached) {
      this.#leafCache.delete(key)
      this.#leafCache.set(key, cached)
      return cached
    }
    const value = read()
    this.#leafCache.set(key, value)
    if (this.#leafCache.size > this.#leafCacheSize) {
      const first = this.#leafCache.keys().next().value
      if (first) this.#leafCache.delete(first)
    }
    return value
  }

  #statusRowIds(
    values: Array<string | number | boolean | null>
  ): Array<string> {
    return this.#cachedRowIds(`flag:status:${cacheValue(values)}`, () => {
      const expected = new Set(values.map(String))
      const flags = this.#flagsArray()
      const rowIds = this.#rowIdsArray()
      const result = Array<string>()
      for (let ordinal = 0; ordinal < rowIds.length; ordinal++) {
        if (expected.has(rxbEntryStatusFromFlags(flags[ordinal])))
          result.push(rowIds[ordinal])
      }
      return result
    })
  }

  #flagRowIds(
    field: 'active' | 'main',
    values: Array<string | number | boolean | null>
  ): Array<string> {
    return this.#cachedRowIds(`flag:${field}:${cacheValue(values)}`, () => {
      const expected = new Set(values.map(String))
      const flags = this.#flagsArray()
      const rowIds = this.#rowIdsArray()
      const result = Array<string>()
      const read = field === 'active' ? rxbEntryIsActive : rxbEntryIsMain
      for (let ordinal = 0; ordinal < rowIds.length; ordinal++) {
        if (expected.has(String(read(flags[ordinal]))))
          result.push(rowIds[ordinal])
      }
      return result
    })
  }

  #numberIndex(path: string): Array<[number, string]> | undefined {
    const cached = this.#numberCache.get(path)
    if (cached) return cached
    const index = this.#payload.fieldIndexes.number[path]
    if (!index) return
    const value = Array.from(
      index,
      ([score, ordinal]) => [score, this.#rowIdAt(ordinal)] as [number, string]
    )
    this.#numberCache.set(path, value)
    return value
  }

  #entryFieldIndex(field: keyof RxbEntryRow): Map<string, Array<string>> {
    const cached = this.#entryFieldIndexCache.get(field)
    if (cached) return cached
    const index = new Map<string, Array<string>>()
    for (const rowId of this.#rowIdsArray()) {
      const value = this.#fieldValue(rowId, field)
      if (!isPrimitiveIndexValue(value)) continue
      const key = rxbIndexValue(value)
      const rows = index.get(key) ?? []
      rows.push(rowId)
      index.set(key, rows)
    }
    this.#entryFieldIndexCache.set(field, index)
    return index
  }

  #rowIdAt(ordinal: number): string {
    return this.#rowIdsArray()[ordinal]
  }

  #rowIdsFromOrdinals(ordinals: ReadonlyArray<number>): Array<string> {
    return Array.from(ordinals, ordinal => this.#rowIdAt(ordinal))
  }

  #rowOrdinal(rowId: string): number | undefined {
    if (this.#rowOrdinals) return this.#rowOrdinals.get(rowId)
    const rowIds = this.#rowIdsArray()
    const ordinals = new Map<string, number>()
    for (let i = 0; i < rowIds.length; i++) {
      ordinals.set(rowIds[i], i)
    }
    this.#rowOrdinals = ordinals
    return ordinals.get(rowId)
  }

  #fieldValue(rowId: string, name: keyof RxbEntryRow): unknown {
    if (name === 'filePath') return rowId
    const ordinal = this.#rowOrdinal(rowId)
    if (ordinal === undefined) return undefined
    switch (name) {
      case 'id':
      case 'type':
      case 'index':
      case 'seeded':
      case 'parentId':
      case 'parents':
      case 'url':
        return this.#payload.columns.values[name][ordinal]
      case 'active':
        return rxbEntryIsActive(this.#flagAt(ordinal))
      case 'main':
        return rxbEntryIsMain(this.#flagAt(ordinal))
      case 'status':
      case 'versionStatus':
        return rxbEntryStatusFromFlags(this.#flagAt(ordinal))
      case 'workspace':
      case 'root':
      case 'locale':
      case 'path':
      case 'parentDir':
      case 'childrenDir':
      case 'level':
        return this.#rowInfo(rowId)[name]
      default:
        return this.row(rowId)?.[name]
    }
  }

  #rowMatchesIndex(
    rowId: string,
    name: string,
    expected: Set<string>
  ): boolean {
    switch (name) {
      case 'parent':
        return expected.has(String(this.#fieldValue(rowId, 'parentId')))
      default:
        return expected.has(String(this.#fieldValue(rowId, name as keyof RxbEntryRow)))
    }
  }

  #rowInfo(rowId: string): ReturnType<typeof rxbEntryInfoFromRowId> {
    const cached = this.#rowInfoCache.get(rowId)
    if (cached) return cached
    const value = rxbEntryInfoFromRowId(this.#config, rowId)
    this.#rowInfoCache.set(rowId, value)
    return value
  }

  #rowIdsArray(): Array<string> {
    return (this.#rowIds ??= Array.from(this.#payload.columns.rowIds))
  }

  #flagsArray(): Array<number> {
    return (this.#flags ??= Array.from(this.#payload.columns.flags))
  }

  #flagAt(ordinal: number): number {
    if (this.#flags) return this.#flags[ordinal]
    if (this.#cursor && this.#sparseFlagReads++ < 64) {
      const value = this.#cursor.flagAt(ordinal)
      if (value !== undefined) return value
    }
    return this.#flagsArray()[ordinal]
  }

  #fileHashAt(rowId: string): string {
    if (!this.#fileHashes) {
      this.#fileHashes = new Map(ReadonlyTree.fromFlat(this.#payload.tree).index())
    }
    return this.#fileHashes.get(rowId) ?? ''
  }

  #cachePlan(key: string, rowIds: Array<string>) {
    this.#planCache.set(key, rowIds)
    if (this.#planCache.size > this.#planCacheSize) {
      const first = this.#planCache.keys().next().value
      if (first) this.#planCache.delete(first)
    }
  }
}

function valuesOf<T extends string | number>(
  value: T | null | ReadonlyArray<T | null>
): Array<T | null> {
  if (Array.isArray(value)) return Array.from(value)
  return [value as T | null]
}

function conditionValues(
  condition: unknown
): Array<string | number | boolean | null> | undefined {
  if (isPrimitiveIndexValue(condition)) return [condition]
  if (!isRecord(condition)) return
  if (isPrimitiveIndexValue(condition.is)) return [condition.is]
  if (Array.isArray(condition.in)) {
    const values = condition.in.filter(isPrimitiveIndexValue)
    if (values.length > 0) return values
  }
}

function intersectRowIds(
  current: Array<string> | undefined,
  next: Array<string>
): Array<string> {
  if (!current) return next
  const allowed = new Set(next)
  return current.filter(rowId => allowed.has(rowId))
}

function uniqueRowIds(values: Array<string>): Array<string> {
  return Array.from(new Set(values))
}

function candidateCacheKey(plan: EntryQueryPlan): string | undefined {
  if (!plan.constraints && !(plan.query as {filter?: unknown}).filter) {
    return 'all'
  }
  const parts = Array<string>()
  if (plan.constraints) {
    for (const key of Object.keys(plan.constraints).sort()) {
      const value = plan.constraints[key as keyof EntryQueryConstraints]
      if (value === undefined) continue
      parts.push(`${key}=${cacheValue(value)}`)
    }
  }
  const filter = (plan.query as {filter?: unknown}).filter
  if (filter) parts.push(`filter=${JSON.stringify(filter)}`)
  return parts.join('\u0001')
}

function cacheValue(value: unknown): string {
  if (!Array.isArray(value)) return String(value)
  return value.map(String).sort().join('\u0000')
}

function lowerNumberBound(
  index: Array<[number, string]>,
  target: number
): number {
  let low = 0
  let high = index.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (index[mid][0] < target) low = mid + 1
    else high = mid
  }
  return low
}

function upperNumberBound(
  index: Array<[number, string]>,
  target: number
): number {
  let low = 0
  let high = index.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (index[mid][0] <= target) low = mid + 1
    else high = mid
  }
  return low
}

function canMatchIndexOnRow(name: string): boolean {
  return (
    name === 'id' ||
    name === 'type' ||
    name === 'workspace' ||
    name === 'root' ||
    name === 'locale' ||
    name === 'status' ||
    name === 'active' ||
    name === 'main' ||
    name === 'parent' ||
    name === 'path' ||
    name === 'url' ||
    name === 'level' ||
    name === 'filePath'
  )
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

function isOnlyKey<T extends string>(
  input: object,
  key: T
): input is Record<T, Array<Filter | undefined>> {
  const keys = Object.keys(input)
  return keys.length === 1 && keys[0] === key
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}

const ENTRY_FIELD_ALIASES: Record<string, keyof RxbEntryRow> = {
  _id: 'id',
  _type: 'type',
  _index: 'index',
  _workspace: 'workspace',
  _root: 'root',
  _status: 'status',
  _parentId: 'parentId',
  _locale: 'locale',
  _path: 'path',
  _url: 'url',
  _active: 'active'
}
