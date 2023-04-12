import {array, literal, string, tuple, union} from 'cito'
import {Cursor, CursorData} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'
import {Projection} from './Projection.js'
import {Target, TargetData} from './Target.js'
import {Tree} from './Tree.js'

export type QueryData = typeof QueryData.adt.infer

export function QueryData(input: any, sourceId?: string): QueryData {
  if (input === null || input === undefined)
    return QueryData.Expr(ExprData.Value(null))
  if (Cursor.isCursor(input)) return QueryData.Cursor(input[Cursor.Data])
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return QueryData.Expr(input[Expr.Data])
  if (Target.isTarget(input)) return QueryData.Row(input[Target.Data])
  if (typeof input === 'function') {
    if (!sourceId) throw new Error('sourceId is required for function queries')
    return QueryData(input(new Tree(sourceId)))
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const keys = Object.keys(input)
    return QueryData.Record(
      keys.map(key => {
        if (key.startsWith('@@@')) return [input[key]]
        return [key, QueryData(input[key], sourceId)]
      })
    )
  }
  return QueryData.Expr(ExprData.Value(input))
}

export namespace QueryData {
  class QRow {
    type = literal('row')
    target = TargetData
  }
  export function Row(target: TargetData): QueryData {
    return {type: 'row', target}
  }
  class QRecord {
    type = literal('record')
    fields = array(union(tuple(string, adt), tuple(TargetData)))
  }
  export function Record(
    fields: Array<[string, QueryData] | [TargetData]>
  ): QueryData {
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
  export const adt = union(QRow, QRecord, QCursor, QExpr)
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
