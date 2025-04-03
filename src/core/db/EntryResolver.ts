import type {Type} from 'alinea'
import type {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import {EntryFields} from 'alinea/core/EntryFields'
import type {Expr} from 'alinea/core/Expr'
import {Field} from 'alinea/core/Field'
import type {Condition, Filter} from 'alinea/core/Filter'
import {
  type AnyQueryResult,
  type EdgeQuery,
  type GraphQuery,
  type Projection,
  type QuerySettings,
  type Status,
  querySource
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
import type {EntryIndex} from './EntryIndex.js'
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
  #scope: Scope
  #index: EntryIndex

  constructor(config: Config, index: EntryIndex) {
    this.#scope = getScope(config)
    this.#index = index
  }

  call(entry: Entry, internal: {method: string; args: Array<Expr>}): unknown {
    switch (internal.method) {
      case 'snippet':
        throw new Error('Not implemented')
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

  expr(entry: Entry, expr: Expr): unknown {
    const internal = getExpr(expr)
    switch (internal.type) {
      case 'field':
        return this.field(entry, expr)
      case 'entryField':
        return entry[internal.name as keyof Entry]
      case 'call':
        return this.call(entry, internal)
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
    entries: Array<Entry>,
    entry: Entry,
    query: EdgeQuery
  ): (entry: Entry) => boolean {
    switch (query.edge) {
      case 'parent': {
        return ({id, locale}) =>
          id === entry.parentId && locale === entry.locale
      }
      case 'next': {
        const next = entries
          .filter(
            ({workspace, root, parentId, index, locale}) =>
              workspace === entry.workspace &&
              root === entry.root &&
              parentId === entry.parentId &&
              index < entry.index &&
              locale === entry.locale
          )
          .sort((a, b) => compareStrings(a.index, b.index))
        return entry => entry === next[0]
      }
      case 'previous': {
        const previous = entries
          .filter(
            ({workspace, root, parentId, index, locale}) =>
              workspace === entry.workspace &&
              root === entry.root &&
              parentId === entry.parentId &&
              index > entry.index &&
              locale === entry.locale
          )
          .sort((a, b) => compareStrings(b.index, a.index))
        return entry => entry === previous[0]
      }
      case 'siblings': {
        return ({workspace, root, parentId, id, locale}) =>
          workspace === entry.workspace &&
          root === entry.root &&
          parentId === entry.parentId &&
          locale === entry.locale &&
          (query.includeSelf ? true : id !== entry.id)
      }
      case 'translations': {
        return ({id, locale}) => id === entry.id && locale !== entry.locale
      }
      case 'children': {
        const depth = query?.depth ?? 1
        return ({level, filePath}) =>
          level > entry.level &&
          level <= entry.level + depth &&
          filePath.startsWith(entry.childrenDir)
      }
      case 'parents': {
        const depth = query?.depth ?? Number.POSITIVE_INFINITY
        const segments = entry.parentDir.split('/')
        const parentPaths = segments.map((_, i) =>
          segments.slice(0, i + 1).join('/')
        )
        return ({level, childrenDir}) =>
          level < entry.level &&
          level > entry.level - depth &&
          parentPaths.includes(childrenDir)
      }
      case 'entryMultiple': {
        const fieldValue = this.field(entry, query.field)
        const ids: Set<string> = new Set(
          Array.isArray(fieldValue)
            ? fieldValue.map(item => item._entry).filter(Boolean)
            : []
        )
        return ({id}) => ids.has(id)
      }
      case 'entrySingle': {
        const fieldValue = this.field(entry, query.field) as {_entry: string}
        const entryId = fieldValue?._entry
        return ({id}) => id === entryId
      }
      default:
        return () => true
    }
  }

  selectProjection(
    ctx: ResolveContext,
    entry: Entry,
    value: Projection
  ): unknown {
    if (value && hasExpr(value)) return this.expr(entry, value as Expr)
    const source = querySource(value)
    if (!source)
      return fromEntries(
        entries(value).map(([key, value]) => {
          return [key, this.selectProjection(ctx, entry, value as Projection)]
        })
      )
    const related = value as object as EdgeQuery<Projection>
    return this.query(
      ctx,
      related,
      this.sourceFilter(ctx.entries, entry, related)
    )
  }

  select(
    ctx: ResolveContext,
    entry: Entry | null,
    query: GraphQuery<Projection>
  ): unknown {
    if (!entry) return null
    if (query.select && hasExpr(query.select))
      return this.expr(entry, query.select as Expr)
    const fields = this.projection(query)
    return this.selectProjection(ctx, entry, fromEntries(entries(fields)))
  }

  getField(entry: Entry, name: string): unknown {
    if (name.startsWith('_')) {
      const entryProp = name.slice(1) as keyof Entry
      return entry[entryProp]
    }
    return entry.data[name]
  }

  conditionFilter(
    filter: Filter,
    getField: (name: string) => unknown
  ): boolean {
    const isOrFilter = orFilter.check(filter)
    if (isOrFilter)
      return filter.or
        .filter(Boolean)
        .some(filter => this.conditionFilter(filter, getField))

    const isAndFilter = andFilter.check(filter)
    if (isAndFilter)
      return filter.and
        .filter(Boolean)
        .every(filter => this.conditionFilter(filter, getField))

    const check = (field: any, condition: Condition<unknown>): boolean => {
      if (typeof condition !== 'object' || !condition)
        return condition === undefined ? true : field === condition
      return entries(condition).every(([op, inner]) => {
        switch (op) {
          case 'is':
            return field === inner
          case 'isNot':
            return field !== inner
          case 'gt':
            return field > inner
          case 'gte':
            return field >= inner
          case 'lt':
            return field < inner
          case 'lte':
            return field <= inner
          case 'startsWith':
            return field.startsWith(inner)
          case 'or':
            if (Array.isArray(inner))
              return inner.some(value => check(field, value))
            return check(field, inner)
          case 'in':
            return inner.includes(field)
          case 'notIn':
            return !inner.includes(field)
          case 'has':
            return (
              inner &&
              this.conditionFilter(inner, (name: string) => field[name])
            )
          case 'includes':
            return (
              Array.isArray(field) &&
              field.some(value =>
                this.conditionFilter(inner, (name: string) => value[name])
              )
            )
          default:
            throw new Error(`Unknown filter operator: "${op}"`)
        }
      })
    }
    for (const [key, condition] of entries(filter)) {
      if (!check(getField(key), condition as Condition<unknown>)) return false
    }
    return true
  }

  conditionEntryFields(entry: Entry, query: QuerySettings): boolean {
    const workspace =
      query.workspace &&
      typeof query.workspace === 'object' &&
      hasWorkspace(query.workspace)
        ? this.#scope.nameOf(query.workspace)
        : query.workspace
    const root =
      query.root && typeof query.root === 'object' && hasRoot(query.root)
        ? this.#scope.nameOf(query.root)
        : query.root
    return this.conditionFilter(
      {
        _id: query.id,
        _parentId: query.parentId,
        _path: query.path,
        _url: query.url,
        _workspace: workspace,
        _root: root
      },
      name => this.getField(entry, name)
    )
  }

  conditionLocale(entry: Entry, locale: string | null | undefined): boolean {
    if (locale === null) return entry.locale === null
    if (!locale) return true
    return entry.locale === locale
  }

  conditionStatus(entry: Entry, status: Status): boolean {
    switch (status) {
      case 'published':
        return entry.status === 'published'
      case 'draft':
        return entry.status === 'draft'
      case 'archived':
        return entry.status === 'archived'
      case 'preferDraft':
        return entry.active
      case 'preferPublished':
        return entry.main
      case 'all':
        return true
    }
  }

  conditionLocation(entry: Entry, location: Array<string>): boolean {
    switch (location.length) {
      case 1:
        return entry.workspace === location[0]
      case 2:
        return entry.workspace === location[0] && entry.root === location[1]
      case 3:
        return (
          entry.workspace === location[0] &&
          entry.root === location[1] &&
          entry.parentDir.startsWith(`/${location[2]}`)
        )
      default:
        return true
    }
  }

  conditionTypes(entry: Entry, types: Type | Array<Type>): boolean {
    if (Array.isArray(types)) {
      const names = types.map(type => this.#scope.nameOf(type))
      return names.includes(entry.type)
    }
    return entry.type === this.#scope.nameOf(types)
  }

  condition(ctx: ResolveContext, query: GraphQuery) {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && this.#scope.locationOf(query.location)
    return (entry: Entry) => {
      const matchesStatus = this.conditionStatus(
        entry,
        query.status ?? ctx.status ?? 'published'
      )
      if (!matchesStatus) return false
      const matchesLocation =
        !location || this.conditionLocation(entry, location)
      if (!matchesLocation) return false
      const matchesType =
        !query.type ||
        this.conditionTypes(entry, query.type as Type | Array<Type>)
      if (!matchesType) return false
      const source = querySource(query)
      const matchesLocale = this.conditionLocale(
        entry,
        query.locale ?? ctx.locale
      )
      if (source !== 'translations' && !matchesLocale) return false
      const matchesEntryFields = this.conditionEntryFields(entry, query)
      if (!matchesEntryFields) return false
      if (!query.filter) return true
      return this.conditionFilter(query.filter ?? {}, name =>
        this.getField(entry, name)
      )
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
    preFilter?: (entry: Entry) => boolean
  ): any {
    const {skip, take, orderBy, groupBy, search, count} = query
    let results = ctx.entries
    const postFilter = this.condition(ctx, query)
    const condition = preFilter
      ? (entry: Entry) => preFilter(entry) && postFilter(entry)
      : postFilter
    if (search) {
      results = this.#index.search(
        Array.isArray(search) ? search.join(' ') : search,
        condition
      )
    } else {
      results = results.filter(condition)
    }
    const isSingle = this.isSingleResult(query as EdgeQuery)
    if (count) return results.length
    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
      results.sort((a, b) => {
        for (const order of orders) {
          const expr = (order.asc ?? order.desc)!
          const valueA = this.expr(a, expr) as string | number
          const valueB = this.expr(b, expr) as string | number
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
        const value = this.expr(entry, groupBy)
        if (!groups.has(value)) groups.set(value, entry)
      }
      results = Array.from(groups.values())
    }
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
    if (querySource(selected))
      return this.post(ctx, interim, selected as EdgeQuery<Projection>)
    await Promise.all(
      entries(selected).map(([key, value]) => {
        const source = querySource(value)
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

  #previewEntries(entries: Array<Entry>, preview?: Entry) {
    if (!preview) return entries
    const index = entries.findIndex(entry => {
      return (
        entry.id === preview.id &&
        entry.locale === preview.locale &&
        entry.status === preview.status
      )
    })
    // Todo: the order here is off
    if (index === -1) return entries.concat(preview)
    const copy = entries.slice()
    copy[index] = preview
    return copy
  }

  async resolve<Query extends GraphQuery>(
    query: Query,
    entries = this.#index.entries
  ): Promise<AnyQueryResult<Query>> {
    const {preview} = query
    const previewEntry =
      preview && 'entry' in preview ? preview.entry : undefined
    const withPreview = this.#previewEntries(entries, previewEntry)
    const ctx = {
      status: query.status ?? 'published',
      locale: query.locale,
      entries: withPreview
    }
    const asEdge = (<any>query) as EdgeQuery<Projection>
    const linkResolver = new LinkResolver(this, ctx)
    const result = this.query(ctx, query as GraphQuery<Projection>)
    if (result) await this.post({linkResolver}, result, asEdge)
    return result
  }
}

export interface ResolveContext {
  entries: Array<Entry>
  status: Status
  locale?: string | null
}
