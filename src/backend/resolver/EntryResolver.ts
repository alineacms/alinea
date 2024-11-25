import {EntryFields} from 'alinea/core/EntryFields'
import {EntryRow, EntryStatus} from 'alinea/core/EntryRow'
import {EntrySearch} from 'alinea/core/EntrySearch'
import {Expr} from 'alinea/core/Expr'
import {Field} from 'alinea/core/Field'
import {Filter} from 'alinea/core/Filter'
import {
  EdgeQuery,
  GraphQuery,
  Order,
  Projection,
  QuerySettings,
  querySource,
  Status
} from 'alinea/core/Graph'
import {
  getExpr,
  HasExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from 'alinea/core/Internal'
import {Schema} from 'alinea/core/Schema'
import {getScope, Scope} from 'alinea/core/Scope'
import {Type} from 'alinea/core/Type'
import {hasExact} from 'alinea/core/util/Checks'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {unreachable} from 'alinea/core/util/Types'
import * as cito from 'cito'
import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  include,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  or,
  Select,
  selection,
  SelectionInput,
  Sql,
  sql
} from 'rado'
import {Builder} from 'rado/core/Builder'
import {Functions} from 'rado/core/expr/Functions'
import {input} from 'rado/core/expr/Input'
import {jsonExpr} from 'rado/core/expr/Json'
import {getData, getTable, HasSql, internalTarget} from 'rado/core/Internal'
import {bm25, snippet} from 'rado/sqlite'
import type {Database} from '../Database.js'
import {Store} from '../Store.js'
import {is} from '../util/ORM.js'
import {LinkResolver} from './LinkResolver.js'
import {ResolveContext} from './ResolveContext.js'

const orFilter = cito.object({or: cito.array(cito.any)}).and(hasExact(['or']))
const andFilter = cito
  .object({and: cito.array(cito.any)})
  .and(hasExact(['and']))

const builder = new Builder()
const MAX_DEPTH = 999

type Interim = any

export interface PostContext {
  linkResolver: LinkResolver
}

export class EntryResolver {
  schema: Schema
  scope: Scope

  constructor(public db: Database) {
    this.schema = db.config.schema
    this.scope = getScope(db.config)
  }

  call(
    ctx: ResolveContext,
    internal: {method: string; args: Array<Expr>}
  ): HasSql<any> {
    switch (internal.method) {
      case 'snippet':
        return snippet(
          EntrySearch,
          1,
          internal.args[0] && this.expr(ctx, internal.args[0]),
          internal.args[1] && this.expr(ctx, internal.args[1]),
          internal.args[2] && this.expr(ctx, internal.args[2]),
          internal.args[3] && this.expr(ctx, internal.args[3])
        )
      default:
        throw new Error(`Unknown method: "${internal.method}"`)
    }
  }

  field(table: typeof EntryRow, field: Expr): HasSql<any> {
    const name = this.scope.nameOf(field)
    if (!name) throw new Error(`Expression has no name ${field}`)
    const isEntryField = name === 'path' || name === 'type'
    if (isEntryField) return table[name]
    return (<any>table.data)[name]
  }

  expr(ctx: ResolveContext, expr: Expr): HasSql<any> {
    const internal = getExpr(expr)
    switch (internal.type) {
      case 'field':
        return this.field(ctx.Table, expr)
      case 'entryField':
        return ctx.Table[internal.name as keyof EntryRow]
      case 'call':
        return this.call(ctx, internal)
      case 'value':
        return sql.value(internal.value)
      default:
        unreachable(internal)
    }
  }

