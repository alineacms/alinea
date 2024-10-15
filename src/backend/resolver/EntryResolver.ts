import {EntryPhase, EntryRow} from 'alinea/core/EntryRow'
import {EntrySearch} from 'alinea/core/EntrySearch'
import {Field} from 'alinea/core/Field'
import {GraphQuery} from 'alinea/core/Graph'
import {Expr} from 'alinea/core/pages/Expr'
import {Realm} from 'alinea/core/pages/Realm'
import {BinaryOp, SourceType, UnaryOp} from 'alinea/core/pages/ResolveData'
import {seralizeLocation} from 'alinea/core/pages/Serialize'
import {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {unreachable} from 'alinea/core/util/Types'
import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  include,
  like,
  lt,
  ne,
  Query,
  Select,
  selection,
  SelectionInput,
  Sql,
  sql
} from 'rado'
import {Builder} from 'rado/core/Builder'
import {input} from 'rado/core/expr/Input'
import {getData, getSql, getTable, HasSql} from 'rado/core/Internal'
import {Either} from 'rado/core/MetaData'
import {bm25, snippet} from 'rado/sqlite'
import type {Database} from '../Database.js'
import {Store} from '../Store.js'
import {LinkResolver} from './LinkResolver.js'
import {ResolveContext} from './ResolveContext.js'

const builder = new Builder()

const unOps = {
  [UnaryOp.Not]: sql`not`,
  [UnaryOp.IsNull]: sql`is null`
}

const binOps = {
  [BinaryOp.Add]: sql`+`,
  [BinaryOp.Subt]: sql`-`,
  [BinaryOp.Mult]: sql`*`,
  [BinaryOp.Mod]: sql`%`,
  [BinaryOp.Div]: sql`/`,
  [BinaryOp.Greater]: sql`>`,
  [BinaryOp.GreaterOrEqual]: sql`>=`,
  [BinaryOp.Less]: sql`<`,
  [BinaryOp.LessOrEqual]: sql`<=`,
  [BinaryOp.Equals]: sql`=`,
  [BinaryOp.NotEquals]: sql`!=`,
  [BinaryOp.And]: sql`and`,
  [BinaryOp.Or]: sql`or`,
  [BinaryOp.Like]: sql`like`,
  [BinaryOp.In]: sql`in`,
  [BinaryOp.NotIn]: sql`not in`,
  [BinaryOp.Concat]: sql`||`
}

const MAX_DEPTH = 999

const pageFields = keys(EntryRow)

type Interim = any

export interface PostContext {
  linkResolver: LinkResolver
}

export class EntryResolver {
  schema: Schema
  targets: Schema.Targets

  constructor(public db: Database) {
    this.schema = db.config.schema
    this.targets = Schema.targets(this.schema)
  }

  fieldOf(
    ctx: ResolveContext,
    target: pages.TargetData,
    field: string
  ): HasSql {
    const {name} = target
    if (!name) {
      const fields: Record<string, HasSql> = ctx.Table as any
      if (field in fields) return fields[field]
      throw new Error(`Selecting unknown field: "${field}"`)
    }
    const type = this.schema[name]
    if (!type)
      throw new Error(`Selecting "${field}" from unknown type: "${name}"`)
    return (<any>ctx.Table.data)[field]
  }

  pageFields(ctx: ResolveContext): Array<[string, HasSql]> {
    return pageFields.map(key => [key, this.fieldOf(ctx, {}, key)])
  }

  selectFieldsOf(
    ctx: ResolveContext,
    target: pages.TargetData
  ): Array<[string, HasSql]> {
    const {name} = target
    if (!name) return this.pageFields(ctx)
    const type = this.schema[name]
    if (!type) throw new Error(`Selecting from unknown type: "${name}"`)
    return keys(type).map(key => {
      return [key, this.fieldOf(ctx, target, key)]
    })
  }

