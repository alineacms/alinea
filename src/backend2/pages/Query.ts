import {Cursor, CursorData} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'

const {entries, fromEntries} = Object

export type QueryData =
  | [type: 'record', fields: Record<string, QueryData>]
  | [type: 'cursor', cursor: CursorData]
  | [type: 'expr', expr: ExprData]

export function QueryData(input: any): QueryData {
  if (input === null || input === undefined)
    return Query('expr', ['value', null])
  if (Cursor.isCursor(input)) return Query('cursor', input[Cursor.Data])
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return Query('expr', input[Expr.Data])
  if (input && typeof input === 'object' && !Array.isArray(input))
    return Query(
      'record',
      fromEntries(entries(input).map(([key, value]) => [key, QueryData(value)]))
    )
  return Query('expr', ['value', input])
}

export namespace Query {
  export type Infer<T> = [T] extends [Cursor<infer V>]
    ? V
    : [T] extends [Expr<infer V>]
    ? V
    : [T] extends [object]
    ? {[K in keyof T]: Infer<T[K]>}
    : T extends () => any
    ? never
    : unknown extends T
    ? never
    : T
  type Expand<T> = {[K in keyof T]: T[K]} & {}
  export type Combine<A, B> = Expand<Omit<A, keyof Infer<B>> & Infer<B>>
}

export type Query<T> = QueryData

export function Query<T>(...data: QueryData): Query<T> {
  return data
}
