import type {Filter} from '../Filter.js'
import type {GraphQuery} from '../Graph.js'
import type {EntryStatus} from '../Entry.js'
import type {QueryTrace} from './QueryTrace.js'
import {indexKey, indexValue} from './RxbEntryArtifact.js'
import {createQueryTrace, emptyQueryTrace, traceIndex} from './QueryTrace.js'
import type {
  RxbEntryArtifact,
  RxbEntryPayload,
  RxbEntryRow
} from './RxbEntryArtifact.js'
import {rxbIndexValue} from './RxbEntryArtifact.js'
import type {RxbEntryCursorStore} from './RxbEntryCursorStore.js'

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
  cursorStore?: RxbEntryCursorStore
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
}

export class RxbEntryPlanner {
  readonly #payload: RxbEntryPayload
  readonly #cursor: RxbEntryCursorStore | undefined
  readonly #graphSha: string
  readonly #leafCacheSize: number
  readonly #planCacheSize: number
  readonly #rowCacheSize: number
  readonly #leafCache = new Map<string, Array<string>>()
  readonly #numberCache = new Map<string, Array<[number, string]>>()
  readonly #planCache = new Map<string, Array<string>>()
  readonly #rowCache = new Map<string, RxbEntryRow>()

  constructor(
    artifact: RxbEntryArtifact,
    options: RxbEntryPlannerOptions = {}
  ) {
    this.#payload = artifact.payload
    this.#cursor = options.cursorStore
    this.#graphSha = artifact.meta.graphSha
    this.#leafCacheSize = options.leafCacheSize ?? 256
    this.#planCacheSize = options.planCacheSize ?? 256
    this.#rowCacheSize = options.rowCacheSize ?? 4096
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
      !options.trace && !plan.preFilter ? JSON.stringify(plan) : undefined
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
        candidates = candidates.filter(rowId =>
          rowMatchesIndex(this.row(rowId), name, values)
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
      const rowIds = Array.from(plan.preFilter.nodeIds).flatMap(
        nodeId => this.#payload.indexes.byNode[nodeId] ?? []
      )
      candidates = intersectRowIds(candidates, rowIds)
    }
    if (plan.preFilter?.indexKeys && trace) {
      for (const key of plan.preFilter.indexKeys) trace = traceIndex(trace, key)
    }

    const rowIds = candidates ?? Object.keys(this.#payload.rowsById)
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

  row(rowId: string): RxbEntryRow {
    const cached = this.#rowCache.get(rowId)
    if (cached) {
      this.#rowCache.delete(rowId)
      this.#rowCache.set(rowId, cached)
      return cached
    }
    const row = this.#payload.rowsById[rowId]
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
    return rowIds.map(rowId => this.row(rowId)).filter(Boolean)
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
    if (constraints.workspace)
      yield this.#fromIndex(
        'workspace',
        valuesOf(constraints.workspace),
        this.#payload.indexes.byWorkspace
      )
    if (constraints.root)
      yield this.#fromIndex(
        'root',
        valuesOf(constraints.root),
        this.#payload.indexes.byRoot
      )
    if (constraints.locale !== undefined)
      yield this.#fromIndex(
        'locale',
        valuesOf(constraints.locale),
        this.#payload.indexes.byLocale
      )
    if (constraints.status)
      yield this.#fromIndex(
        'status',
        valuesOf(constraints.status),
        this.#payload.indexes.byStatus
      )
    if (constraints.active)
      yield [
        'active',
        ['true'],
        this.#cursor?.activeRowIds() ??
          this.#cachedLeaf(
            'index:active:true',
            () => this.#payload.indexes.byActive
          )
      ]
    if (constraints.main)
      yield [
        'main',
        ['true'],
        this.#cursor?.mainRowIds() ??
          this.#cachedLeaf(
            'index:main:true',
            () => this.#payload.indexes.byMain
          )
      ]
    if (constraints.parentId !== undefined)
      yield this.#fromIndex(
        'parent',
        valuesOf(constraints.parentId),
        this.#payload.indexes.byParent
      )
    if (constraints.path)
      yield this.#fromIndex(
        'path',
        valuesOf(constraints.path),
        this.#payload.indexes.byPath
      )
    if (constraints.url)
      yield this.#fromIndex(
        'url',
        valuesOf(constraints.url),
        this.#payload.indexes.byUrl
      )
    if (constraints.level !== undefined)
      yield this.#fromIndex(
        'level',
        valuesOf(constraints.level).map(String),
        this.#payload.indexes.byLevel
      )
    if (constraints.filePath) {
      const values = valuesOf(constraints.filePath)
      yield [
        'filePath',
        values,
        values.flatMap(value => {
          const rowId = this.#payload.indexes.byFilePath[indexValue(value)]
          return rowId ? [rowId] : []
        })
      ]
    }
    if (constraints.dir) {
      const values = valuesOf(constraints.dir)
      const nodeIds = values
        .map(value => this.#payload.indexes.byDir[indexValue(value)])
        .filter(Boolean)
      yield [
        'dir',
        values,
        uniqueRowIds(
          nodeIds.flatMap(nodeId => this.#payload.indexes.byNode[nodeId] ?? [])
        )
      ]
    }
  }

  #fromIndex(
    name: string,
    values: Array<string | number | boolean | null>,
    index: Record<string, Array<string>>
  ): [
    name: string,
    values: Array<string | number | boolean | null>,
    rowIds: Array<string>
  ] {
    if (this.#cursor) {
      return [name, values, this.#cursor.indexRowIds(name, values)]
    }
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
      if (this.#cursor) return this.#cursor.fieldExactRowIds(path, [value])
      return this.#cachedLeaf(key, () => {
        return (
          this.#payload.fieldIndexes.exact[path]?.[rxbIndexValue(value)] ?? []
        )
      })
    })
    return {rowIds: uniqueRowIds(parts.flat()), trace}
  }

  #numberRangeRowIds(
    path: string,
    condition: Record<string, unknown>,
    trace: ReturnType<typeof emptyQueryTrace> | undefined
  ): {rowIds: Array<string>; trace: typeof trace} | undefined {
    if (this.#cursor) {
      const rowIds = this.#cursor.fieldNumberRangeRowIds(path, condition)
      if (!rowIds) return
      if (trace) trace = traceIndex(trace, `field:${path}:range`)
      return {rowIds, trace}
    }
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

  #cachedLeaf(key: string, read: () => Array<string>): Array<string> {
    const cached = this.#leafCache.get(key)
    if (cached) {
      this.#leafCache.delete(key)
      this.#leafCache.set(key, cached)
      return cached
    }
    const value = Array.from(read())
    this.#leafCache.set(key, value)
    if (this.#leafCache.size > this.#leafCacheSize) {
      const first = this.#leafCache.keys().next().value
      if (first) this.#leafCache.delete(first)
    }
    return value
  }

  #numberIndex(path: string): Array<[number, string]> | undefined {
    const cached = this.#numberCache.get(path)
    if (cached) return cached
    const index = this.#payload.fieldIndexes.number[path]
    if (!index) return
    const value = Array.from(index)
    this.#numberCache.set(path, value)
    return value
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

function rowMatchesIndex(
  row: RxbEntryRow | undefined,
  name: string,
  values: ReadonlyArray<string | number | boolean | null>
): boolean {
  if (!row) return false
  const expected = new Set(values.map(value => String(value)))
  switch (name) {
    case 'parent':
      return expected.has(String(row.parentId))
    case 'active':
      return row.active
    case 'main':
      return row.main
    case 'level':
      return expected.has(String(row.level))
    case 'locale':
      return expected.has(String(row.locale))
    default:
      return expected.has(String(row[name as keyof RxbEntryRow]))
  }
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
