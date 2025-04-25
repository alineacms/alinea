import type {Type} from 'alinea'
import type {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import {EntryFields} from 'alinea/core/EntryFields'
import type {Expr} from 'alinea/core/Expr'
import {Field} from 'alinea/core/Field'
import type {AnyCondition, Filter} from 'alinea/core/Filter'
import {
  type AnyQueryResult,
  type EdgeQuery,
  type GraphQuery,
  type Projection,
  type QuerySettings,
  type Status,
  querySource as queryEdge
} from 'alinea/core/Graph'
import {
  type HasExpr,
  getExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from 'alinea/core/Internal'
import type {Resolver} from 'alinea/core/Resolver'
import {type Scope, getScope} from 'alinea/core/Scope'
import {hasExact} from 'alinea/core/util/Checks'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {unreachable} from 'alinea/core/util/Types'
import * as cito from 'cito'
import {assert, compareStrings} from '../source/Utils.js'
import type {EntryFilter, EntryIndex} from './EntryIndex.js'
import {LinkResolver} from './LinkResolver.js'

const orFilter = cito.object({or: cito.array(cito.any)}).and(hasExact(['or']))
const andFilter = cito
  .object({and: cito.array(cito.any)})
  .and(hasExact(['and']))

type Interim = any

export interface PostContext {
  linkResolver: LinkResolver
}

export class EntryResolver implements Resolver {
  index: EntryIndex
  #config: Config
  #scope: Scope

  constructor(config: Config, index: EntryIndex) {
    this.#config = config
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
  ): EntryFilter {
    switch (query.edge) {
      case 'parent': {
        return {
          ids: entry.parentId ? [entry.parentId] : [],
          condition({locale}) {
            return locale === entry.locale
          }
        }
      }
      case 'next': {
        const [next] = this.index
          .filter({
            condition({workspace, root, parentId, index, locale}) {
              return (
                workspace === entry.workspace &&
                root === entry.root &&
                parentId === entry.parentId &&
                index < entry.index &&
                locale === entry.locale
              )
            }
          })
          .sort((a, b) => compareStrings(a.index, b.index))
        return {ids: next ? [next.id] : []}
      }
      case 'previous': {
        const [previous] = this.index
          .filter({
            condition({workspace, root, parentId, index, locale}) {
              return (
                workspace === entry.workspace &&
                root === entry.root &&
                parentId === entry.parentId &&
                index > entry.index &&
                locale === entry.locale
              )
            }
          })
          .sort((a, b) => compareStrings(b.index, a.index))
        return {ids: previous ? [previous.id] : []}
      }
      case 'siblings': {
        return {
          condition({workspace, root, parentId, id, locale}) {
            return (
              workspace === entry.workspace &&
              root === entry.root &&
              parentId === entry.parentId &&
              locale === entry.locale &&
              (query.includeSelf ? true : id !== entry.id)
            )
          }
        }
      }
      case 'translations': {
        return {
          ids: [entry.id],
          condition({locale}) {
            return locale !== entry.locale
          }
        }
      }
      case 'children': {
        const depth = query?.depth ?? 1
        return {
          condition({level, filePath}) {
            return (
              level > entry.level &&
              level <= entry.level + depth &&
              filePath.startsWith(entry.childrenDir)
            )
          }
        }
      }
      case 'parents': {
        const depth = query?.depth ?? Number.POSITIVE_INFINITY
        const segments = entry.parentDir.split('/')
        const parentPaths = segments.map((_, i) =>
          segments.slice(0, i + 1).join('/')
        )
        return {
          condition({level, childrenDir}) {
            return (
              level < entry.level &&
              level > entry.level - depth &&
              parentPaths.includes(childrenDir)
            )
          }
        }
      }
      case 'entryMultiple': {
        const fieldValue = this.field(entry, query.field)
        const ids: Set<string> = new Set(
          Array.isArray(fieldValue)
            ? fieldValue.map(item => item._entry).filter(Boolean)
            : []
        )
        return {ids: Array.from(ids)}
      }
      case 'entrySingle': {
        const fieldValue = this.field(entry, query.field) as {_entry: string}
        const entryId = fieldValue?._entry
        return {ids: entryId ? [entryId] : []}
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
    return this.query(ctx, related, this.sourceFilter(ctx, entry, related))
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

  condition(ctx: ResolveContext, query: GraphQuery): EntryFilter {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && this.#scope.locationOf(query.location)
    const checkStatus = query.status && statusChecker(query.status)
    const checkLocation = location && locationChecker(location)
    const locale = query.locale ?? ctx.locale
    const checkLocale =
      locale !== undefined &&
      localeChecker(typeof locale === 'string' ? locale.toLowerCase() : null)
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
        if (checkStatus && !checkStatus(entry)) return false
        if (checkLocation && !checkLocation(entry)) return false
        if (checkLocale && !checkLocale(entry)) return false
        if (checkType && !checkType(entry)) return false
        const matchesLocale = checkLocale ? checkLocale(entry) : true
        if (source !== 'translations' && !matchesLocale) return false
        if (checkEntry && !checkEntry(entry)) return false
        if (checkFilter && !checkFilter(entry)) return false
        return true
      }
    }
  }

  isSingleResult(query: EdgeQuery): boolean {
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
    preFilter?: EntryFilter
  ): any {
    const {skip, take, orderBy, groupBy, search, count} = query
    const {ids, condition} = this.condition(ctx, query)
    const preCondition = preFilter?.condition
    const filter = {
      ids: ids ?? preFilter?.ids,
      search: Array.isArray(search) ? search.join(' ') : search,
      condition:
        preCondition && condition
          ? (entry: Entry) => preCondition(entry) && condition(entry)
          : (condition ?? preCondition)
    }
    let results = this.index.filter(filter, ctx.preview)
    const isSingle = this.isSingleResult(query as EdgeQuery)
    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
      results.sort((a, b) => {
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
              : valueA.localeCompare(valueB)
            if (compare !== 0) return order.asc ? compare : -compare
          } else if (numbers) {
            if (valueA !== valueB)
              return order.asc ? valueA - valueB : valueB - valueA
          }
        }
        return 0
      })
    }
    if (skip) results.splice(0, skip)
    if (take) results.splice(take)
    if (groupBy) {
      assert(!Array.isArray(groupBy), 'groupBy must be a single field')
      const groups = new Map<unknown, Entry>()
      for (const entry of results) {
        const value = this.expr(ctx, entry, groupBy)
        if (!groups.has(value)) groups.set(value, entry)
      }
      results = Array.from(groups.values())
    }
    if (count) return results.length
    if (isSingle) return this.select(ctx, results[0], query)
    return results.map(entry => this.select(ctx, entry, query))
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
    /*const entries = this.index.entries
    const withPreview = this.#previewEntries(entries, previewEntry)*/
    const ctx: ResolveContext = {
      status: query.status ?? 'published',
      locale: query.locale,
      preview: previewEntry,
      searchTerms: Array.isArray(query.search)
        ? query.search.join(' ')
        : query.search
    }
    const asEdge = (<any>query) as EdgeQuery<Projection>
    const linkResolver = new LinkResolver(this, ctx)
    const result = this.query(ctx, query as GraphQuery<Projection>)
    if (result) await this.post({linkResolver}, result, asEdge)
    return result
  }
}

export interface ResolveContext {
  //entries: Array<Entry>
  status: Status
  locale?: string | null
  preview: Entry | undefined
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
  (input: any): boolean
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
    workspace,
    root
  })
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
        if (entry.level > 1) {
          const position = entry.level - 1
          const segment = entry.parentDir.split('/').at(-position)
          return segment === location[2]
        }
      }
    }
    default:
      return entry => true
  }
}

function localeChecker(locale: string | null): Check {
  return (entry: Entry) => {
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
    if (Array.isArray(inOp))
      conditions.push(input => inOp.includes(getField(input, name)))
    const notInOp = inner.notIn
    if (Array.isArray(notInOp))
      conditions.push(input => !notInOp.includes(getField(input, name)))
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
