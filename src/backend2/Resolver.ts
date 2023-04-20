import {Config, Field} from 'alinea/core'
import {assert} from 'cito'
import {
  BinOpType,
  Expr,
  ExprData,
  ParamData,
  Query,
  QueryData,
  Table,
  UnOpType
} from 'rado'
import {Select, SelectFirst} from 'rado/define/query/Select'
import {Store} from './Store.js'
import {EntryTree} from './collection/EntryTree.js'

import * as pages from './pages/index.js'

const {keys, entries, fromEntries} = Object

const entryTarget = EntryTree[Table.Data]

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

const pageFields = keys(pages.Page)

enum ResolveContext {
  Select = 0,
  Condition = 1 << 0
}

class Resolver {
  constructor(public store: Store, public config: Config) {}

  fieldExpr(
    ctx: ResolveContext,
    expr: ExprData,
    field: Field<any, any>
  ): ExprData {
    throw 'todo'
  }

  fieldOf(
    ctx: ResolveContext,
    target: pages.TargetData,
    field: string
  ): ExprData {
    switch (field) {
      case 'id':
        return EntryTree.entryId[Expr.Data]
      case 'type':
        return EntryTree.type[Expr.Data]
      case 'url':
        return EntryTree.url[Expr.Data]
      case 'title':
        return EntryTree.title[Expr.Data]
      case 'path':
        return EntryTree.path[Expr.Data]
      default:
        const {name, alias} = target
        if (!name) throw new Error(`Unknown field: "${field}"`)
        const type = this.config.type(name)
        if (!type)
          throw new Error(`Selecting "${field}" from unknown type: "${name}"`)
        return this.fieldExpr(
          ctx,
          EntryTree.data.get(field)[Expr.Data],
          type.field(field)
        )
    }
  }

  pageFields(ctx: ResolveContext, alias?: string): Array<[string, ExprData]> {
    return pageFields.map(key => [key, this.fieldOf(ctx, {alias}, key)])
  }

  fieldsOf(
    ctx: ResolveContext,
    target: pages.TargetData
  ): Array<[string, ExprData]> {
    const {name, alias} = target
    if (!name) return this.pageFields(ctx, alias)
    const type = this.config.type(name)
    if (!type) throw new Error(`Selecting from unknown type: "${name}"`)
    return keys(type.fields).map(key => {
      return [key, this.fieldOf(ctx, target, key)]
    })
  }

  queryOf(ctx: ResolveContext, target?: pages.TargetData) {
    if (!target) return EntryTree()
    const {name, alias} = target
    const Table = alias ? EntryTree().as(alias) : EntryTree
    return Table().where(name ? Table.type.is(name) : true)
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
    return new ExprData.Field(this.expr(ctx, expr), field)
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

  selectRecord({fields}: pages.Selection.Record): ExprData {
    return new ExprData.Record(
      fromEntries(
        fields.flatMap(field => {
          switch (field.length) {
            case 1:
              const [target] = field
              return this.fieldsOf(ResolveContext.Select, target)
            case 2:
              const [key, selection] = field
              return [[key, this.select(selection)]]
          }
        })
      )
    )
  }

  selectRow({target}: pages.Selection.Row): ExprData {
    return new ExprData.Record(
      fromEntries(this.fieldsOf(ResolveContext.Select, target))
    )
  }

  selectCursor(selection: pages.Selection.Cursor): ExprData {
    return new ExprData.Query(this.queryCursor(selection))
  }

  selectExpr({expr}: pages.Selection.Expr): ExprData {
    return this.expr(ResolveContext.Select, expr)
  }

  select(selection: pages.Selection): ExprData {
    switch (selection.type) {
      case 'row':
        return this.selectRow(selection)
      case 'cursor':
        return this.selectCursor(selection)
      case 'record':
        return this.selectRecord(selection)
      case 'expr':
        return this.selectExpr(selection)
    }
  }

  queryRow(selection: pages.Selection.Row): QueryData.Select {
    return this.queryOf(ResolveContext.Select, selection.target).select(
      this.selectRow(selection)
    )[Query.Data]
  }

  queryRecord(selection: pages.Selection.Record): QueryData.Select {
    return EntryTree().select(this.selectRecord(selection))[Query.Data]
  }

  queryCursor({cursor}: pages.Selection.Cursor): QueryData.Select {
    const {target, where, skip, take, orderBy, select, first, source} = cursor
    let query: Select<any> | SelectFirst<any> = this.queryOf(
      ResolveContext.Select,
      target
    )
    if (where)
      query = query.where(new Expr(this.expr(ResolveContext.Condition, where)))
    if (skip) query = query.skip(skip)
    if (take) query = query.take(take)
    if (first) query = query.first()
    if (select) query = query.select(this.select(select))
    // if (orderBy)
    // if (source)
    return query[Query.Data]
  }

  query(selection: pages.Selection): QueryData.Select {
    switch (selection.type) {
      case 'row':
        return this.queryRow(selection)
      case 'cursor':
        return this.queryCursor(selection)
      case 'record':
        return this.queryRecord(selection)
      case 'expr':
        throw new Error(`Cannot select expressions at root level`)
    }
  }

  async resolve<T>(selection: pages.Selection<T>): Promise<T> {
    // This validates the input, and throws if it's invalid
    assert(selection, pages.Selection.adt)
    const query = this.query(selection)
    return this.store(new Query(query))
  }
}