  selectCount(ctx: ResolveContext, hasSearch: boolean): SelectionInput {
    return count(hasSearch ? EntrySearch.rowid : ctx.Table.id).as('count')
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

  selectProjection(ctx: ResolveContext, value: Projection): SelectionInput {
    if (value && hasExpr(value)) return this.expr(ctx, value as Expr)
    const source = querySource(value)
    if (!source)
      return fromEntries(
        entries(value).map(([key, value]) => {
          return [key, this.selectProjection(ctx, value as Projection)]
        })
      )
    const related = value as object as EdgeQuery<Projection>
    const isSingle = this.isSingleResult(related)
    const query = this.query(ctx, related)
    return isSingle ? include.one(query) : include(query)
  }

  select(ctx: ResolveContext, query: GraphQuery<Projection>): SelectionInput {
    if (query.count === true)
      return this.selectCount(ctx, Boolean(query.search?.length))
    if (query.select && hasExpr(query.select))
      return this.expr(ctx, query.select as Expr)
    const fields = this.projection(query)
    return this.selectProjection(ctx, fromEntries(entries(fields)))
  }

  querySource(ctx: ResolveContext, query: EdgeQuery): Select<any> {
    const hasSearch = Boolean(query.search?.length)
    const {aliased} = getTable(ctx.Table)
    const cursor = hasSearch
      ? builder
          .select(ctx.Table)
          .from(EntrySearch)
          .innerJoin(
            ctx.Table,
            eq(sql`${sql.identifier(aliased)}.rowid`, EntrySearch.rowid)
          )
      : builder.select().from(ctx.Table)
    const from = alias(EntryRow, `E${ctx.depth - 1}`) // .as(source.id)
    switch (query.edge) {
      case 'parent':
        return cursor.where(eq(ctx.Table.id, from.parentId)).limit(1)
      case 'next':
        return cursor
          .where(
            eq(ctx.Table.parentId, from.parentId),
            gt(ctx.Table.index, from.index)
          )
          .limit(1)
      case 'previous':
        return cursor
          .where(
            eq(ctx.Table.parentId, from.parentId),
            lt(ctx.Table.index, from.index)
          )
          .limit(1)
      case 'siblings':
        return cursor.where(
          eq(ctx.Table.parentId, from.parentId),
          query?.includeSelf ? undefined : ne(ctx.Table.id, from.id)
        )
      case 'translations':
        return cursor.where(
          eq(ctx.Table.id, from.id),
          query?.includeSelf ? undefined : ne(ctx.Table.locale, from.locale)
        )
      case 'children':
        const Child = alias(EntryRow, 'Child')
        const children = builder.$with('children').as(
          builder
            .select({
              entryId: Child.id,
              parent: Child.parentId,
              level: sql<number>`0`
            })
            .from(Child)
            .where(
              eq(Child.id, from.id),
              is(Child.locale, from.locale),
              this.conditionStatus(Child, ctx.status)
            )
            .unionAll(self =>
              builder
                .select({
                  entryId: Child.id,
                  parent: Child.parentId,
                  level: sql<number>`${self.level} + 1`
                })
                .from(Child)
                .innerJoin(self, eq(self.entryId, Child.parentId))
                .where(
                  is(Child.locale, from.locale),
                  this.conditionStatus(Child, ctx.status),
                  lt(self.level, Math.min(query?.depth ?? MAX_DEPTH, MAX_DEPTH))
                )
            )
        )
        const childrenIds = builder
          .withRecursive(children)
          .select(children.entryId)
          .from(children)
          .limit(-1)
          .offset(1)
        return cursor
          .where(
            inArray(ctx.Table.id, childrenIds),
            is(ctx.Table.locale, from.locale)
          )
          .orderBy(asc(ctx.Table.index))
      case 'parents':
        const Parent = alias(EntryRow, 'Parent')
        const parents = builder.$with('parents').as(
          builder
            .select({
              entryId: Parent.id,
              parent: Parent.parentId,
              level: sql<number>`0`
            })
            .from(Parent)
            .where(
              eq(Parent.id, from.id),
              is(Parent.locale, from.locale),
              this.conditionStatus(Parent, ctx.status)
            )
            .unionAll(self =>
              builder
                .select({
                  entryId: Parent.id,
                  parent: Parent.parentId,
                  level: sql<number>`${self.level} + 1`
                })
                .from(Parent)
                .innerJoin(self, eq(self.parent, Parent.id))
                .where(
                  is(Parent.locale, from.locale),
                  this.conditionStatus(Parent, ctx.status),
                  lt(self.level, Math.min(query?.depth ?? MAX_DEPTH, MAX_DEPTH))
                )
            )
        )
        const parentIds = builder
          .withRecursive(parents)
          .select(parents.entryId)
          .from(parents)
          .limit(-1)
          .offset(1)
        return cursor
          .where(
            inArray(ctx.Table.id, parentIds),
            is(ctx.Table.locale, from.locale)
          )
          .orderBy(asc(ctx.Table.level))
      case 'link':
        const linkedField = this.field(from, query.field)
        return cursor
          .innerJoin(
            {[internalTarget]: sql`json_each(${linkedField}) as lF`} as any,
            eq(ctx.Table.id, sql`lF.value->>'_entry'`)
          )
          .orderBy(asc(sql`lF.id`))
      default:
        return cursor.orderBy(asc(ctx.Table.index))
    }
  }

  groupBy(ctx: ResolveContext, groupBy: Array<Expr<any>>): Array<HasSql> {
    return groupBy.map(expr => {
      return this.expr(ctx, expr)
    })
  }

  orderBy(ctx: ResolveContext, orderBy: Array<Order>): Array<Sql> {
    return orderBy
      .filter(order => order.asc || order.desc)
      .map(order => {
        const expr = this.expr(ctx, (order.asc ?? order.desc)!)
        const collated = order.caseSensitive
          ? expr
          : sql`${expr} collate nocase`
        const direction = order.desc ? desc : asc
        return direction(collated)
      })
  }

  conditionLocale(Table: typeof EntryRow, locale?: string | null) {
    if (!locale) return sql.value(true)
    if (locale === null) return isNull(Table.locale)
    return eq(Table.locale, locale)
  }

  conditionStatus(Table: typeof EntryRow, status: Status) {
    switch (status) {
      case 'published':
        return eq(Table.status, EntryStatus.Published)
      case 'draft':
        return eq(Table.status, EntryStatus.Draft)
      case 'archived':
        return eq(Table.status, EntryStatus.Archived)
      case 'preferDraft':
        return Table.active
      case 'preferPublished':
        return Table.main
      case 'all':
        return sql.value(true)
    }
  }

  conditionLocation(Table: typeof EntryRow, location: Array<string>) {
    switch (location.length) {
      case 1:
        return eq(Table.workspace, location[0])
      case 2:
        return and(
          eq(Table.workspace, location[0]),
          eq(Table.root, location[1])
        )
      case 3:
        return and(
          eq(Table.workspace, location[0]),
          eq(Table.root, location[1]),
          like(Table.parentDir, `/${location[2]}%`)
        )
      default:
        return sql.value(true)
    }
  }

  conditionEntryFields(ctx: ResolveContext, query: QuerySettings) {
    const workspace =
      query.workspace &&
      typeof query.workspace === 'object' &&
      hasWorkspace(query.workspace)
        ? this.scope.nameOf(query.workspace)
        : query.workspace
    const root =
      query.root && typeof query.root === 'object' && hasRoot(query.root)
        ? this.scope.nameOf(query.root)
        : query.root
    return this.conditionFilter(ctx, this.filterField.bind(this), {
      _id: query.id,
      _parentId: query.parentId,
      _path: query.path,
      _url: query.url,
      _workspace: workspace,
      _root: root
    })
  }

  conditionSearch(
    Table: typeof EntryRow,
    searchTerms: string | Array<string> | undefined
  ): Sql<boolean> {
    if (!searchTerms?.length) return sql.value(true)
    const terms = (Array.isArray(searchTerms) ? searchTerms : [searchTerms])
      .map(term => `"${term.replaceAll('"', '')}"*`)
      .join(' AND ')
    return sql`${input(EntrySearch)} match ${input(terms)}`
  }

  conditionTypes(ctx: ResolveContext, types: Type | Array<Type>) {
    if (Array.isArray(types)) {
      const names = types.map(type => this.scope.nameOf(type))
      return inArray(ctx.Table.type, names)
    }
    return eq(ctx.Table.type, this.scope.nameOf(types))
  }

  conditionFilter(
    ctx: ResolveContext,
    getField: (ctx: ResolveContext, name: string) => Sql,
    filter: Filter
  ): Sql<boolean> {
    const isOrFilter = orFilter.check(filter)
    if (isOrFilter)
      return or(
        ...filter.or
          .filter(Boolean)
          .map(filter => this.conditionFilter(ctx, getField, filter))
      )
    const isAndFilter = andFilter.check(filter)
    if (isAndFilter)
      return and(
        ...filter.and
          .filter(Boolean)
          .map(filter => this.conditionFilter(ctx, getField, filter))
      )
    const mapCondition = ([field, value]: readonly [HasSql, unknown]): Array<
      Sql<boolean>
    > => {
      if (typeof value !== 'object' || !value)
        return value === undefined
          ? []
          : [value === null ? isNull(field) : eq(field, value)]
      return entries(value).map(([op, value]) => {
        switch (op) {
          case 'is':
            if (value === null) return isNull(field)
            return eq(field, value)
          case 'isNot':
            if (value === null) return isNotNull(field)
            return ne(field, value)
          case 'gt':
            return gt(field, value)
          case 'gte':
            return gte(field, value)
          case 'lt':
            return lt(field, value)
          case 'lte':
            return lte(field, value)
          case 'startsWith':
            return like(field as HasSql<string>, `${value}%`)
          case 'or':
            if (Array.isArray(value))
              return or(
                ...value.map((c: unknown) => {
                  return and(...mapCondition([field, c]))
                })
              )
            return and(...mapCondition([field, value]))
          case 'in':
            return inArray(field, value)
          case 'notIn':
            return not(inArray(field, value))
          case 'has':
            return this.conditionFilter(
              ctx,
              (_, name) => {
                return (<any>field)[name]
              },
              value
            )
          case 'includes':
            const expr = jsonExpr(sql`value`)
            const condition = this.conditionFilter(
              ctx,
              (_, name) => {
                return (<any>expr)[name]
              },
              value
            )
            return exists(
              builder
                .select(sql`1`)
                .from(Functions.json_each(field))
                .where(condition)
            )
          default:
            throw new Error(`Unknown filter operator: "${op}"`)
        }
      })
    }
    const conditions = entries(filter)
      .map(([key, value]) => {
        return [getField(ctx, key), value] as const
      })
      .flatMap(mapCondition)
    return and(...conditions)
  }

  filterField(ctx: ResolveContext, name: string) {
    if (name.startsWith('_')) {
      const entryProp = name.slice(1)
      const key = entryProp as keyof EntryRow
      if (!(key in ctx.Table)) throw new Error(`Unknown field: "${name}"`)
      return ctx.Table[key]
    }
    return (<any>ctx.Table.data)[name]
  }

  query(ctx: ResolveContext, query: GraphQuery<Projection>): Select<any> {
    const {type, filter, skip, take, orderBy, groupBy, first, search} = query
    ctx = ctx.increaseDepth().none
    let q = this.querySource(ctx, query as EdgeQuery<Projection>)
    const queryData = getData(q)
    let preCondition = queryData.where as HasSql<boolean>
    let condition = and(
      preCondition,
      type ? this.conditionTypes(ctx, type as Type | Array<Type>) : undefined,
      this.conditionEntryFields(ctx, query),
      this.conditionLocation(ctx.Table, ctx.location),
      this.conditionStatus(ctx.Table, ctx.status),
      querySource(query) === 'translations'
        ? undefined
        : this.conditionLocale(ctx.Table, ctx.locale),
      this.conditionSearch(ctx.Table, search),
      filter && this.conditionFilter(ctx, this.filterField.bind(this), filter)
    )
    if (skip) q = q.offset(skip)
    if (take) q = q.limit(take)
    const toSelect = this.select(ctx.select, query)
    let result = new Select({
      ...queryData,
      select: selection(toSelect),
      where: condition
    })
    if (groupBy)
      result = result.groupBy(
        ...this.groupBy(ctx, Array.isArray(groupBy) ? groupBy : [groupBy])
      )
    if (search?.length) result = result.orderBy(asc(bm25(EntrySearch, 20, 1)))
    else if (orderBy)
      result = result.orderBy(
        ...this.orderBy(ctx, Array.isArray(orderBy) ? orderBy : [orderBy])
      )

    if (first) result = result.limit(1)
    return result
  }

  isSingleResult(query: EdgeQuery): boolean {
    return Boolean(
      query.first ||
        query.get ||
        query.edge === 'parent' ||
        query.edge === 'next' ||
        query.edge === 'previous'
    )
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

  resolve = async <T>(query: GraphQuery): Promise<T> => {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && this.scope.locationOf(query.location)
    const ctx = new ResolveContext({
      ...query,
      location
    })
    const asEdge = query as EdgeQuery<Projection>
    const dbQuery = this.query(ctx, asEdge)
    const singleResult = this.isSingleResult(asEdge)
    const transact = async (tx: Store): Promise<T> => {
      const rows = await dbQuery.all(tx)
      const linkResolver = new LinkResolver(this, tx, ctx.status)
      const result = singleResult ? rows[0] ?? null : rows
      if (result) await this.post({linkResolver}, result, asEdge)
      return result as T
    }
    if (query.preview) {
      const updated = 'entry' in query.preview ? query.preview.entry : undefined
      if (updated) {
        const result = await this.db.preview<T>(updated, transact)
        if (result) return result
      }
    }
    return this.db.store.transaction(transact)
  }
}
