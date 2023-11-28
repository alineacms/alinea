import {
  Infer,
  Type,
  any,
  array,
  enums,
  literal,
  record,
  string,
  tuple,
  union
} from 'cito'
import {Selection} from './Selection.js'
import {TargetData} from './TargetData.js'

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

export namespace ExprData {
  namespace types {
    export class UnOp {
      type = literal('unop')
      op = enums(UnaryOp)
      expr = adt
    }
    export class BinOp {
      type = literal('binop')
      a = adt
      op = enums(BinaryOp)
      b = adt
    }
    export class Field {
      type = literal('field')
      target = TargetData
      field = string
    }
    export class Access {
      type = literal('access')
      expr = adt
      field = string
    }
    export class Value {
      type = literal('value')
      value = any
    }
    export class Record {
      type = literal('record')
      fields = record(adt)
    }
    export class Case {
      type = literal('case')
      expr = adt
      cases = array(tuple(adt, Selection.adt))
      defaultCase? = Selection.adt.optional
    }
  }
  export interface UnOp extends Infer<types.UnOp> {}
  export function UnOp(op: UnaryOp, expr: ExprData): ExprData {
    return {type: 'unop', op, expr}
  }
  export interface BinOp extends Infer<types.BinOp> {}
  export function BinOp(a: ExprData, op: BinaryOp, b: ExprData): ExprData {
    return {type: 'binop', a, op, b}
  }
  export interface Field extends Infer<types.Field> {}
  export function Field(target: TargetData, field: string): ExprData {
    return {type: 'field', target, field}
  }
  export interface Access extends Infer<types.Access> {}
  export function Access(expr: ExprData, field: string): ExprData {
    return {type: 'access', expr, field}
  }
  export interface Value extends Infer<types.Value> {}
  export function Value(value: any): ExprData {
    return {type: 'value', value}
  }
  export interface Record extends Infer<types.Record> {}
  export function Record(fields: {[k: string]: ExprData}): ExprData {
    return {type: 'record', fields}
  }
  export interface Case extends Infer<types.Case> {}
  export function Case(
    expr: ExprData,
    cases: Array<[ExprData, Selection]>,
    defaultCase?: Selection
  ): ExprData {
    return {type: 'case', expr, cases, defaultCase}
  }
  export const adt: Type<ExprData> = union(
    types.UnOp,
    types.BinOp,
    types.Field,
    types.Access,
    types.Value,
    types.Record,
    types.Case
  )
}
