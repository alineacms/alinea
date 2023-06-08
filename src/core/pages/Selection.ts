import {
  Infer as CInfer,
  Type as CType,
  array,
  literal,
  string,
  tuple,
  union
} from 'cito'
import {Expand, Type} from '../../core.js'
import {Cursor, CursorData} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'
import {Projection} from './Projection.js'
import {Target, TargetData} from './Target.js'
import {Tree} from './Tree.js'

export type Selection<T = any> =
  | Selection.Row
  | Selection.Record
  | Selection.Cursor
  | Selection.Expr

export namespace Selection {
  namespace types {
    export class Row {
      type = literal('row')
      target = TargetData
    }
    export class Record {
      type = literal('record')
      fields = array(union(tuple(string, adt), tuple(TargetData)))
    }
    export class Cursor {
      type = literal('cursor')
      cursor = CursorData
    }
    export class Expr {
      type = literal('expr')
      expr = ExprData.adt
    }
  }
  export interface Row extends CInfer<types.Row> {}
  export function Row(target: TargetData): Selection.Row {
    return {type: 'row', target}
  }
  export interface Record extends CInfer<types.Record> {}
  export function Record(
    fields: Array<[string, Selection] | [TargetData]>
  ): Selection.Record {
    return {type: 'record', fields}
  }
  export interface Cursor extends CInfer<types.Cursor> {}
  export function Cursor(cursor: CursorData): Selection.Cursor {
    return {type: 'cursor', cursor}
  }
  export interface Expr extends CInfer<types.Expr> {}
  export function Expr(expr: ExprData): Selection.Expr {
    return {type: 'expr', expr}
  }
  export const adt: CType<Selection> = union(
    types.Row,
    types.Record,
    types.Cursor,
    types.Expr
  )

  export type Infer<T> = Projection.Infer<T>
  export type Combine<A, B> = Expand<Omit<A, keyof Infer<B>> & Infer<B>>

  export function create(input: any, sourceId?: string) {
    return Type.isType(input) ? fromInput(input()) : fromInput(input, sourceId)
  }
}

function fromInput(input: any, sourceId?: string): Selection {
  if (input === null || input === undefined)
    return Selection.Expr(ExprData.Value(null))
  if (Cursor.isCursor(input)) return Selection.Cursor(input[Cursor.Data])
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return Selection.Expr(input[Expr.Data])
  if (Type.isType(input)) return Selection.Row({type: Type.target(input)})
  if (Target.isTarget(input)) return Selection.Row(input[Target.Data])
  if (typeof input === 'function') {
    if (!sourceId) throw new Error('sourceId is required for function queries')
    return fromInput(input(new Tree(sourceId)))
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const keys = Object.keys(input)
    return Selection.Record(
      keys.map(key => {
        if (key.startsWith('@@@')) return [input[key]]
        return [key, fromInput(input[key], sourceId)]
      })
    )
  }
  return Selection.Expr(ExprData.Value(input))
}
