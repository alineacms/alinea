import type {Config} from '../Config.js'
import type {Entry} from '../Entry.js'
import {EntryFields} from '../EntryFields.js'
import type {Expr} from '../Expr.js'
import {Field} from '../Field.js'
import {
  type AnyQueryResult,
  type Edge,
  type EdgeQuery,
  type GraphQuery,
  type Projection,
  type QuerySettings,
  querySource as queryEdge,
  type Status
} from '../Graph.js'
import {
  getExpr,
  type HasExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from '../Internal.js'
import type {Resolver} from '../Resolver.js'
import {getScope, type Scope} from '../Scope.js'
import type {Type} from '../Type.js'
import {entries, fromEntries} from '../util/Objects.js'
import {unreachable} from '../util/Types.js'
import {createRecord} from '../EntryRecord.js'
import {compareStrings} from '../source/Utils.js'
import {assert} from '../util/Assert.js'
import {
  combineConditions,
  type EntryCondition,
  type EntryFilter,
  type EntryNode
} from '../db/EntryIndex.js'
import {EntryIndex} from './EntryIndex.js'
import {compileEntryFilter} from './EntryFilter.js'
import {groupEntries, unsupportedEntryGroupReason} from './EntryGroup.js'
import {orderEntries, unsupportedEntryOrderReason} from './EntryOrder.js'
import type {EntryQueryConstraints} from './EntryPlanner.js'
import {materializeEntry} from './EntryMaterializer.js'

type Interim = any

export interface PostContext {
  linkResolver: EngineLinkResolver
}

export class EntryResolver implements Resolver {
  index: EntryIndex
  #scope: Scope
  #lookups: SnapshotLookups | undefined

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
    const entryNodes = (nodes: Iterable<unknown>): Iterable<EntryNode> =>
      nodes as Iterable<EntryNode>
    switch (query.edge) {
      case 'parent': {
        return {
          nodes: entryNodes(
            entry.parentId ? [ctx.graph.byId(entry.parentId)!] : []
          ),
          language: lang => lang.locale === entry.locale
        }
      }
      case 'next': {
        const parent = entry.parentId
          ? ctx.graph.byId(entry.parentId)
          : undefined
        const [next] = Array.from(
          ctx.graph.filter({
            nodes: entryNodes(parent?.children() ?? []),
            node: node => node.index > entry.index,
            language: lang => lang.locale === entry.locale
          })
        ).sort((a, b) => compareStrings(a.index, b.index))
        const nodes = entryNodes(next ? [ctx.graph.byId(next.id)!] : [])
        return {nodes}
      }
      case 'previous': {
        const parent = entry.parentId
          ? ctx.graph.byId(entry.parentId)
          : undefined
        const [previous] = Array.from(
          ctx.graph.filter({
            nodes: entryNodes(parent?.children() ?? []),
            node: node => node.index < entry.index,
            language: lang => lang.locale === entry.locale
          })
        ).sort((a, b) => compareStrings(b.index, a.index))
        const nodes = entryNodes(previous ? [ctx.graph.byId(previous.id)!] : [])
        return {nodes}
      }
      case 'siblings': {
        const parent = entry.parentId
          ? ctx.graph.byId(entry.parentId)
          : undefined
        return {
          nodes: entryNodes(parent?.children() ?? []),
          node: node => query.includeSelf || node.id !== entry.id,
          language: lang => lang.locale === entry.locale
        }
      }
      case 'translations': {
        const self = ctx.graph.byId(entry.id)
        assert(self)
        return {
          nodes: entryNodes([self]),
          language: lang => query.includeSelf || lang.locale !== entry.locale
        }
      }
      case 'children': {
        const depth = query?.depth ?? 1
        return {
          entry: e => e.filePath.startsWith(entry.childrenDir),
          node: node =>
            node.level > entry.level && node.level <= entry.level + depth
        }
      }
      case 'parents': {
        const depth = query?.depth ?? Number.POSITIVE_INFINITY
        const ids = entry.parents.slice(-depth)
        const nodes = ids.map(id => ctx.graph.byId(id)!)
        return {
          nodes: entryNodes(nodes),
          language: lang => lang.locale === entry.locale
        }
      }
      case 'entryMultiple': {
        const fieldValue = this.field(entry, query.field)
        const ids: Array<string> = Array.isArray(fieldValue)
          ? fieldValue.map(item => item._entry).filter(Boolean)
          : []
        const nodes = ids.map(id => ctx.graph.byId(id)!).filter(Boolean)
        return {nodes: entryNodes(nodes)}
      }
      case 'entrySingle': {
        const fieldValue = this.field(entry, query.field) as {_entry: string}
        const entryId = fieldValue?._entry
        const node = ctx.graph.byId(entryId)
        return {nodes: entryNodes(node ? [node] : [])}
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
      compileEntryFilter(query.filter, (entry, name) => {
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

  query(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    preFilter?: EntryCondition
  ) {
    const fast = this.#fastQuery(ctx, query, preFilter)
    if (fast) return fast

    const edge = <EdgeQuery>query
    const {skip, take, orderBy, groupBy, search, count} = query
    const {ids, condition} = this.condition(ctx, edge)
    const filter: EntryCondition = {
      search: Array.isArray(search) ? search.join(' ') : search,
      node: node => (ids ? ids.includes(node.id) : true),
      entry: condition
    }
    let entries = Array.from(
      ctx.graph.filter(
        preFilter ? combineConditions(filter, preFilter) : filter
      )
    )
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
      entries.sort((a, b) => {
        for (const order of orders) {
          const expr = (order.asc ?? order.desc)!
          const valueA = this.expr(ctx, a, expr) as string | number
          const valueB = this.expr(ctx, b, expr) as string | number
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
      })
    } else if (edge.edge === 'parents') {
      entries.sort((a, b) => a.level - b.level)
    }
    if (skip) entries.splice(0, skip)
    if (take) entries.splice(take)
    const isSingle = this.isSingleResult(<EdgeQuery>query)
    const asEdge = (<any>query) as EdgeQuery<Projection>
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
      if (isSingle) {
        const entry = entries[0]
        if (results[0]) {
          const linkResolver = new EngineLinkResolver(this, ctx, entry.locale)
          await this.postRow({linkResolver}, results[0], asEdge)
        }
        return results[0] as any
      }
      if (results.length > 0) {
        await Promise.all(
          results
            .map((result, index) => {
              if (!result) return
              const linkResolver = new EngineLinkResolver(
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

  #fastQuery(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    preFilter?: EntryCondition
  ) {
    if (ctx.graph !== this.index.graph) return
    if (preFilter) return
    if (!this.#canFastQuery(query)) return
    const constraints = this.#constraints(query, ctx.status)
    if (!constraints && !query.count) return
    const plan = this.index.planner.candidates({query, constraints})
    const edge = query as EdgeQuery<Projection>
    const needsPostFilter = this.#needsPostFilter(query)
    const condition = needsPostFilter
      ? this.condition(ctx, edge).condition!
      : undefined
    const canCountRows =
      query.count && !needsPostFilter && !query.groupBy && !query.orderBy
    let rowIds = plan.rowIds
    let entries = canCountRows ? [] : this.#entriesForRows(rowIds)
    if (condition) entries = entries.filter(entry => condition(entry))
    if (query.groupBy && !Array.isArray(query.groupBy))
      entries = groupEntries(entries, query.groupBy)
    if (query.orderBy) orderEntries(entries, query.orderBy)
    if (query.skip) {
      if (canCountRows) rowIds = rowIds.slice(query.skip)
      else entries = entries.slice(query.skip)
    }
    if (query.take) {
      if (canCountRows) rowIds = rowIds.slice(0, query.take)
      else entries = entries.slice(0, query.take)
    }
    const isSingle = this.isSingleResult(query)
    const getSelected = () =>
      entries.map(entry => this.#fastSelect(ctx, entry, query))
    const getUnprocessed = () => {
      if (query.count) return canCountRows ? rowIds.length : entries.length
      const results = getSelected()
      return isSingle ? results[0] : results
    }
    const getProcessed = async () => getUnprocessed()
    return {
      entries,
      getUnprocessed,
      getProcessed
    }
  }

  #canFastQuery(query: GraphQuery<Projection>) {
    if (queryEdge(query)) return false
    if (query.search) return false
    if (query.include) return false
    if (query.orderBy && unsupportedEntryOrderReason(query.orderBy))
      return false
    if (query.groupBy && unsupportedEntryGroupReason(query.groupBy))
      return false
    const status = query.status
    if (
      status &&
      status !== 'published' &&
      status !== 'draft' &&
      status !== 'archived'
    )
      return false
    if (query.count) return true
    return this.#canFastProjection(query.select)
  }

  #canFastProjection(projection: Projection | undefined): boolean {
    if (!projection) return false
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      return expr.type === 'entryField' || expr.type === 'field'
    }
    if (!isObject(projection)) return false
    if (queryEdge(projection)) return false
    return Object.values(projection).every(value =>
      this.#canFastProjection(value as Projection)
    )
  }

  #fastSelect(
    ctx: ResolveContext,
    entry: Entry,
    query: GraphQuery<Projection>
  ): unknown {
    const projection = query.select
    if (!projection) return undefined
    return this.#fastProjection(ctx, entry, projection)
  }

  #fastProjection(
    ctx: ResolveContext,
    entry: Entry,
    projection: Projection
  ): unknown {
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      switch (expr.type) {
        case 'entryField':
          return entry[expr.name as keyof Entry]
        case 'field': {
          const name = this.#scope.nameOf(projection as any)
          if (!name) throw new Error(`Expression has no name ${projection}`)
          const value = entry.data[name]
          if (value && typeof value === 'object') return structuredClone(value)
          return value
        }
      }
    }
    return Object.fromEntries(
      Object.entries(projection as Record<string, Projection>).map(
        ([key, value]) => [key, this.#fastProjection(ctx, entry, value)]
      )
    )
  }

  #entriesForRows(rowIds: Array<string>): Array<Entry> {
    const rows = new Set(rowIds)
    const {versions, languages, nodes} = this.#snapshotLookups()
    return Array.from(rows)
      .map(rowId => {
        const version = versions.get(rowId)
        if (!version) return
        const language = languages.get(version.languageId)
        const node = nodes.get(version.nodeId)
        if (!language || !node) return
        return materializeEntry({version, language, node})
      })
      .filter((entry): entry is Entry => Boolean(entry))
  }

  #snapshotLookups(): SnapshotLookups {
    const snapshot = this.index.snapshot
    if (this.#lookups?.snapshot === snapshot) return this.#lookups
    return (this.#lookups = {
      snapshot,
      versions: new Map(snapshot.rows.versions.map(row => [row.rowId, row])),
      languages: new Map(
        snapshot.rows.languages.map(row => [row.languageId, row])
      ),
      nodes: new Map(snapshot.rows.nodes.map(row => [row.nodeId, row]))
    })
  }

  #constraints(
    query: GraphQuery<Projection>,
    defaultStatus?: Status
  ): EntryQueryConstraints | undefined {
    const constraints: EntryQueryConstraints = {}

    const ids = stringValues(query.id)
    if (ids) constraints.id = ids

    const parentIds = nullableStringValues(query.parentId)
    if (parentIds) constraints.parentId = parentIds

    const path = stringValues(query.path)
    if (path) constraints.path = path

    const url = stringValues(query.url)
    if (url) constraints.url = url

    const level = numberValues(query.level)
    if (level !== undefined) constraints.level = level

    const workspace = queryWorkspaceValue(query.workspace, this.#scope)
    if (workspace) constraints.workspace = workspace

    const root = queryRootValue(query.root, this.#scope)
    if (root) constraints.root = root

    const locale = nullableStringValues(query.locale)
    if (locale !== undefined) constraints.locale = locale

    const type = queryTypeValues(query.type, this.#scope)
    if (type) constraints.type = type

    const status = exactStatus(query.status ?? defaultStatus)
    if (status) constraints.status = status

    return Object.keys(constraints).length > 0 ? constraints : undefined
  }

  #needsPostFilter(query: GraphQuery<Projection>): boolean {
    if (query.filter || query.location || query.preferredLocale) return true
    if (query.id !== undefined && !stringValues(query.id)) return true
    if (query.parentId !== undefined && !nullableStringValues(query.parentId))
      return true
    if (query.path !== undefined && !stringValues(query.path)) return true
    if (query.url !== undefined && !stringValues(query.url)) return true
    if (query.level !== undefined && numberValues(query.level) === undefined)
      return true
    if (
      query.workspace !== undefined &&
      !queryWorkspaceValue(query.workspace, this.#scope)
    )
      return true
    if (query.root !== undefined && !queryRootValue(query.root, this.#scope))
      return true
    if (
      query.locale !== undefined &&
      nullableStringValues(query.locale) === undefined
    )
      return true
    if (query.type !== undefined && !queryTypeValues(query.type, this.#scope))
      return true
    return false
  }

  async postField(
    ctx: PostContext,
    interim: Interim,
    field: Field
  ): Promise<void> {
    const shape = Field.shape(field)
    await shape.applyLinks(interim, ctx.linkResolver as any)
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
  graph: EntryIndex['graph']
  searchTerms?: string
}

class EngineLinkResolver {
  constructor(
    public resolver: EntryResolver,
    private ctx: ResolveContext,
    private locale: string | null
  ) {}

  includedAtBuild(filePath: string): boolean {
    return this.resolver.index.initialSync?.has(filePath) ?? false
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ) {
    const {status, graph} = this.ctx
    const results = await this.resolver.resolve({
      graph,
      preferredLocale: this.locale ?? undefined,
      status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<unknown>
  }
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
      return () => true
  }
}

interface Check {
  (input: Entry): boolean
}

function isObject(input: any): input is object {
  return input && typeof input === 'object'
}

function stringValues(input: unknown): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isObject(input) && Array.isArray((input as {in?: unknown}).in)) {
    const values = (input as {in: Array<unknown>}).in.filter(
      value => typeof value === 'string'
    )
    if (values.length > 0) return values as Array<string>
  }
}

function numberValues(input: unknown): number | Array<number> | undefined {
  if (typeof input === 'number') return input
  if (isObject(input) && Array.isArray((input as {in?: unknown}).in)) {
    const values = (input as {in: Array<unknown>}).in.filter(
      value => typeof value === 'number'
    )
    if (values.length > 0) return values as Array<number>
  }
}

function nullableStringValues(
  input: unknown
): string | null | Array<string | null> | undefined {
  if (input === null || typeof input === 'string') return input
  if (isObject(input) && Array.isArray((input as {in?: unknown}).in)) {
    const values = (input as {in: Array<unknown>}).in.filter(
      value => value === null || typeof value === 'string'
    )
    if (values.length > 0) return values as Array<string | null>
  }
}

function queryWorkspaceValue(
  input: unknown,
  scope: Scope
): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isObject(input) && hasWorkspace(input)) {
    const name = scope.nameOf(input)
    if (name) return name
  }
}

function queryRootValue(
  input: unknown,
  scope: Scope
): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isObject(input) && hasRoot(input)) {
    const name = scope.nameOf(input)
    if (name) return name
  }
}

function queryTypeValues(
  input: unknown,
  scope: Scope
): string | Array<string> | undefined {
  if (!input) return
  const values = Array.isArray(input) ? input : [input]
  const names = values
    .map(value => (typeof value === 'string' ? value : scope.nameOf(value)))
    .filter((value): value is string => typeof value === 'string')
  if (names.length === 0) return
  return Array.isArray(input) ? names : names[0]
}

function exactStatus(status: Status | undefined) {
  switch (status) {
    case 'published':
    case 'draft':
    case 'archived':
      return status
  }
}

interface SnapshotLookups {
  snapshot: EntryIndex['snapshot']
  versions: Map<string, import('./EntryRows.js').EntryVersionRow>
  languages: Map<string, import('./EntryRows.js').EntryLanguageRow>
  nodes: Map<string, import('./EntryRows.js').EntryNodeRow>
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
  return compileEntryFilter({
    id: query.id,
    parentId: query.parentId,
    path: query.path,
    url: query.url,
    level: query.level,
    workspace,
    root
  })!
}

function typeChecker(type: Array<string> | string): Check {
  if (Array.isArray(type)) {
    return entry => type.includes(entry.type)
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
      return () => true
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
