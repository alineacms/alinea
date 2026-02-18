import type {Type} from 'alinea'
import type {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import {EntryFields} from 'alinea/core/EntryFields'
import type {Expr} from 'alinea/core/Expr'
import {Field} from 'alinea/core/Field'
import type {AnyCondition, Filter} from 'alinea/core/Filter'
import {
  type AnyQueryResult,
  type Edge,
  type EdgeQuery,
  type GraphQuery,
  type Projection,
  type QuerySettings,
  querySource as queryEdge,
  type Status
} from 'alinea/core/Graph'
import {
  getExpr,
  type HasExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from 'alinea/core/Internal'
import type {Resolver} from 'alinea/core/Resolver'
import {getScope, type Scope} from 'alinea/core/Scope'
import {hasExact} from 'alinea/core/util/Checks'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {unreachable} from 'alinea/core/util/Types'
import * as cito from 'cito'
import {createRecord} from '../EntryRecord.js'
import {compareStrings} from '../source/Utils.js'
import {assert} from '../util/Assert.js'
import {
  type EntryCondition,
  type EntryFilter,
  type EntryGraph,
  type EntryIndex,
  type EntryNode
} from './EntryIndex.js'
import {LinkResolver} from './LinkResolver.js'
import {QueryExecutor} from './entry-v2/Executor.js'
import {getEntryIndices} from './entry-v2/EntryIndices.js'
import {
  QueryPlanner,
  type QueryPlan
} from './entry-v2/Planner.js'

const orFilter = cito.object({or: cito.array(cito.any)}).and(hasExact(['or']))
const andFilter = cito
  .object({and: cito.array(cito.any)})
  .and(hasExact(['and']))

type Interim = any

export interface PostContext {
  linkResolver: LinkResolver
}

const planner = new QueryPlanner()
const executor = new QueryExecutor()

export class EntryResolver implements Resolver {
  index: EntryIndex
  #scope: Scope

  constructor(config: Config, index: EntryIndex) {
    this.#scope = getScope(config)
    this.index = index
  }

  call(
    ctx: ResolveContext,
    entry: Entry,
    internal: {method: string; args: Array<Expr>}
  ): unknown {
    switch (internal.method) {
      case 'snippet': {
        if (!ctx.searchTerms)
          throw new Error('Snippet method requires search terms to be provided')
        const start = this.expr(ctx, entry, internal.args[0])
        const end = this.expr(ctx, entry, internal.args[1])
        const cutOff = this.expr(ctx, entry, internal.args[2])
        const limit = this.expr(ctx, entry, internal.args[3])
        return snippet(
          entry.searchableText,
          ctx.searchTerms,
          start as string,
          end as string,
          cutOff as string,
          limit as number
        )
      }
      default:
        throw new Error(`Unknown method: "${internal.method}"`)
    }
  }

  field(entry: Entry, field: Expr): unknown {
    const name = this.#scope.nameOf(field)
    if (!name) throw new Error(`Expression has no name ${field}`)
    /*const isEntryField = name === 'path' || name === 'title'
    if (isEntryField) return entry[name]*/
    return entry.data[name]
  }

  expr(ctx: ResolveContext, entry: Entry, expr: Expr): unknown {
    const internal = getExpr(expr)
    switch (internal.type) {
      case 'field': {
        const result = this.field(entry, expr)
        if (result && typeof result === 'object') {
          return structuredClone(result)
        }
        return result
      }
      case 'entryField':
        return entry[internal.name as keyof Entry]
      case 'call':
        return this.call(ctx, entry, internal)
      case 'value':
        return internal.value
      default:
        unreachable(internal)
    }
  }

  projectTypes(types: Array<Type>): Array<[string, Expr]> {
    return entries(EntryFields as Projection).concat(types.flatMap(entries))
  }

  projection(query: GraphQuery<Projection>): Projection {
    return (
      query.select ??
      fromEntries(
        (query.type
          ? this.projectTypes(
              Array.isArray(query.type) ? query.type : [query.type]
            )
          : []
        )
          .concat(entries(EntryFields))
          .concat(query.include ? entries(query.include) : [])
      )
    )
  }

  sourceFilter(
    ctx: ResolveContext,
    entry: Entry,
    query: EdgeQuery
  ): EntryCondition {
    switch (query.edge) {
      case 'parent': {
        return {
          nodes: entry.parentId ? [ctx.graph.byId(entry.parentId)!] : [],
          language: lang => lang.locale === entry.locale
        }
      }
      case 'next': {
        const parent = entry.parentId
          ? ctx.graph.byId(entry.parentId)
          : undefined
        let next: EntryNode | undefined
        for (const candidate of parent?.children() ?? []) {
          if (!candidate.has(entry.locale)) continue
          if (compareStrings(candidate.index, entry.index) <= 0) continue
          if (!next || compareStrings(candidate.index, next.index) < 0) {
            next = candidate
          }
        }
        const nodes: Array<EntryNode> = next ? [next] : []
        return {nodes, language: lang => lang.locale === entry.locale}
      }
      case 'previous': {
        const parent = entry.parentId
          ? ctx.graph.byId(entry.parentId)
          : undefined
        let previous: EntryNode | undefined
        for (const candidate of parent?.children() ?? []) {
          if (!candidate.has(entry.locale)) continue
          if (compareStrings(candidate.index, entry.index) >= 0) continue
          if (
            !previous ||
            compareStrings(candidate.index, previous.index) > 0
          ) {
            previous = candidate
          }
        }
        const nodes: Array<EntryNode> = previous
          ? [previous]
          : []
        return {nodes, language: lang => lang.locale === entry.locale}
      }
      case 'siblings': {
        const parent = entry.parentId
          ? ctx.graph.byId(entry.parentId)
          : undefined
        return {
          nodes: parent?.children() ?? [],
          node: node => query.includeSelf || node.id !== entry.id,
          language: lang => lang.locale === entry.locale
        }
      }
      case 'translations': {
        const self = ctx.graph.byId(entry.id)
        assert(self)
        return {
          nodes: [self],
          language: lang => query.includeSelf || lang.locale !== entry.locale
        }
      }
      case 'children': {
        const depth = query?.depth ?? 1
        const self = ctx.graph.byId(entry.id)
        if (!self) return {nodes: []}
        const nodes: Array<EntryNode> = []
        let frontier: Array<EntryNode> = [self]
        for (let level = 0; level < depth; level++) {
          const nextFrontier: Array<EntryNode> = []
          for (const parent of frontier) {
            for (const child of parent.children()) {
              nodes.push(child)
              nextFrontier.push(child)
            }
          }
          if (nextFrontier.length === 0) break
          frontier = nextFrontier
        }
        return {
          nodes,
          language: lang => lang.locale === entry.locale
        }
      }
      case 'parents': {
        const depth = query?.depth ?? Number.POSITIVE_INFINITY
        const ids = entry.parents.slice(-depth)
        const nodes = ids.map(id => ctx.graph.byId(id)!)
        return {nodes, language: lang => lang.locale === entry.locale}
      }
      case 'entryMultiple': {
        const fieldValue = this.field(entry, query.field)
        const ids: Array<string> = Array.isArray(fieldValue)
          ? fieldValue.map(item => item._entry).filter(Boolean)
          : []
        const nodes = ids.map(id => ctx.graph.byId(id)!).filter(Boolean)
        return {nodes}
      }
      case 'entrySingle': {
        const fieldValue = this.field(entry, query.field) as {_entry: string}
        const entryId = fieldValue?._entry
        const node = ctx.graph.byId(entryId)
        return {nodes: node ? [node] : []}
      }
      default:
        return {}
    }
  }

  selectProjection(
    ctx: ResolveContext,
    entry: Entry,
    value: Projection
  ): unknown {
    if (value && hasExpr(value)) return this.expr(ctx, entry, value as Expr)
    const source = queryEdge(value)
    if (!source)
      return fromEntries(
        entries(value).map(([key, value]) => {
          return [key, this.selectProjection(ctx, entry, value as Projection)]
        })
      )
    const related = value as object as EdgeQuery<Projection>
    return this.query(
      {...ctx, locale: entry.locale},
      related,
      this.sourceFilter(ctx, entry, related)
    ).getUnprocessed()
  }

  select(
    ctx: ResolveContext,
    entry: Entry | null,
    query: GraphQuery<Projection>
  ): unknown {
    if (!entry) return null
    if (query.select && hasExpr(query.select))
      return this.expr(ctx, entry, query.select as Expr)
    const fields = this.projection(query)
    return this.selectProjection(ctx, entry, fields)
  }

  condition(ctx: ResolveContext, query: EdgeQuery): EntryFilter {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && this.#scope.locationOf(query.location)
    const checkStatus = statusChecker(ctx.status)
    const checkLocation = location && locationChecker(location)
    const locale = query.locale ?? ctx.locale
    let checkLocale =
      locale !== undefined &&
      query.edge !== 'translations' &&
      localeChecker(
        typeof locale === 'string' ? locale.toLowerCase() : null,
        false
      )
    if (!checkLocale && query.preferredLocale)
      checkLocale = localeChecker(query.preferredLocale.toLowerCase(), true)
    const checkType =
      Boolean(query.type) &&
      typeChecker(
        Array.isArray(query.type)
          ? query.type.map(type => this.#scope.nameOf(type)!)
          : this.#scope.nameOf(query.type as any)!
      )
    const source = queryEdge(query)
    const checkEntry = entryChecker(this.#scope, query)
    const checkFilter =
      query.filter &&
      filterChecker(query.filter, (entry, name) => {
        if (name.startsWith('_')) return entry[name.slice(1)]
        return entry.data[name]
      })
    const multipleIds =
      typeof query.id === 'object' && query.id !== null && query.id.in
    const ids = Array.isArray(multipleIds)
      ? multipleIds
      : typeof query.id === 'string'
        ? [query.id]
        : undefined
    return {
      ids,
      condition(entry: Entry) {
        if (!checkStatus(entry)) return false
        if (checkLocation && !checkLocation(entry)) return false
        if (checkType && !checkType(entry)) return false
        const matchesLocale = checkLocale ? checkLocale(entry) : true
        if (source !== 'translations' && !matchesLocale) return false
        if (checkEntry && !checkEntry(entry)) return false
        if (checkFilter && !checkFilter(entry)) return false
        return true
      }
    }
  }

  isSingleResult(query: GraphQuery & Partial<Edge>): boolean {
    return Boolean(
      query.first ||
        query.get ||
        query.count ||
        query.edge === 'parent' ||
        query.edge === 'next' ||
        query.edge === 'previous'
    )
  }

  plan(
    ctx: ResolveContext,
    query: EdgeQuery,
    preFilter?: EntryCondition
  ): QueryPlan {
    const search = Array.isArray(query.search) ? query.search.join(' ') : query.search
    const {ids, condition} = this.condition(ctx, query)
    const indices = getEntryIndices(ctx.graph)
    return planner.plan(indices, {
      ids,
      search,
      preFilter,
      entry(entry) {
        return condition(entry)
      }
    })
  }

  *executePlan(
    ctx: ResolveContext,
    plan: QueryPlan,
    preFilter?: EntryCondition
  ): Generator<Entry> {
    const indices = getEntryIndices(ctx.graph)
    yield* executor.execute(ctx.graph, indices, plan, preFilter)
  }

  query(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    preFilter?: EntryCondition
  ) {
    const edge = <EdgeQuery>query
    const {skip, take, orderBy, groupBy, search, count} = query
    const plan = this.plan(ctx, edge, preFilter)
    if (count) {
      let total = 0
      if (groupBy) {
        assert(!Array.isArray(groupBy), 'groupBy must be a single field')
        const groups = new Map<unknown, true>()
        for (const entry of this.executePlan(ctx, plan, preFilter)) {
          const value = this.expr(ctx, entry, groupBy)
          groups.set(value, true)
        }
        total = groups.size
      } else {
        for (const _entry of this.executePlan(ctx, plan, preFilter)) total++
      }
      const skipped = Math.max(0, total - (skip ?? 0))
      const bounded = take !== undefined ? Math.min(skipped, take) : skipped
      return {
        entries: [],
        getUnprocessed() {
          return bounded
        },
        async getProcessed() {
          return bounded
        }
      }
    }
    let entries = Array.from(this.executePlan(ctx, plan, preFilter))
    if (groupBy) {
      assert(!Array.isArray(groupBy), 'groupBy must be a single field')
      const groups = new Map<unknown, Entry>()
      for (const entry of entries) {
        const value = this.expr(ctx, entry, groupBy)
        if (!groups.has(value)) groups.set(value, entry)
      }
      entries = Array.from(groups.values())
    }
    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
      const compare = (
        a: {values: Array<unknown>},
        b: {values: Array<unknown>}
      ) => {
        for (let i = 0; i < orders.length; i++) {
          const order = orders[i]
          const valueA = a.values[i] as string | number
          const valueB = b.values[i] as string | number
          const strings =
            typeof valueA === 'string' && typeof valueB === 'string'
          const numbers =
            typeof valueA === 'number' && typeof valueB === 'number'
          if (strings) {
            const compare = order.caseSensitive
              ? compareStrings(valueA, valueB)
              : valueA.localeCompare(valueB, undefined, {numeric: true})
            if (compare !== 0) return order.asc ? compare : -compare
          } else if (numbers) {
            if (valueA !== valueB)
              return order.asc ? valueA - valueB : valueB - valueA
          }
        }
        return 0
      }
      const decorated = entries.map(entry => ({
        entry,
        values: orders.map(order => this.expr(ctx, entry, (order.asc ?? order.desc)!))
      }))
      const partialLimit =
        take !== undefined ? Math.max(0, (skip ?? 0) + take) : undefined
      if (
        partialLimit !== undefined &&
        partialLimit > 0 &&
        partialLimit < decorated.length
      ) {
        const best = Array<{entry: Entry; values: Array<unknown>}>()
        const swap = (i: number, j: number) => {
          const tmp = best[i]
          best[i] = best[j]
          best[j] = tmp
        }
        const heapifyUp = (index: number) => {
          let current = index
          while (current > 0) {
            const parent = Math.floor((current - 1) / 2)
            if (compare(best[current], best[parent]) <= 0) break
            swap(current, parent)
            current = parent
          }
        }
        const heapifyDown = (index: number) => {
          let current = index
          while (true) {
            const left = current * 2 + 1
            const right = left + 1
            let largest = current
            if (left < best.length && compare(best[left], best[largest]) > 0) {
              largest = left
            }
            if (right < best.length && compare(best[right], best[largest]) > 0) {
              largest = right
            }
            if (largest === current) break
            swap(current, largest)
            current = largest
          }
        }
        for (const row of decorated) {
          if (best.length < partialLimit) {
            best.push(row)
            heapifyUp(best.length - 1)
            continue
          }
          if (compare(row, best[0]) >= 0) continue
          best[0] = row
          heapifyDown(0)
        }
        entries = best.sort(compare).map(item => item.entry)
      } else {
        entries = decorated.sort(compare).map(item => item.entry)
      }
    } else if (edge.edge === 'parents') {
      entries.sort((a, b) => a.level - b.level)
    }
    if (skip) entries.splice(0, skip)
    if (take) entries.splice(take)
    const isSingle = this.isSingleResult(<EdgeQuery>query)
    const asEdge = (<any>query) as EdgeQuery<Projection>
    const selectedExpr =
      query.select && hasExpr(query.select) ? (query.select as HasExpr) : null
    const needsPostProcessing = selectedExpr ? hasField(selectedExpr) : true
    const getSelected = () =>
      entries.map(entry => this.select(ctx, entry, query))
    const getUnprocessed = () => {
      if (count) return entries.length
      const results = getSelected()
      if (isSingle) return results[0]
      return results
    }
    const getProcessed = async () => {
      if (count) return entries.length
      const results = getSelected()
      if (!needsPostProcessing) {
        if (isSingle) return results[0] as any
        return results as any
      }
      if (isSingle) {
        const entry = entries[0]
        if (results[0]) {
          const linkResolver = new LinkResolver(this, ctx, entry.locale)
          await this.postRow({linkResolver}, results[0], asEdge)
        }
        return results[0] as any
      }
      if (results.length > 0) {
        await Promise.all(
          results
            .map((result, index) => {
              if (!result) return
              const linkResolver = new LinkResolver(
                this,
                ctx,
                entries[index].locale
              )
              return this.postRow({linkResolver}, result, asEdge)
            })
            .filter(Boolean)
        )
      }
      return results as any
    }
    return {
      entries,
      getUnprocessed,
      getProcessed
    }
  }

  async postField(
    ctx: PostContext,
    interim: Interim,
    field: Field
  ): Promise<void> {
    const shape = Field.shape(field)
    await shape.applyLinks(interim, ctx.linkResolver)
  }

  async postExpr(
    ctx: PostContext,
    interim: Interim,
    expr: HasExpr
  ): Promise<void> {
    if (hasField(expr)) await this.postField(ctx, interim, expr as any)
  }

  async postRow(
    ctx: PostContext,
    interim: Interim,
    query: GraphQuery<Projection>
  ): Promise<void> {
    if (!interim) return
    const selected = this.projection(query)
    if (hasExpr(selected)) return this.postExpr(ctx, interim, selected)
    if (queryEdge(selected))
      return this.post(ctx, interim, selected as EdgeQuery<Projection>)
    await Promise.all(
      entries(selected).map(([key, value]) => {
        const source = queryEdge(value)
        if (source)
          return this.post(ctx, interim[key], value as EdgeQuery<Projection>)
        return this.postExpr(ctx, interim[key], value as Expr)
      })
    )
  }

  async post(
    ctx: PostContext,
    interim: Interim,
    input: EdgeQuery<Projection>
  ): Promise<void> {
    if (input.count === true) return
    const isSingle = this.isSingleResult(input)
    if (isSingle) return this.postRow(ctx, interim, input)
    await Promise.all(interim.map((row: any) => this.postRow(ctx, row, input)))
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const {preview} = query
    const previewEntry =
      preview && 'entry' in preview ? preview.entry : undefined
    let graph = this.index.graph
    if (previewEntry)
      graph = graph.withChanges({
        fromSha: this.index.tree.sha,
        changes: [
          {
            op: 'add',
            path: previewEntry.filePath,
            sha: previewEntry.fileHash,
            contents: new TextEncoder().encode(
              JSON.stringify(
                createRecord(previewEntry, previewEntry.status),
                null,
                2
              )
            )
          }
        ]
      })
    const ctx: ResolveContext = {
      status: query.status ?? 'published',
      locale: query.locale,
      graph: graph,
      searchTerms: Array.isArray(query.search)
        ? query.search.join(' ')
        : query.search
    }
    return this.query(ctx, query as GraphQuery<Projection>).getProcessed()
  }
}

export interface ResolveContext {
  //entries: Array<Entry>
  status: Status
  locale?: string | null
  graph: EntryGraph
  searchTerms?: string
}

export function statusChecker(status: Status): Check {
  switch (status) {
    case 'published':
      return entry => entry.status === 'published'
    case 'draft':
      return entry => entry.status === 'draft'
    case 'archived':
      return entry => entry.status === 'archived'
    case 'preferDraft':
      return entry => entry.active
    case 'preferPublished':
      return entry => entry.main
    case 'all':
      return entry => true
  }
}

interface Check {
  (input: Entry): boolean
}

function isObject(input: any): input is object {
  return input && typeof input === 'object'
}

function entryChecker(scope: Scope, query: QuerySettings): Check {
  const root =
    isObject(query.root) && hasRoot(query.root)
      ? scope.nameOf(query.root)
      : query.root
  const workspace =
    isObject(query.workspace) && hasWorkspace(query.workspace)
      ? scope.nameOf(query.workspace)
      : query.workspace
  return filterChecker({
    id: query.id,
    parentId: query.parentId,
    path: query.path,
    url: query.url,
    level: query.level,
    workspace,
    root
  })
}

function typeChecker(type: Array<string> | string): Check {
  if (Array.isArray(type)) {
    const typeSet = new Set(type)
    return entry => typeSet.has(entry.type)
  }
  return entry => entry.type === type
}

function locationChecker(location: Array<string>): Check {
  switch (location.length) {
    case 1:
      return entry => entry.workspace === location[0]
    case 2:
      return entry =>
        entry.workspace === location[0] && entry.root === location[1]
    case 3: {
      return entry => {
        if (entry.workspace !== location[0]) return false
        if (entry.root !== location[1]) return false
        if (entry.level === 0) return false
        if (entry.level === 1)
          return entry.parentDir.endsWith(`/${location[2]}`)
        const segment = entry.parentDir.split('/').at(-entry.level)
        return segment === location[2]
      }
    }
    default:
      return entry => true
  }
}

function localeChecker(locale: string | null, preferred: boolean): Check {
  return (entry: Entry) => {
    if (preferred && entry.locale === null) return true
    if (typeof entry.locale === 'string')
      return entry.locale.toLowerCase() === locale
    return entry.locale === locale
  }
}

function filterChecker(
  filter: Filter,
  getField = (input: any, name: string) => input[name]
): Check {
  const isOrFilter = orFilter.check(filter)
  if (isOrFilter) {
    const or = filter.or.filter(Boolean).map(op => filterChecker(op, getField))
    return input => {
      for (const fn of or) if (fn(input)) return true
      return false
    }
  }
  const isAndFilter = andFilter.check(filter)
  if (isAndFilter) {
    const and = filter.and
      .filter(Boolean)
      .map(op => filterChecker(op, getField))
    return input => {
      for (const fn of and) if (!fn(input)) return false
      return true
    }
  }
  if (typeof filter !== 'object' || filter === null) {
    return input => input === filter
  }
  const conditions = createConditions(filter, getField)
  return input => {
    for (const condition of conditions) if (!condition(input)) return false
    return true
  }
}

function createConditions(
  ops: AnyCondition<any>,
  getField: (input: any, name: string) => any
): Array<Check> {
  const conditions = Array<Check>()
  for (const [name, op] of entries(ops)) {
    if (op === undefined) continue
    if (typeof op !== 'object' || op === null) {
      conditions.push(input => getField(input, name) === op)
      continue
    }
    const inner = op as AnyCondition<any>
    if (inner.is !== undefined)
      conditions.push(input => getField(input, name) === inner.is)
    if (inner.isNot !== undefined)
      conditions.push(input => getField(input, name) !== inner.isNot)
    const inOp = inner.in
    if (Array.isArray(inOp)) {
      const inSet = new Set(inOp)
      conditions.push(input => input && inSet.has(getField(input, name)))
    }
    const notInOp = inner.notIn
    if (Array.isArray(notInOp)) {
      const notInSet = new Set(notInOp)
      conditions.push(
        input => input && !notInSet.has(getField(input, name))
      )
    }
    if (inner.gt !== undefined)
      conditions.push(input => getField(input, name) > inner.gt)
    if (inner.gte !== undefined)
      conditions.push(input => getField(input, name) >= inner.gte)
    if (inner.lt !== undefined)
      conditions.push(input => getField(input, name) < inner.lt)
    if (inner.lte !== undefined)
      conditions.push(input => getField(input, name) <= inner.lte)
    if (inner.startsWith)
      conditions.push(input => {
        const field = getField(input, name)
        return (
          typeof field === 'string' &&
          field.startsWith(inner.startsWith as string)
        )
      })
    const orOp = inner.or
    if (orOp) {
      const inner = Array.isArray(orOp)
        ? orOp.flatMap(op => createConditions(op, getField))
        : createConditions(orOp, getField)
      conditions.push(input => {
        for (const condition of inner) if (condition(input)) return true
        return false
      })
    }
    if (inner.has) {
      const has = filterChecker(inner.has)
      conditions.push(input => has(getField(input, name)))
    }
    if (inner.includes) {
      const includes = filterChecker(inner.includes)
      conditions.push(input => {
        const field = getField(input, name)
        if (!Array.isArray(field)) return false
        for (const item of field) if (includes(item)) return true
        return false
      })
    }
  }
  return conditions
}

function snippet(
  body: string,
  searchTerms: string,
  start: string,
  end: string,
  cutOff: string,
  limit: number
): string {
  if (limit <= 0 || limit > 64)
    throw new Error(
      "The 'limit' parameter must be greater than zero and less than or equal to 64."
    )
  const terms = searchTerms
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term !== '')
  const words = body.split(/\s+/)
  const highlightedWords = Array<string>()
  let firstMatchIndex = -1

  for (let i = 0; i < words.length; i++) {
    const lowerCaseWord = words[i].toLowerCase()
    const isMatch = terms.some(term => lowerCaseWord.includes(term))
    if (isMatch && firstMatchIndex === -1) firstMatchIndex = i
    if (isMatch) highlightedWords.push(`${start}${words[i]}${end}`)
    else highlightedWords.push(words[i])
  }

  if (firstMatchIndex === -1)
    return words.slice(0, Math.min(limit, words.length)).join(' ')
  const idealStartIndex = Math.max(0, firstMatchIndex - Math.floor(limit / 2))
  const snippetResultWords = highlightedWords.slice(
    idealStartIndex,
    idealStartIndex + limit
  )
  let snippetResult = snippetResultWords.join(' ')
  if (idealStartIndex > 0) snippetResult = `${cutOff}${snippetResult}`
  if (idealStartIndex + limit < highlightedWords.length)
    snippetResult = `${snippetResult}${cutOff}`
  return snippetResult
}
