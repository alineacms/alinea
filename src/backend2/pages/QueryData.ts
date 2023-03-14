import {
  any,
  array,
  boolean,
  enums,
  literal,
  number,
  object,
  record,
  string,
  union
} from 'cito'

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

export type ExprData = typeof ExprData.adt.infer
export namespace ExprData {
  class EUnOp {
    type = literal('unop')
    op = enums(UnaryOp)
    expr = adt
  }
  export function UnOp(op: UnaryOp, expr: ExprData): ExprData {
    return {type: 'unop', op, expr}
  }
  class EBinOp {
    type = literal('binop')
    a = adt
    op = enums(BinaryOp)
    b = adt
  }
  export function BinOp(a: ExprData, op: BinaryOp, b: ExprData): ExprData {
    return {type: 'binop', a, op, b}
  }
  class EField {
    type = literal('field')
    target = TargetData
    field = string
  }
  export function Field(target: TargetData, field: string): ExprData {
    return {type: 'field', target, field}
  }
  class EAccess {
    type = literal('access')
    expr = adt
    field = string
  }
  export function Access(expr: ExprData, field: string): ExprData {
    return {type: 'access', expr, field}
  }
  class EValue {
    type = literal('value')
    value = any
  }
  export function Value(value: any): ExprData {
    return {type: 'value', value}
  }
  class ERecord {
    type = literal('record')
    fields = record(adt)
  }
  export function Record(fields: Record<string, ExprData>): ExprData {
    return {type: 'record', fields}
  }
  export const adt = union(EUnOp, EBinOp, EField, EAccess, EValue, ERecord)
}

export type TargetData = typeof TargetData.infer
export const TargetData = object({
  name: string.optional,
  alias: string.optional
})

export enum TraverseType {
  Children = 'children',
  Parents = 'parents',
  Next = 'next',
  Previous = 'previous'
}

export type CursorData = typeof CursorData.infer
export const CursorData = object(
  class CursorData {
    target = TargetData.optional
    where = ExprData.adt.optional
    skip = number.optional
    take = number.optional
    orderBy = array(ExprData.adt).optional
    select = QueryData.adt.optional
    first = boolean.optional
    traverse = Traverse.optional
  }
)

export const Traverse = object({
  type: enums(TraverseType),
  cursor: CursorData
})

export type QueryData = typeof QueryData.adt.infer
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
