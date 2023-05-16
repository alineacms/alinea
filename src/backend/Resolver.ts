import {Field, RichTextShape, Schema, Shape, TextDoc, Type} from 'alinea/core'
import {assert} from 'cito'
import {
  BinOpType,
  Expr,
  ExprData,
  OrderBy,
  OrderDirection,
  ParamData,
  Query,
  QueryData,
  Select,
  Table,
  UnOpType,
  withRecursive
} from 'rado'
import {Entry, EntryTable} from '../core/Entry.js'
import {Store} from './Store.js'

import * as pages from '../core/pages/index.js'

const {keys, entries, fromEntries} = Object

const unOps = {
  [pages.UnaryOp.Not]: UnOpType.Not,
  [pages.UnaryOp.IsNull]: UnOpType.IsNull
}

const binOps = {
  [pages.BinaryOp.Add]: BinOpType.Add,
  [pages.BinaryOp.Subt]: BinOpType.Subt,
  [pages.BinaryOp.Mult]: BinOpType.Mult,
  [pages.BinaryOp.Mod]: BinOpType.Mod,
  [pages.BinaryOp.Div]: BinOpType.Div,
  [pages.BinaryOp.Greater]: BinOpType.Greater,
  [pages.BinaryOp.GreaterOrEqual]: BinOpType.GreaterOrEqual,
  [pages.BinaryOp.Less]: BinOpType.Less,
  [pages.BinaryOp.LessOrEqual]: BinOpType.LessOrEqual,
  [pages.BinaryOp.Equals]: BinOpType.Equals,
  [pages.BinaryOp.NotEquals]: BinOpType.NotEquals,
  [pages.BinaryOp.And]: BinOpType.And,
  [pages.BinaryOp.Or]: BinOpType.Or,
  [pages.BinaryOp.Like]: BinOpType.Like,
  [pages.BinaryOp.In]: BinOpType.In,
  [pages.BinaryOp.NotIn]: BinOpType.NotIn,
  [pages.BinaryOp.Concat]: BinOpType.Concat
}

const pageFields = keys(Entry)

class ResolveContext {
  constructor(
    public table: Table<EntryTable> | undefined,
    public expr: ExprContext = ExprContext.InNone
  ) {}

  get Table() {
    if (!this.table) throw new Error(`Cannot select without a table reference`)
    return this.table
  }

  get inSelect() {
    return this.expr & ExprContext.InSelect
  }

  get inCondition() {
    return this.expr & ExprContext.InCondition
  }

  get inAccess() {
    return this.expr & ExprContext.InAccess
  }

  get select(): ResolveContext {
    if (this.inSelect) return this
    return new ResolveContext(this.table, this.expr | ExprContext.InSelect)
  }

  get condition(): ResolveContext {
    if (this.inCondition) return this
    return new ResolveContext(this.table, this.expr | ExprContext.InCondition)
  }

  get access(): ResolveContext {
    if (this.inAccess) return this
    return new ResolveContext(this.table, this.expr | ExprContext.InAccess)
  }
}

enum ExprContext {
  InNone = 0,
  InSelect = 1 << 0,
  InCondition = 1 << 1,
  InAccess = 1 << 2
}

const POST_KEY = '$$post'

type Pre = {
  [POST_KEY]: 'richText'
  doc: TextDoc<any>
  linked: Array<{id: string; url: string}>
}

export class Resolver {
  constructor(public store: Store, public schema: Schema) {}

  fieldExpr(ctx: ResolveContext, expr: ExprData, shape: Shape): ExprData {
    if (ctx.inAccess || ctx.inCondition) return expr
    switch (true) {
      case shape instanceof RichTextShape:
        if (ctx.inAccess || ctx.inCondition)
          return new ExprData.Field(expr, 'doc')
        return new ExprData.Record({
          [POST_KEY]: new ExprData.Param(new ParamData.Value('richText')),
          doc: new ExprData.Field(expr, 'doc'),
          linked: new ExprData.Query(
            Entry(
              Entry.entryId.isIn(new Expr(new ExprData.Field(expr, 'linked')))
            ).select({
              id: Entry.entryId,
              url: Entry.url
            })[Query.Data]
          )
        })
      default:
        return expr
    }
  }