  exprUnOp(ctx: ResolveContext, {op, expr}: pages.ExprData.UnOp): HasSql {
    switch (op) {
      case UnaryOp.IsNull:
        return sql`${this.expr(ctx, expr)} is null`
      default:
        return sql`${unOps[op]} ${this.expr(ctx, expr)}`
    }
  }

  exprBinOp(ctx: ResolveContext, {op, a, b}: pages.ExprData.BinOp): HasSql {
    switch (op) {
      case BinaryOp.In:
        return inArray(this.expr(ctx, a), this.expr(ctx, b))
      case BinaryOp.NotIn:
        return inArray(this.expr(ctx, a), this.expr(ctx, b))
      default:
        return sql`(${this.expr(ctx, a)} ${binOps[op]} ${this.expr(ctx, b)})`
    }
  }

  exprField(
    ctx: ResolveContext,
    {target, field}: pages.ExprData.Field
  ): HasSql {
    return this.fieldOf(ctx, target, field)
  }

  exprAccess(
    ctx: ResolveContext,
    {expr, field}: pages.ExprData.Access
  ): HasSql {
    return sql.jsonPath({
      target: getSql(this.expr(ctx.access, expr)),
      asSql: true,
      segments: [field]
    })
  }

  exprValue(ctx: ResolveContext, {value}: pages.ExprData.Value): HasSql {
    return sql.value(value ?? null)
  }

  exprRecord(
    ctx: ResolveContext,
    {fields}: pages.ExprData.Record
  ): Record<string, HasSql> {
    return fromEntries(
      entries(fields).map(([key, expr]) => {
        return [key, this.expr(ctx, expr)]
      })
    )
  }

  exprCall(ctx: ResolveContext, {method, args}: pages.ExprData.Call): HasSql {
    switch (method) {
      case 'snippet':
        return snippet(
          EntrySearch,
          1,
          this.expr(ctx, args[0]),
          this.expr(ctx, args[1]),
          this.expr(ctx, args[2]),
          this.expr(ctx, args[3])
        )
      default:
        throw new Error(`Unknown method: "${method}"`)
    }
  }

  expr(ctx: ResolveContext, expr: pages.ExprData): HasSql<any> {
    switch (expr.type) {
      case 'unop':
        return this.exprUnOp(ctx, expr)
      case 'binop':
        return this.exprBinOp(ctx, expr)
      case 'field':
        return this.exprField(ctx, expr)
      case 'access':
        return this.exprAccess(ctx, expr)
      case 'value':
        return this.exprValue(ctx, expr)
      case 'record':
        //return this.exprRecord(ctx, expr)
        throw new Error('Record expressions are not supported')
      case 'call':
        return this.exprCall(ctx, expr)
    }
  }

  selectRecord(ctx: ResolveContext, {fields}: pages.Selection.Record) {
    return fromEntries(
      fields.flatMap(field => {
        switch (field.length) {
          case 1:
            const [target] = field
            return this.selectFieldsOf(ctx.select, target)
          case 2:
            const [key, selection] = field
            return [[key, this.select(ctx, selection)]]
        }
      })
    )
  }

  selectRow(
    ctx: ResolveContext,
    {target}: pages.Selection.Row
  ): SelectionInput {
    return fromEntries(this.selectFieldsOf(ctx.select, target))
  }

  selectCursor(
    ctx: ResolveContext,
    selection: pages.Selection.Cursor
  ): SelectionInput {
    const isSingle = selection.cursor.first ?? false
    const query = this.queryCursor(ctx, selection)
    if (isSingle) return include.one(query)
    return include(query)
  }

  selectExpr(
    ctx: ResolveContext,
    {expr, fromParent}: pages.Selection.Expr
  ): SelectionInput {
    ctx = fromParent ? ctx.decreaseDepth() : ctx
    return this.expr(ctx.select, expr)
  }

