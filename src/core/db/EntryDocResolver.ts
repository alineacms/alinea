import type {Config} from '../Config.js'
import type {Entry} from '../Entry.js'
import type {Expr} from '../Expr.js'
import {Field, type FieldOptions} from '../Field.js'
import type {Filter} from '../Filter.js'
import {
  type AnyQueryResult,
  type EdgeQuery,
  type GraphQuery,
  type InferProjection,
  type Order,
  type Projection,
  type Status,
  querySource
} from '../Graph.js'
import {
  getExpr,
  getField,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from '../Internal.js'
import type {Resolver} from '../Resolver.js'
import {getScope, type Scope} from '../Scope.js'
import {compareStrings} from '../source/Utils.js'
import {assert} from '../util/Assert.js'
import {entries, fromEntries} from '../util/Objects.js'
import {unreachable} from '../util/Types.js'
import type {
  Doc,
  DocCondition,
  DocFieldCondition,
  DocOrder
} from '../docdb/DocDB.js'
import {
  entryData,
  type EntryDocQuery,
  type EntryDocReadCache,
  type EntryDocIndex
} from './EntryDocIndex.js'
import type {LinkResolver} from './LinkResolver.js'

interface ResolveContext {
  status: Status
  locale?: string | null
  searchTerms?: string
  cache: EntryDocReadCache
}

interface EntryFieldQuery {
  id?: unknown
  parentId?: unknown
  path?: unknown
  url?: unknown
  workspace?: unknown
  root?: unknown
  level?: unknown
  filter?: Filter
}

interface Condition {
  (doc: Doc): boolean
}

interface CompiledFilter {
  condition: DocCondition
  exact: boolean
}

class EntryDocLinkResolver {
  constructor(
    private resolver: EntryDocResolver,
    private ctx: ResolveContext,
    public locale: string | null
  ) {}

  includedAtBuild(filePath: string): boolean {
    return this.resolver.index.initialSync?.has(filePath) ?? false
  }

  async resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<InferProjection<P>>> {
    const results = await this.resolver.resolve({
      preferredLocale: this.locale ?? undefined,
      status: this.ctx.status,
      select: projection,
      id: {in: entryIds}
    })
    return results as Array<InferProjection<P>>
  }
}

export class EntryDocResolver implements Resolver {
  #scope: Scope

  constructor(
    public config: Config,
    public index: EntryDocIndex
  ) {
    this.#scope = getScope(config)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const previewEntry =
      query.preview && 'entry' in query.preview
        ? query.preview.entry
        : undefined
    if (previewEntry) {
      return this.index.withPreviewEntry(previewEntry as Entry, () => {
        return this.resolve({...query, preview: undefined})
      }) as Promise<AnyQueryResult<Query>>
    }
    return this.resolveAsync(query)
  }

  private resolveAsync<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const ctx: ResolveContext = {
      status: query.status ?? 'published',
      locale: query.locale,
      searchTerms: Array.isArray(query.search)
        ? query.search.join(' ')
        : query.search,
      cache: this.index.createReadCache()
    }
    return this.query(ctx, query as GraphQuery<Projection>) as Promise<
      AnyQueryResult<Query>
    >
  }

  private async query(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    edgeParent?: Doc
  ): Promise<unknown> {
    const docs = this.docsForQuery(ctx, query, edgeParent)
    return this.queryDocs(ctx, query, docs)
  }

  private async queryDocs(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    inputDocs: Array<Doc>
  ): Promise<unknown> {
    let docs = inputDocs
    const edge = query as EdgeQuery<Projection>
    docs = docs.filter(doc => this.matchesQuery(ctx, doc, edge))
    docs = this.applyGroupBy(ctx, docs, edge)
    docs = this.applyOrderBy(ctx, docs, edge)
    if (query.skip) docs = docs.slice(query.skip)
    if (query.take !== undefined) docs = docs.slice(0, query.take)
    if (query.count) return docs.length
    const selected = await Promise.all(
      docs.map(doc => this.select(ctx, doc, query))
    )
    if (this.isSingleResult(query)) return selected[0] ?? null
    return selected
  }

  private docsForQuery(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    edgeParent?: Doc
  ): Array<Doc> {
    const edge = query as EdgeQuery<Projection>
    const docQuery = this.docQueryFor(ctx, edge, edgeParent)
    return this.index.queryDocs(docQuery)
  }

  private docQueryFor(
    ctx: ResolveContext,
    query: EdgeQuery<Projection>,
    edgeParent: Doc | undefined
  ): EntryDocQuery {
    const ids = this.idValues(query.id)
    const compiledFilter = query.filter
      ? this.filterWhere(query.filter as Filter)
      : undefined
    const canPageInEngine = this.canPageInEngine(query, compiledFilter)
    const descendantOf =
      query.edge === 'children' && query.depth && query.depth > 1 && edgeParent
        ? edgeParent.id
        : undefined
    return {
      ids,
      parentNodeId:
        edgeParent && descendantOf === undefined ? edgeParent.id : undefined,
      descendantOfNodeId: descendantOf,
      type: this.typeNames(query.type),
      locale: query.locale ?? ctx.locale,
      status: query.status ?? ctx.status,
      search: Array.isArray(query.search)
        ? query.search.join(' ')
        : query.search,
      level:
        query.edge === 'children' && edgeParent
          ? this.childLevel(edgeParent, query.depth ?? 1)
          : undefined,
      where: compiledFilter?.condition,
      orderBy: this.sqlOrder(query.orderBy),
      skip: canPageInEngine ? query.skip : undefined,
      take: canPageInEngine
        ? (query.take ?? (this.isSingleResult(query) ? 1 : undefined))
        : undefined
    }
  }

  private matchesQuery(
    ctx: ResolveContext,
    doc: Doc,
    query: EdgeQuery<Projection>
  ): boolean {
    if (!this.index.matchesStatus(doc, query.status ?? ctx.status, ctx.cache))
      return false
    const checkEntry = this.entryCondition(ctx, query)
    if (checkEntry && !checkEntry(doc)) return false
    const checkFilter =
      query.filter && !this.filterWhere(query.filter as Filter)?.exact
        ? this.filterCondition(ctx, query.filter)
        : undefined
    if (checkFilter && !checkFilter(doc)) return false
    return true
  }

  private canPageInEngine(
    query: EdgeQuery<Projection>,
    compiledFilter: CompiledFilter | undefined
  ): boolean {
    if (query.groupBy) return false
    if (compiledFilter && !compiledFilter.exact) return false
    if (this.hasPostSqlEntryCondition(query)) return false
    return Boolean(query.search || query.orderBy || typeof query.id === 'string')
  }

  private hasPostSqlEntryCondition(query: EntryFieldQuery): boolean {
    return (
      query.parentId !== undefined ||
      query.path !== undefined ||
      query.url !== undefined ||
      query.workspace !== undefined ||
      query.root !== undefined
    )
  }

  private async select(
    ctx: ResolveContext,
    doc: Doc,
    query: GraphQuery<Projection>
  ): Promise<unknown> {
    if (query.select && hasExpr(query.select))
      return this.projectExpr(ctx, doc, query.select as Expr)
    return this.selectProjection(ctx, doc, this.projection(query))
  }

  private async selectProjection(
    ctx: ResolveContext,
    doc: Doc,
    value: Projection
  ): Promise<unknown> {
    if (value && hasExpr(value))
      return this.projectExpr(ctx, doc, value as Expr)
    const source = querySource(value)
    if (source) return this.edge(ctx, doc, value as EdgeQuery<Projection>)
    const projected = await Promise.all(
      entries(value).map(async ([key, child]) => {
        return [key, await this.selectProjection(ctx, doc, child as Projection)]
      })
    )
    return fromEntries(projected)
  }

  private async edge(
    ctx: ResolveContext,
    doc: Doc,
    query: EdgeQuery<Projection>
  ): Promise<unknown> {
    const data = entryData(doc)
    switch (query.edge) {
      case 'children':
        return this.query({...ctx, locale: data.locale}, query, doc)
      case 'parent': {
        const parent = doc.parent
          ? this.index.mainDoc(doc.parent, data.locale, ctx.cache)
          : undefined
        if (!parent) return null
        return this.queryDocs({...ctx, locale: data.locale}, query, [parent])
      }
      case 'translations':
        return this.queryDocs(
          ctx,
          query,
          this.index
            .queryDocs({
              ids: [data.id],
              status: query.status ?? ctx.status
            })
            .filter(candidate => {
              return (
                query.includeSelf || entryData(candidate).locale !== data.locale
              )
            })
        )
      case 'entrySingle': {
        const value = this.index.field(doc, this.#scope.nameOf(query.field)!)
        const id = this.linkId(value)
        return this.query(ctx, {...query, id: id ? {in: [id]} : {in: []}})
      }
      case 'entryMultiple': {
        const value = this.index.field(doc, this.#scope.nameOf(query.field)!)
        const ids = Array.isArray(value)
          ? value.map(item => this.linkId(item)).filter(this.isString)
          : []
        return this.query(ctx, {...query, id: {in: ids}})
      }
      case 'parents': {
        const depth = query.depth ?? Number.POSITIVE_INFINITY
        return this.queryDocs(
          {...ctx, locale: data.locale},
          query,
          this.index.parentDocs(doc, data.locale, ctx.cache).slice(-depth)
        )
      }
      case 'siblings': {
        return this.queryDocs(
          {...ctx, locale: data.locale},
          query,
          this.index
            .queryDocs({
              parentNodeId: doc.parent,
              locale: data.locale,
              status: query.status ?? ctx.status
            })
            .filter(candidate => query.includeSelf || candidate.id !== doc.id)
        )
      }
      case 'next': {
        return this.queryDocs(
          {...ctx, locale: data.locale},
          {...query, first: true},
          this.index
            .queryDocs({
              parentNodeId: doc.parent,
              locale: data.locale,
              status: query.status ?? ctx.status
            })
            .filter(candidate => {
              return compareStrings(candidate.index ?? '', doc.index ?? '') > 0
            })
        )
      }
      case 'previous': {
        return this.queryDocs(
          {...ctx, locale: data.locale},
          {...query, first: true},
          this.index
            .queryDocs({
              parentNodeId: doc.parent,
              locale: data.locale,
              status: query.status ?? ctx.status
            })
            .filter(candidate => {
              return compareStrings(candidate.index ?? '', doc.index ?? '') < 0
            })
            .toReversed()
        )
      }
      default:
        unreachable(query)
    }
  }

  private projection(query: GraphQuery<Projection>): Projection {
    if (query.select) return query.select
    return {
      id: {internal: 'placeholder'}
    } as unknown as Projection
  }

  private expr(ctx: ResolveContext, doc: Doc, expr: Expr): unknown {
    const internal = getExpr(expr)
    switch (internal.type) {
      case 'field': {
        const name = this.#scope.nameOf(expr)
        assert(name, `Expression has no field name: ${expr}`)
        const value = this.index.field(doc, name)
        return cloneQueryValue(value)
      }
      case 'entryField':
        return cloneQueryValue(
          this.index.entryField(doc, internal.name, internal.path, ctx.cache)
        )
      case 'call':
        return this.call(ctx, doc, internal)
      case 'value':
        return internal.value
      default:
        unreachable(internal)
    }
  }

  private async projectExpr(
    ctx: ResolveContext,
    doc: Doc,
    expr: Expr
  ): Promise<unknown> {
    const value = this.expr(ctx, doc, expr)
    if (!hasField(expr)) return value
    const field = expr as Field<
      unknown,
      unknown,
      unknown,
      FieldOptions<unknown>
    >
    const fieldData = getField(field)
    if (!fieldData.queryValue && !fieldData.applyLinks) return value
    const loader = new EntryDocLinkResolver(
      this,
      ctx,
      entryData(doc).locale
    ) as unknown as LinkResolver
    return Field.queryValue(field, value, loader)
  }

  private call(
    ctx: ResolveContext,
    doc: Doc,
    internal: {method: string; args: Array<Expr>}
  ): unknown {
    switch (internal.method) {
      case 'snippet': {
        if (!ctx.searchTerms)
          throw new Error('Snippet method requires search terms to be provided')
        const start = this.expr(ctx, doc, internal.args[0])
        const end = this.expr(ctx, doc, internal.args[1])
        const cutOff = this.expr(ctx, doc, internal.args[2])
        const limit = this.expr(ctx, doc, internal.args[3])
        return snippet(
          entryData(doc).searchableText,
          ctx.searchTerms,
          String(start),
          String(end),
          String(cutOff),
          Number(limit)
        )
      }
      default:
        throw new Error(`Unknown method: "${internal.method}"`)
    }
  }

  private entryCondition(
    ctx: ResolveContext,
    query: EntryFieldQuery
  ): Condition | undefined {
    const checks = Array<Condition>()
    const root =
      isRecord(query.root) && hasRoot(query.root)
        ? this.#scope.nameOf(query.root)
        : query.root
    const workspace =
      isRecord(query.workspace) && hasWorkspace(query.workspace)
        ? this.#scope.nameOf(query.workspace)
        : query.workspace
    this.addFieldCondition(ctx, checks, 'id', query.id)
    this.addFieldCondition(ctx, checks, 'parentId', query.parentId)
    this.addFieldCondition(ctx, checks, 'path', query.path)
    this.addFieldCondition(ctx, checks, 'url', query.url)
    this.addFieldCondition(ctx, checks, 'workspace', workspace)
    this.addFieldCondition(ctx, checks, 'root', root)
    this.addFieldCondition(ctx, checks, 'level', query.level)
    if (checks.length === 0) return undefined
    return doc => checks.every(check => check(doc))
  }

  private addFieldCondition(
    ctx: ResolveContext,
    checks: Array<Condition>,
    field: string,
    condition: unknown
  ): void {
    if (condition === undefined) return
    checks.push(doc => {
      return matchesCondition(
        this.index.entryField(doc, field, undefined, ctx.cache),
        condition
      )
    })
  }

  private filterCondition(ctx: ResolveContext, filter: Filter): Condition {
    if ('or' in filter)
      return doc => {
        return filter.or.some(child => {
          return child ? this.filterCondition(ctx, child)(doc) : false
        })
      }
    if ('and' in filter)
      return doc => {
        return filter.and.every(child => {
          return child ? this.filterCondition(ctx, child)(doc) : true
        })
      }
    const fields = filter as Record<string, unknown>
    return doc => {
      for (const [field, condition] of Object.entries(fields)) {
        const value = field.startsWith('_')
          ? this.index.entryField(doc, field.slice(1), undefined, ctx.cache)
          : this.index.field(doc, field)
        if (!matchesCondition(value, condition)) return false
      }
      return true
    }
  }

  private filterWhere(filter: Filter): CompiledFilter | undefined {
    if ('or' in filter) {
      const compiled = filter.or.map(child => {
        return child ? this.filterWhere(child) : undefined
      })
      if (compiled.some(child => !child?.exact)) return undefined
      return {
        condition: {
          or: compiled.map(child => child!.condition)
        },
        exact: true
      }
    }
    if ('and' in filter) {
      const compiled = filter.and
        .map(child => {
          return child ? this.filterWhere(child) : undefined
        })
        .filter((child): child is CompiledFilter => Boolean(child))
      if (compiled.length === 0) return undefined
      return {
        condition: {
          and: compiled.map(child => child.condition)
        },
        exact: compiled.every(child => child.exact)
      }
    }
    const conditions = Array<DocCondition>()
    let exact = true
    for (const [field, condition] of Object.entries(
      filter as Record<string, unknown>
    )) {
      if (field.startsWith('_')) {
        exact = false
        continue
      }
      const compiled = this.fieldWhere(`data.${field}`, condition)
      if (!compiled) {
        exact = false
        continue
      }
      exact = exact && compiled.exact
      conditions.push(compiled.condition)
    }
    if (conditions.length === 0) return undefined
    return {
      condition: conditions.length === 1 ? conditions[0] : {and: conditions},
      exact
    }
  }

  private fieldWhere(
    path: string,
    condition: unknown
  ): CompiledFilter | undefined {
    if (!isRecord(condition)) {
      return {condition: {path, eq: condition}, exact: true}
    }
    const field: DocFieldCondition = {path}
    let exact = true
    if ('is' in condition) field.eq = condition.is
    if ('isNot' in condition) field.ne = condition.isNot
    if (Array.isArray(condition.in)) field.in = [...condition.in]
    if ('gt' in condition) field.gt = condition.gt
    if ('gte' in condition) field.gte = condition.gte
    if ('lt' in condition) field.lt = condition.lt
    if ('lte' in condition) field.lte = condition.lte
    if (typeof condition.startsWith === 'string')
      field.like = `${condition.startsWith}%`
    if (
      'notIn' in condition ||
      'or' in condition ||
      'has' in condition ||
      'includes' in condition
    )
      exact = false
    const hasCondition = Object.keys(field).length > 1
    if (!hasCondition) return undefined
    return {condition: field, exact}
  }

  private applyGroupBy(
    ctx: ResolveContext,
    docs: Array<Doc>,
    query: GraphQuery<Projection>
  ): Array<Doc> {
    if (!query.groupBy) return docs
    assert(!Array.isArray(query.groupBy), 'groupBy must be a single field')
    const groups = new Map<unknown, Doc>()
    for (const doc of docs) {
      const value = this.expr(ctx, doc, query.groupBy)
      if (!groups.has(value)) groups.set(value, doc)
    }
    return Array.from(groups.values())
  }

  private applyOrderBy(
    ctx: ResolveContext,
    docs: Array<Doc>,
    query: GraphQuery<Projection>
  ): Array<Doc> {
    if (!query.orderBy) return docs
    const orders = Array.isArray(query.orderBy)
      ? query.orderBy
      : [query.orderBy]
    return docs.toSorted((a, b) => {
      for (const order of orders) {
        const expr = (order.asc ?? order.desc)!
        const valueA = this.expr(ctx, a, expr)
        const valueB = this.expr(ctx, b, expr)
        const compare = compareValues(
          valueA,
          valueB,
          Boolean(order.caseSensitive)
        )
        if (compare !== 0) return order.asc ? compare : -compare
      }
      return 0
    })
  }

  private sqlOrder(orderBy: Order | Array<Order> | undefined): Array<DocOrder> {
    if (!orderBy) return []
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
    const result = Array<DocOrder>()
    for (const order of orders) {
      const expr = order.asc ?? order.desc
      if (!expr) continue
      const path = this.orderPath(expr)
      if (!path) continue
      result.push({path, desc: Boolean(order.desc)})
    }
    return result
  }

  private orderPath(expr: Expr): string | undefined {
    const internal = getExpr(expr)
    switch (internal.type) {
      case 'field': {
        const name = this.#scope.nameOf(expr)
        return name ? `data.${name}` : undefined
      }
      case 'entryField':
        return internal.path
          ? `data.${[...internal.path, internal.name].join('.')}`
          : internal.name
      default:
        return undefined
    }
  }

  private isSingleResult(query: GraphQuery & Partial<EdgeQuery>): boolean {
    return Boolean(
      query.first ||
      query.get ||
      query.count ||
      query.edge === 'parent' ||
      query.edge === 'next' ||
      query.edge === 'previous'
    )
  }

  private typeNames(type: unknown): string | Array<string> | undefined {
    if (!type) return undefined
    const types = Array.isArray(type) ? type : [type]
    const names = types
      .map(candidate => {
        return isRecord(candidate)
          ? this.#scope.nameOf(candidate as never)
          : undefined
      })
      .filter(this.isString)
    return names.length === 0 ? undefined : names
  }

  private idValues(input: unknown): Array<string> | undefined {
    if (typeof input === 'string') return [input]
    if (!isRecord(input)) return undefined
    const values = input.in
    if (!Array.isArray(values)) return undefined
    return values.filter(this.isString)
  }

  private childLevel(
    parent: Doc,
    depth: number
  ): number | {gt?: number; gte?: number; lt?: number; lte?: number} {
    if (depth <= 1) return parent.level + 1
    return {gt: parent.level, lte: parent.level + depth}
  }

  private linkId(input: unknown): string | undefined {
    if (!isRecord(input)) return undefined
    const id = input._entry
    return typeof id === 'string' ? id : undefined
  }

  private isString(input: unknown): input is string {
    return typeof input === 'string'
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object'
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!isRecord(condition)) return value === condition
  if ('is' in condition && value !== condition.is) return false
  if ('isNot' in condition && value === condition.isNot) return false
  if (Array.isArray(condition.in) && !condition.in.includes(value)) return false
  if (Array.isArray(condition.notIn) && condition.notIn.includes(value))
    return false
  if ('gt' in condition && !(compareUnknown(value, condition.gt) > 0))
    return false
  if ('gte' in condition && !(compareUnknown(value, condition.gte) >= 0))
    return false
  if ('lt' in condition && !(compareUnknown(value, condition.lt) < 0))
    return false
  if ('lte' in condition && !(compareUnknown(value, condition.lte) <= 0))
    return false
  if (typeof condition.startsWith === 'string') {
    if (typeof value !== 'string' || !value.startsWith(condition.startsWith))
      return false
  }
  if (condition.has && !matchesCondition(value, condition.has)) return false
  if (condition.includes) {
    if (!Array.isArray(value)) return false
    return value.some(item => matchesCondition(item, condition.includes))
  }
  return true
}

function compareUnknown(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string')
    return compareStrings(a, b)
  return 0
}

function compareValues(a: unknown, b: unknown, caseSensitive: boolean): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') {
    return caseSensitive
      ? compareStrings(a, b)
      : a.localeCompare(b, undefined, {numeric: true})
  }
  return 0
}

function cloneQueryValue(value: unknown): unknown {
  if (value && typeof value === 'object') return structuredClone(value)
  return value
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
    highlightedWords.push(isMatch ? `${start}${words[i]}${end}` : words[i])
  }
  if (firstMatchIndex === -1)
    return words.slice(0, Math.min(limit, words.length)).join(' ')
  const idealStartIndex = Math.max(0, firstMatchIndex - Math.floor(limit / 2))
  const snippetResultWords = highlightedWords.slice(
    idealStartIndex,
    idealStartIndex + limit
  )
  let result = snippetResultWords.join(' ')
  if (idealStartIndex > 0) result = `${cutOff}${result}`
  if (idealStartIndex + limit < highlightedWords.length)
    result = `${result}${cutOff}`
  return result
}
