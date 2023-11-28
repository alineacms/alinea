import {
  Infer as CInfer,
  Type as CType,
  array,
  boolean,
  literal,
  string,
  tuple,
  union
} from 'cito'
import {Expand} from '../util/Types.js'
import {CursorData} from './Cursor.js'
import {ExprData} from './ExprData.js'
import {Projection} from './Projection.js'
import {TargetData} from './TargetData.js'

export type Selection<T = any> =
  | Selection.Row
  | Selection.Record
  | Selection.Cursor
  | Selection.Expr
  | Selection.Count

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
      fromParent = boolean
    }
    export class Count {
      type = literal('count')
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
  export function Expr(expr: ExprData, fromParent = false): Selection.Expr {
    return {type: 'expr', expr, fromParent}
  }
  export interface Count extends CInfer<types.Count> {}
  export function Count(): Selection.Count {
    return {type: 'count'}
  }
  export const adt: CType<Selection> = union(
    types.Row,
    types.Record,
    types.Cursor,
    types.Expr,
    types.Count
  )

  export type Infer<T> = Projection.Infer<T>
  export type Combine<A, B> = Expand<Omit<A, keyof Infer<B>> & Infer<B>>
}