  selectCount(ctx: ResolveContext, hasSearch: boolean): SelectionInput {
    return count(hasSearch ? EntrySearch.rowid : ctx.Table.entryId).as('count')
  }

  selectAll(ctx: ResolveContext, target: pages.TargetData): SelectionInput {
    const fields = this.selectFieldsOf(ctx.select, target)
    return fromEntries(fields)
  }

  select(
    ctx: ResolveContext,
    selection: pages.Selection,
    hasSearch = false
  ): SelectionInput {
    switch (selection.type) {
      case 'cursor':
        return this.selectCursor(ctx, selection)
      case 'row':
        return this.selectRow(ctx, selection)
      case 'record':
        return this.selectRecord(ctx, selection)
      case 'expr':
        return this.selectExpr(ctx, selection)
      case 'count':
        return this.selectCount(ctx, hasSearch)
    }
  }

  queryRecord(
    ctx: ResolveContext,
    selection: pages.Selection.Record
  ): Query<any, Either> {
    const expr = this.selectRecord(ctx.select, selection)
    return builder.select(expr)
  }

  querySource(
    ctx: ResolveContext,
    source: pages.CursorSource | undefined,
    hasSearch: boolean
  ): Select<any> {
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
    if (!source) return cursor.orderBy(asc(ctx.Table.index))
    const from = alias(EntryRow, `E${ctx.depth - 1}`) // .as(source.id)
    switch (source.type) {
      case SourceType.Parent:
        return cursor.where(eq(ctx.Table.entryId, from.parent)).limit(1)
      case SourceType.Next:
        return cursor
          .where(
            eq(ctx.Table.parent, from.parent),
            gt(ctx.Table.index, from.index)
          )
          .limit(1)
      case SourceType.Previous:
        return cursor
          .where(
            eq(ctx.Table.parent, from.parent),
            lt(ctx.Table.index, from.index)
          )
          .limit(1)
      case SourceType.Siblings:
        return cursor.where(
          eq(ctx.Table.parent, from.parent),
          source.includeSelf ? undefined : ne(ctx.Table.entryId, from.entryId)
        )
      case SourceType.Translations:
        return cursor.where(
          eq(ctx.Table.i18nId, from.i18nId),
          source.includeSelf ? undefined : ne(ctx.Table.entryId, from.entryId)
        )
      case SourceType.Children:
        const Child = alias(EntryRow, 'Child')
        const children = builder.$with('children').as(
          builder
            .select({
              entryId: Child.entryId,
              parent: Child.parent,
              level: sql<number>`0`
            })
            .from(Child)
            .where(
              eq(Child.entryId, from.entryId),
              this.conditionRealm(Child, ctx.status),
              this.conditionLocale(Child, ctx.locale)
            )
            .unionAll(self =>
              builder
                .select({
                  entryId: Child.entryId,
                  parent: Child.parent,
                  level: sql<number>`${self.level} + 1`
                })
                .from(Child)
                .innerJoin(self, eq(self.entryId, Child.parent))
                .where(
                  this.conditionRealm(Child, ctx.status),
                  this.conditionLocale(Child, ctx.locale),
                  lt(self.level, Math.min(source.depth ?? MAX_DEPTH, MAX_DEPTH))
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
          .where(inArray(ctx.Table.entryId, childrenIds))
          .orderBy(asc(ctx.Table.index))
      case SourceType.Parents:
        const Parent = alias(EntryRow, 'Parent')
        const parents = builder.$with('parents').as(
          builder
            .select({
              entryId: Parent.entryId,
              parent: Parent.parent,
              level: sql<number>`0`
            })
            .from(Parent)
            .where(
              eq(Parent.entryId, from.entryId),
              this.conditionRealm(Parent, ctx.status),
              this.conditionLocale(Parent, ctx.locale)
            )
            .unionAll(self =>
              builder
                .select({
                  entryId: Parent.entryId,
                  parent: Parent.parent,
                  level: sql<number>`${self.level} + 1`
                })
                .from(Parent)
                .innerJoin(self, eq(self.parent, Parent.entryId))
                .where(
                  this.conditionRealm(Parent, ctx.status),
                  this.conditionLocale(Parent, ctx.locale),
                  lt(self.level, Math.min(source.depth ?? MAX_DEPTH, MAX_DEPTH))
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
          .where(inArray(ctx.Table.entryId, parentIds))
          .orderBy(asc(ctx.Table.level))
      default:
        throw unreachable(source.type)
    }
  }

  orderBy(ctx: ResolveContext, orderBy: Array<pages.OrderBy>): Array<Sql> {
    return orderBy.map(({expr, order}) => {
      // TODO: reintroduce .collate('NOCASE') when sorting on title instead of index
      const e = this.expr(ctx, expr)
      const direction = order === 'Desc' ? desc : asc
      return direction(e)
    })
  }

  conditionLocale(Table: typeof EntryRow, locale?: string) {
    if (!locale) return sql.value(true)
    return eq(Table.locale, locale)
  }

  conditionRealm(Table: typeof EntryRow, realm: Realm) {
    switch (realm) {
      case Realm.Published:
        return eq(Table.phase, EntryPhase.Published)
      case Realm.Draft:
        return eq(Table.phase, EntryPhase.Draft)
      case Realm.Archived:
        return eq(Table.phase, EntryPhase.Archived)
      case Realm.PreferDraft:
        return Table.active
      case Realm.PreferPublished:
        return Table.main
      case Realm.All:
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

  conditionSearch(
    Table: typeof EntryRow,
    searchTerms?: Array<string>
  ): Sql<boolean> {
    if (!searchTerms?.length) return sql.value(true)
    const terms = searchTerms
      .map(term => `"${term.replaceAll('"', '')}"*`)
      .join(' AND ')
    return sql`${input(EntrySearch)} match ${input(terms)}`
  }

  queryCursor(
    ctx: ResolveContext,
    {cursor}: pages.Selection.Cursor
  ): Select<any> {
    const {
      target,
      where,
      skip,
      take,
      orderBy,
      groupBy,
      select,
      source,
      first,
      searchTerms
    } = cursor
    ctx = ctx.increaseDepth().none
    const {name} = target || {}
    const hasSearch = Boolean(searchTerms?.length)
    let query = this.querySource(ctx, source, hasSearch)
    const queryData = getData(query)
    let preCondition = queryData.where as HasSql<boolean>
    let condition = and(
      preCondition,
      name ? eq(ctx.Table.type, name) : undefined,
      this.conditionLocation(ctx.Table, ctx.location),
      this.conditionRealm(ctx.Table, ctx.status),
      source?.type === SourceType.Translations
        ? undefined
        : this.conditionLocale(ctx.Table, ctx.locale),
      this.conditionSearch(ctx.Table, searchTerms)
    )
    if (skip) query = query.offset(skip)
    if (take) query = query.limit(take)
    const toSelect = select
      ? this.select(ctx.select, select, hasSearch)
      : this.selectAll(ctx, {name})
    let result = new Select({
      ...queryData,
      select: selection(toSelect),
      where: where ? and(condition, this.expr(ctx.condition, where)) : condition
    })
    if (groupBy)
      result = result.groupBy(...groupBy.map(expr => this.expr(ctx, expr)))
    if (searchTerms) result = result.orderBy(asc(bm25(EntrySearch, 20, 1)))
    else if (orderBy) result = result.orderBy(...this.orderBy(ctx, orderBy))
    if (first) result = result.limit(1)
    return result
  }

  query(ctx: ResolveContext, {select}: GraphQuery) {
    if (Expr.isExpr(select)) return
    switch (selection.type) {
      case 'cursor':
        return <any>this.queryCursor(ctx, selection)
      case 'record':
        return this.queryRecord(ctx, selection)
      case 'row':
      case 'count':
      case 'expr':
        throw new Error(`Cannot select ${selection.type} at root level`)
    }
  }

  isSingleResult(ctx: ResolveContext, selection: pages.Selection): boolean {
    switch (selection.type) {
      case 'cursor':
        return selection.cursor.first ?? false
      default:
        return true
    }
  }

  async postRow(
    ctx: PostContext,
    interim: Interim,
    {target}: pages.Selection.Row
  ): Promise<void> {
    await this.postFieldsOf(ctx, interim, target)
  }

  async postCursor(
    ctx: PostContext,
    interim: Interim,
    {cursor}: pages.Selection.Cursor
  ): Promise<void> {
    if (!interim) return
    const {target = {}, select, first} = cursor
    if (select) {
      if (first) await this.post(ctx, interim, select)
      else
        await Promise.all(
          interim.map((row: Interim) => this.post(ctx, row, select))
        )
    } else {
      if (first) await this.postFieldsOf(ctx, interim, target)
      else
        await Promise.all(
          interim.map((row: Interim) => this.postFieldsOf(ctx, row, target))
        )
    }
  }

  async postField(
    ctx: PostContext,
    interim: Interim,
    {target, field}: pages.ExprData.Field
  ): Promise<void> {
    const {name} = target
    if (!name) return
    const type = this.schema[name]
    if (!type) return
    const shape = Field.shape(Type.field(type, field)!)
    await shape.applyLinks(interim, ctx.linkResolver)
  }

  async postExpr(
    ctx: PostContext,
    interim: Interim,
    {expr}: pages.Selection.Expr
  ): Promise<void> {
    if (expr.type === 'field') await this.postField(ctx, interim, expr)
  }

  async postFieldsOf(
    ctx: PostContext,
    interim: Interim,
    target: pages.TargetData
  ): Promise<void> {
    if (!interim) return
    const {name} = target
    if (!name) return
    const type = this.schema[name]
    if (!type) return
    await Promise.all(
      keys(type).map(field => {
        return this.postField(ctx, interim[field], {
          type: 'field',
          target,
          field
        })
      })
    )
  }

  async postRecord(
    ctx: PostContext,
    interim: Interim,
    {fields}: pages.Selection.Record
  ): Promise<void> {
    if (!interim) return
    const tasks = []
    for (const field of fields) {
      switch (field.length) {
        case 1:
          const [target] = field
          tasks.push(this.postFieldsOf(ctx, interim, target))
          continue
        case 2:
          const [key, selection] = field
          tasks.push(this.post(ctx, interim[key], selection))
          continue
      }
    }
    await Promise.all(tasks)
  }

  post(
    ctx: PostContext,
    interim: Interim,
    selection: pages.Selection
  ): Promise<void> {
    switch (selection.type) {
      case 'row':
        return this.postRow(ctx, interim, selection)
      case 'cursor':
        return this.postCursor(ctx, interim, selection)
      case 'record':
        return this.postRecord(ctx, interim, selection)
      case 'expr':
        return this.postExpr(ctx, interim, selection)
      case 'count':
        return Promise.resolve()
    }
  }

  resolve = async <T>(query: GraphQuery): Promise<T> => {
    const location = seralizeLocation(this.db.config, query.location)
    const ctx = new ResolveContext({
      ...query,
      location
    })
    const dbQuery = this.query(ctx, query)
    const singleResult = this.isSingleResult(ctx, selection)
    const transact = async (tx: Store): Promise<T> => {
      const rows = await query.all(tx)
      const linkResolver = new LinkResolver(this, tx, ctx.status)
      const result = singleResult ? rows[0] : rows
      if (result) await this.post({linkResolver}, result, selection)
      return result as T
    }
    if (preview) {
      const updated = 'entry' in preview ? preview.entry : undefined
      if (updated) {
        const result = await this.db.preview<T>(updated, transact)
        if (result) return result
      }
    }
    return this.db.store.transaction(transact)
  }
}