  fieldOf(
    ctx: ResolveContext,
    target: pages.TargetData,
    field: string
  ): ExprData {
    // Todo: we should make this non-ambiguous
    switch (field) {
      case 'id':
      case 'entryId':
        return ctx.Table.entryId[Expr.Data]
      case 'type':
        return ctx.Table.type[Expr.Data]
      case 'url':
        return ctx.Table.url[Expr.Data]
      case 'title':
        return ctx.Table.title[Expr.Data]
      case 'path':
        return ctx.Table.path[Expr.Data]
      case 'index':
        return ctx.Table.index[Expr.Data]
      default:
        const {name} = target
        if (!name) {
          const fields: Record<string, Expr<any>> = ctx.Table as any
          if (field in fields) return fields[field][Expr.Data]
          throw new Error(`Selecting unknown field: "${field}"`)
        }
        const type = this.schema[name]
        if (!type)
          throw new Error(`Selecting "${field}" from unknown type: "${name}"`)
        return this.fieldExpr(
          ctx,
          ctx.Table.data.get(field)[Expr.Data],
          Field.shape(Type.field(type, field)!)
        )
    }
  }

  pageFields(ctx: ResolveContext): Array<[string, ExprData]> {
    return pageFields.map(key => [key, this.fieldOf(ctx, {}, key)])
  }

  fieldsOf(
    ctx: ResolveContext,
    target: pages.TargetData
  ): Array<[string, ExprData]> {
    const {name} = target
    if (!name) return this.pageFields(ctx)
    const type = this.schema[name]
    if (!type) throw new Error(`Selecting from unknown type: "${name}"`)
    return keys(type).map(key => {
      return [key, this.fieldOf(ctx, target, key)]
    })
  }

  exprUnOp(ctx: ResolveContext, {op, expr}: pages.ExprData.UnOp): ExprData {
    return new ExprData.UnOp(unOps[op], this.expr(ctx, expr))
  }

  exprBinOp(ctx: ResolveContext, {op, a, b}: pages.ExprData.BinOp): ExprData {
    return new ExprData.BinOp(binOps[op], this.expr(ctx, a), this.expr(ctx, b))
  }

  exprField(
    ctx: ResolveContext,
    {target, field}: pages.ExprData.Field
  ): ExprData {
    return this.fieldOf(ctx, target, field)
  }

  exprAccess(
    ctx: ResolveContext,
    {expr, field}: pages.ExprData.Access
  ): ExprData {
    return new ExprData.Field(this.expr(ctx.access, expr), field)
  }

  exprValue(ctx: ResolveContext, {value}: pages.ExprData.Value): ExprData {
    return new ExprData.Param(new ParamData.Value(value))
  }

  exprRecord(ctx: ResolveContext, {fields}: pages.ExprData.Record): ExprData {
    return new ExprData.Record(
      fromEntries(
        entries(fields).map(([key, expr]) => {
          return [key, this.expr(ctx, expr)]
        })
      )
    )
  }

