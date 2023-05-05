import {array, literal, object, string, tuple, union} from 'cito'
import {Expand, Type} from '../../core.js'
import {Cursor, CursorData} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'
import {Projection} from './Projection.js'
import {Target, TargetData} from './Target.js'
import {Tree} from './Tree.js'

export type Selection<T = any> = typeof Selection.adt.infer

export function Selection(input: any, sourceId?: string): Selection {
  if (input === null || input === undefined)
    return Selection.Expr(ExprData.Value(null))
  if (Cursor.isCursor(input)) return Selection.Cursor(input[Cursor.Data])
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return Selection.Expr(input[Expr.Data])
  if (Type.isType(input)) return Selection.Row({type: Type.target(input)})
  if (Target.isTarget(input)) return Selection.Row(input[Target.Data])
  if (typeof input === 'function') {
    if (!sourceId) throw new Error('sourceId is required for function queries')
    return Selection(input(new Tree(sourceId)))
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const keys = Object.keys(input)
    return Selection.Record(
      keys.map(key => {
        if (key.startsWith('@@@')) return [input[key]]
        return [key, Selection(input[key], sourceId)]
      })
    )
  }
  return Selection.Expr(ExprData.Value(input))
}

export namespace Selection {
  const types = {
    Row: object(
      class {
        type = literal('row')
        target = TargetData
      }
    ),
    Record: object(
      class {
        type = literal('record')
        fields = array(union(tuple(string, adt), tuple(TargetData)))
      }
    ),
    Cursor: object(
      class {
        type = literal('cursor')
        cursor = CursorData
      }
    ),
    Expr: object(
      class {
        type = literal('expr')
        expr = ExprData.adt
      }
    )
  }
  export type Row = typeof types.Row.infer
  export function Row(target: TargetData): Selection.Row {
    return {type: 'row', target}
  }
  export type Record = typeof types.Record.infer
  export function Record(
    fields: Array<[string, Selection] | [TargetData]>
  ): Selection.Record {
    return {type: 'record', fields}
  }
  export type Cursor = typeof types.Cursor.infer
  export function Cursor(cursor: CursorData): Selection.Cursor {
    return {type: 'cursor', cursor}
  }
  export type Expr = typeof types.Expr.infer
  export function Expr(expr: ExprData): Selection.Expr {
    return {type: 'expr', expr}
  }
  export const adt = union(types.Row, types.Record, types.Cursor, types.Expr)

  export type Infer<T> = Projection.Infer<T>
  export type Combine<A, B> = Expand<Omit<A, keyof Infer<B>> & Infer<B>>
}
