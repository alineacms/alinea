import * as cito from 'cito'
import {TypeTarget} from '../Type.js'
import {Expand} from '../util/Types.js'
import type {Projection} from './Projection.js'

export type Selection<T = any> =
  | Selection.Row
  | Selection.Record
  | Selection.Cursor
  | Selection.Expr
  | Selection.Count

export namespace Selection {
  namespace types {
    export class Row {
      type = cito.literal('row')
      target = TargetData
    }
    export class Record {
      type = cito.literal('record')
      fields = cito.array(
        cito.union(cito.tuple(cito.string, adt), cito.tuple(TargetData))
      )
    }
    export class Cursor {
      type = cito.literal('cursor')
      cursor = CursorData
    }
    export class Expr {
      type = cito.literal('expr')
      expr = ExprData.adt
      fromParent = cito.boolean
    }
    export class Count {
      type = cito.literal('count')
    }
  }
  export interface Row extends cito.Infer<types.Row> {}
  export function Row(target: TargetData): Selection.Row {
    return {type: 'row', target}
  }
  export interface Record extends cito.Infer<types.Record> {}
  export function Record(
    fields: Array<[string, Selection] | [TargetData]>
  ): Selection.Record {
    return {type: 'record', fields}
  }
  export interface Cursor extends cito.Infer<types.Cursor> {}
  export function Cursor(cursor: CursorData): Selection.Cursor {
    return {type: 'cursor', cursor}
  }
  export interface Expr extends cito.Infer<types.Expr> {}
  export function Expr(expr: ExprData, fromParent = false): Selection.Expr {
    return {type: 'expr', expr, fromParent}
  }
  export interface Count extends cito.Infer<types.Count> {}
  export function Count(): Selection.Count {
    return {type: 'count'}
  }
  export const adt: cito.Type<Selection> = cito.union(
    types.Row,
    types.Record,
    types.Cursor,
    types.Expr,
    types.Count
  )

  export type Infer<T> = Projection.Infer<T>
  export type Combine<A, B> = Expand<Omit<A, keyof Infer<B>> & Infer<B>>
}

export enum OrderDirection {
  Asc = 'Asc',
  Desc = 'Desc'
}

export type OrderBy = typeof OrderBy.infer
export const OrderBy = cito.object(
  class {
    expr = ExprData.adt
    order = cito.enums(OrderDirection)
  }
)

export type CursorData = typeof CursorData.infer
export const CursorData = cito.object(
  class {
    target? = TargetData.optional
    where? = ExprData.adt.optional
    searchTerms? = cito.array(cito.string).optional
    skip? = cito.number.optional
    take? = cito.number.optional
    orderBy? = cito.array(OrderBy).optional
    groupBy? = cito.array(ExprData.adt).optional
    select? = Selection.adt.optional
    first? = cito.boolean.optional
    source? = CursorSource.optional
  }
)

export enum SourceType {
  Children = 'Children',
  Siblings = 'Siblings',
  Translations = 'Translations',
  Parents = 'Parents',
  Parent = 'Parent',
  Next = 'Next',
  Previous = 'Previous'
}

export type CursorSource = typeof CursorSource.infer
export const CursorSource = cito.object(
  class {
    type = cito.enums(SourceType)
    // id = string
    depth? = cito.number.optional
    includeSelf? = cito.boolean.optional
  }
)

export enum UnaryOp {
  Not = 'Not',
  IsNull = 'IsNull'
}

export enum BinaryOp {
  Add = 'Add',
  Subt = 'Subt',
  Mult = 'Mult',
  Mod = 'Mod',
  Div = 'Div',
  Greater = 'Greater',
  GreaterOrEqual = 'GreaterOrEqual',
  Less = 'Less',
  LessOrEqual = 'LessOrEqual',
  Equals = 'Equals',
  NotEquals = 'NotEquals',
  And = 'And',
  Or = 'Or',
  Like = 'Like',
  In = 'In',
  NotIn = 'NotIn',
  Concat = 'Concat'
}

export type ExprData =
  | ExprData.UnOp
  | ExprData.BinOp
  | ExprData.Field
  | ExprData.Access
  | ExprData.Value
  | ExprData.Record
  | ExprData.Case
  | ExprData.Call

export namespace ExprData {
  namespace types {
    export class UnOp {
      type = cito.literal('unop')
      op = cito.enums(UnaryOp)
      expr = adt
    }
    export class BinOp {
      type = cito.literal('binop')
      a = adt
      op = cito.enums(BinaryOp)
      b = adt
    }
    export class Field {
      type = cito.literal('field')
      target = TargetData
      field = cito.string
    }
    export class Access {
      type = cito.literal('access')
      expr = adt
      field = cito.string
    }
    export class Value {
      type = cito.literal('value')
      value = cito.any
    }
    export class Record {
      type = cito.literal('record')
      fields = cito.record(adt)
    }
    export class Case {
      type = cito.literal('case')
      expr = adt
      cases = cito.array(cito.tuple(adt, Selection.adt))
      defaultCase? = Selection.adt.optional
    }
    export class Call {
      type = cito.literal('call')
      method = cito.string
      args = cito.array(adt)
    }
  }
  export interface UnOp extends cito.Infer<types.UnOp> {}
  export function UnOp(op: UnaryOp, expr: ExprData): ExprData {
    return {type: 'unop', op, expr}
  }
  export interface BinOp extends cito.Infer<types.BinOp> {}
  export function BinOp(a: ExprData, op: BinaryOp, b: ExprData): ExprData {
    return {type: 'binop', a, op, b}
  }
  export interface Field extends cito.Infer<types.Field> {}
  export function Field(target: TargetData, field: string): ExprData {
    return {type: 'field', target, field}
  }
  export interface Access extends cito.Infer<types.Access> {}
  export function Access(expr: ExprData, field: string): ExprData {
    return {type: 'access', expr, field}
  }
  export interface Value extends cito.Infer<types.Value> {}
  export function Value(value: any): ExprData {
    return {type: 'value', value}
  }
  export interface Record extends cito.Infer<types.Record> {}
  export function Record(fields: {[k: string]: ExprData}): ExprData {
    return {type: 'record', fields}
  }
  export interface Case extends cito.Infer<types.Case> {}
  export function Case(
    expr: ExprData,
    cases: Array<[ExprData, Selection]>,
    defaultCase?: Selection
  ): ExprData {
    return {type: 'case', expr, cases, defaultCase}
  }
  export interface Call extends cito.Infer<types.Call> {}
  export function Call(method: string, args: Array<ExprData>): ExprData {
    return {type: 'call', method, args}
  }
  export const adt: cito.Type<ExprData> = cito.union(
    types.UnOp,
    types.BinOp,
    types.Field,
    types.Access,
    types.Value,
    types.Record,
    types.Case,
    types.Call
  )
}

const TT = cito.type(
  (value): value is TypeTarget => value && typeof value === 'object'
)

export type TargetData = typeof TargetData.infer
export const TargetData = cito.object(
  class {
    name? = cito.string.optional
    // alias? = string.optional
    type? = TT.optional
  }
)

export const toSelection = Symbol.for('@alinea/toSelection')
export const toExpr = Symbol.for('@alinea/toExpr')
export const targetData = Symbol.for('@alinea/targetData')