  expr(ctx: ResolveContext, expr: pages.ExprData): ExprData {
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
        return this.exprRecord(ctx, expr)
    }
  }

  selectRecord(
    ctx: ResolveContext,
    {fields}: pages.Selection.Record
  ): ExprData {
    return new ExprData.Record(
      fromEntries(
        fields.flatMap(field => {
          switch (field.length) {
            case 1:
              const [target] = field
              return this.fieldsOf(ctx.select, target)
            case 2:
              const [key, selection] = field
              return [[key, this.select(ctx, selection)]]
          }
        })
      )
    )
  }

  selectRow(ctx: ResolveContext, {target}: pages.Selection.Row): ExprData {
    return new ExprData.Record(fromEntries(this.fieldsOf(ctx.select, target)))
  }

  selectCursor(selection: pages.Selection.Cursor): ExprData {
    return new ExprData.Query(this.queryCursor(selection))
  }

  selectExpr(ctx: ResolveContext, {expr}: pages.Selection.Expr): ExprData {
    return this.expr(ctx.select, expr)
  }

  select(ctx: ResolveContext, selection: pages.Selection): ExprData {
    switch (selection.type) {
      case 'cursor':
        return this.selectCursor(selection)
      case 'row':
        return this.selectRow(ctx, selection)
      case 'record':
        return this.selectRecord(ctx, selection)
      case 'expr':
        return this.selectExpr(ctx, selection)
    }
  }

  queryRecord(selection: pages.Selection.Record): QueryData.Select {
    const expr = this.selectRecord(
      new ResolveContext(undefined, ExprContext.InSelect),
      selection
    )
    return new QueryData.Select({
      selection: expr,
      singleResult: true
    })
  }

  querySource(
    ctx: ResolveContext,
    source: pages.CursorSource | undefined
  ): Select<Table.Select<EntryTable>> {
    if (!source) return ctx.Table()
    const from = Entry().as(source.id)
    switch (source.type) {
      case pages.SourceType.Parent:
        return ctx.Table().where(ctx.Table.entryId.is(from.parent)).take(1)
      case pages.SourceType.Children:
        const Child = Entry().as('Child')
        const children = withRecursive(
          Child({entryId: from.entryId}).select({
            entryId: Child.entryId,
            parent: Child.parent,
            level: 0
          })
        ).unionAll(() =>
          Child()
            .select({
              entryId: Child.entryId,
              parent: Child.parent,
              level: children.level.add(1)
            })
            .innerJoin(children({entryId: Child.parent}))
            .where(children.level.isLess(source.depth))
        )
        const childrenIds = children().select(children.entryId).skip(1)
        return ctx.Table().where(ctx.Table.entryId.isIn(childrenIds))
      case pages.SourceType.Parents:
        const Parent = Entry().as('Parent')
        const parents = withRecursive(
          Parent({entryId: from.entryId}).select({
            entryId: Parent.entryId,
            parent: Parent.parent,
            level: 0
          })
        ).unionAll(() =>
          Parent()
            .select({
              entryId: Parent.entryId,
              parent: Parent.parent,
              level: parents.level.add(1)
            })
            .innerJoin(parents({parent: Parent.entryId}))
            .where(source.depth ? children.level.isLess(source.depth) : true)
        )
        const parentIds = parents().select(parents.entryId).skip(1)
        return ctx.Table().where(ctx.Table.entryId.isIn(parentIds))
      default:
        throw new Error(`Todo`)
    }
  }

  orderBy(ctx: ResolveContext, orderBy: Array<pages.OrderBy>): Array<OrderBy> {
    return orderBy.map(({expr, order}) => {
      const exprData = this.expr(ctx, expr)
      return {
        expr: exprData,
        order: order === 'Desc' ? OrderDirection.Desc : OrderDirection.Asc
      }
    })
  }

  queryCursor({cursor}: pages.Selection.Cursor): QueryData.Select {
    const {
      id,
      target,
      where,
      skip,
      take,
      orderBy,
      groupBy,
      select,
      first,
      source
    } = cursor
    const ctx = new ResolveContext(Entry().as(id), ExprContext.InNone)
    const {name} = target || {}
    let query = this.querySource(ctx, source)
    let preCondition = query[Query.Data].where
    let condition = Expr.and(
      preCondition ? new Expr(preCondition) : Expr.value(true),
      name ? ctx.Table.type.is(name) : Expr.value(true)
    )
    if (where)
      query = query.where(
        condition.and(new Expr(this.expr(ctx.condition, where)))
      )
    if (skip) query = query.skip(skip)
    if (take) query = query.take(take)
    const extra: Partial<QueryData.Select> = {}
    if (select) extra.selection = this.select(ctx.select, select)
    if (first) extra.singleResult = true
    if (groupBy) extra.groupBy = groupBy.map(expr => this.expr(ctx, expr))
    if (orderBy) extra.orderBy = this.orderBy(ctx, orderBy)
    return query[Query.Data].with(extra)
  }

  query(selection: pages.Selection): QueryData.Select {
    switch (selection.type) {
      case 'row':
        throw new Error(`Cannot select rows at root level`)
      // return this.queryRow(selection)
      case 'cursor':
        return this.queryCursor(selection)
      case 'record':
        return this.queryRecord(selection)
      case 'expr':
        throw new Error(`Cannot select expressions at root level`)
    }
  }

  postProcess(pre: Pre) {
    switch (pre[POST_KEY]) {
      case 'richText':
        const {doc, linked} = pre
        // Todo: add href into text doc
        return doc
      default:
        return pre
    }
  }

  post(interim: object): any {
    if (!interim) return interim
    if (Array.isArray(interim)) {
      return interim.map(item => this.post(item))
    }
    if (typeof interim === 'object') {
      if (POST_KEY in interim) return this.postProcess(interim as any)
      return fromEntries(
        entries(interim).map(([key, value]) => {
          return [key, this.post(value)]
        })
      )
    }
    return interim
  }

  resolve = async <T>(selection: pages.Selection<T>): Promise<T> => {
    // This validates the input, and throws if it's invalid
    assert(selection, pages.Selection.adt)
    const query = this.query(selection)
    const interim: object | Array<object> = await this.store(new Query(query))
    return this.post(interim)
  }
}
