import {literal, record, union} from 'cito'
import {Cursor, CursorData} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'
import {Projection} from './Projection.js'

const {entries, fromEntries} = Object

export type QueryData = typeof QueryData.adt.infer

export function QueryData(input: any): QueryData {
  if (input === null || input === undefined)
    return QueryData.Expr(ExprData.Value(null))
  if (Cursor.isCursor(input)) return QueryData.Cursor(input[Cursor.Data])
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return QueryData.Expr(input[Expr.Data])
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return QueryData.Record(
      fromEntries(entries(input).map(([key, value]) => [key, QueryData(value)]))
    )
  }
  return QueryData.Expr(ExprData.Value(input))
}

export namespace QueryData {
  class QRecord {
    type = literal('record')
    fields = record(adt)
  }
  export function Record(fields: Record<string, QueryData>): QueryData {
    return {type: 'record', fields}
  }
  class QCursor {
    type = literal('cursor')
    cursor = CursorData
  }
  export function Cursor(cursor: CursorData): QueryData {
    return {type: 'cursor', cursor}
  }
  class QExpr {
    type = literal('expr')
    expr = ExprData.adt
  }
  export function Expr(expr: ExprData): QueryData {
    return {type: 'expr', expr}
  }
  export const adt = union(QRecord, QCursor, QExpr)
}

export namespace Query {
  export type Infer<T> = Projection.Infer<T>
  type Expand<T> = {[K in keyof T]: T[K]} & {}
  export type Combine<A, B> = Expand<Omit<A, keyof Infer<B>> & Infer<B>>
}

export type Query<T> = QueryData

export function Query<T>(data: QueryData): Query<T> {
  return data
}
