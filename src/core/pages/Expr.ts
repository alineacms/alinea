import {Infer, any, enums, literal, record, string, union} from 'cito'
import {Cursor} from './Cursor.js'
import {TargetData} from './Target.js'

const {entries, fromEntries} = Object

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

export function ExprData(input: any): ExprData {
  if (input === null || input === undefined) return ExprData.Value(null)
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return input[Expr.Data]
  if (input && typeof input === 'object' && !Array.isArray(input))
    return ExprData.Record(
      fromEntries(entries(input).map(([key, value]) => [key, ExprData(value)]))
    )
  return ExprData.Value(input)
}

export namespace ExprData {
  const types = {
    UnOp: class {
      type = literal('unop')
      op = enums(UnaryOp)
      expr = adt
    },
    BinOp: class {
      type = literal('binop')
      a = adt
      op = enums(BinaryOp)
      b = adt
    },
    Field: class {
      type = literal('field')
      target = TargetData
      field = string
    },
    Access: class {
      type = literal('access')
      expr = adt
      field = string
    },
    Value: class {
      type = literal('value')
      value = any
    },
    Record: class {
      type = literal('record')
      fields = record(adt)
    }
  }
  export type UnOp = Infer<typeof types.UnOp>
  export function UnOp(op: UnaryOp, expr: ExprData): ExprData {
    return {type: 'unop', op, expr}
  }
  export type BinOp = Infer<typeof types.BinOp>
  export function BinOp(a: ExprData, op: BinaryOp, b: ExprData): ExprData {
    return {type: 'binop', a, op, b}
  }
  export type Field = Infer<typeof types.Field>
  export function Field(target: TargetData, field: string): ExprData {
    return {type: 'field', target, field}
  }
  export type Access = Infer<typeof types.Access>
  export function Access(expr: ExprData, field: string): ExprData {
    return {type: 'access', expr, field}
  }
  export type Value = Infer<typeof types.Value>
  export function Value(value: any): ExprData {
    return {type: 'value', value}
  }
  export type Record = Infer<typeof types.Record>
  export function Record(fields: {[k: string]: ExprData}): ExprData {
    return {type: 'record', fields}
  }
  export const adt = union(
    types.UnOp,
    types.BinOp,
    types.Field,
    types.Access,
    types.Value,
    types.Record
  )
}

/** Expression or value of type T */
export type EV<T> = Expr<T> | T

export interface Expr<T> extends ExprI<T> {}

export function Expr<T>(expr: ExprData): Expr<T> {
  return new ExprI(expr)
}

export interface ExprI<T> {
  [Expr.Data]: ExprData
  [Expr.IsExpr]: boolean
}

export class ExprI<T> {
  constructor(expr: ExprData) {
    this[Expr.Data] = expr
    this[Expr.IsExpr] = true
  }

  /*asc(): OrderBy {
    return {expr: this[Expr.Data], order: OrderDirection.Asc}
  }

  desc(): OrderBy {
    return {expr: this[Expr.Data], order: OrderDirection.Desc}
  }*/

  not(): Expr<boolean> {
    return Expr(ExprData.UnOp(UnaryOp.Not, this[Expr.Data]))
  }

  or(this: Expr<boolean>, that: EV<boolean>): Expr<boolean> {
    const a = this
    const b = Expr.create(that)
    if (b.isConstant(true) || a.isConstant(false)) return b
    if (a.isConstant(true) || b.isConstant(false)) return this
    return Expr(ExprData.BinOp(a[Expr.Data], BinaryOp.Or, b[Expr.Data]))
  }

  and(this: Expr<boolean>, that: EV<boolean>): Expr<boolean> {
    const a = this
    const b = Expr.create(that)
    if (b.isConstant(true) || a.isConstant(false)) return this
    if (a.isConstant(true) || b.isConstant(false)) return b
    return Expr(ExprData.BinOp(a[Expr.Data], BinaryOp.And, b[Expr.Data]))
  }

  is(that: EV<T>): Expr<boolean> {
    if (that === null || (Expr.isExpr(that) && that.isConstant(null!)))
      return this.isNull()
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Equals, ExprData(that))
    )
  }

  isConstant(value: T): boolean {
    const expr = this[Expr.Data]
    switch (expr.type) {
      case 'value':
        return expr.value === value
      default:
        return false
    }
  }

  isNot(that: EV<T>): Expr<boolean> {
    if (that === null || (Expr.isExpr(that) && that.isConstant(null!)))
      return this.isNotNull()
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.NotEquals, ExprData(that))
    )
  }

  isNull(): Expr<boolean> {
    return Expr(ExprData.UnOp(UnaryOp.IsNull, this[Expr.Data]))
  }

  isNotNull(): Expr<boolean> {
    return this.isNull().not()
  }

  isIn(that: EV<ReadonlyArray<T>> | Cursor.Find<T>): Expr<boolean> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.In, ExprData(that)))
  }

  isNotIn(that: EV<ReadonlyArray<T>> | Cursor.Find<T>): Expr<boolean> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.NotIn, ExprData(that)))
  }

  isGreater(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Greater, ExprData(that))
    )
  }

  isGreaterOrEqual(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.GreaterOrEqual, ExprData(that))
    )
  }

  isLess(that: EV<any>): Expr<boolean> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Less, ExprData(that)))
  }

  isLessOrEqual(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.LessOrEqual, ExprData(that))
    )
  }

  add(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Add, ExprData(that)))
  }

  substract(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Subt, ExprData(that)))
  }

  multiply(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Mult, ExprData(that)))
  }

  remainder(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Mod, ExprData(that)))
  }

  divide(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Div, ExprData(that)))
  }

  concat(this: Expr<string>, that: EV<string>): Expr<string> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Concat, ExprData(that))
    )
  }

  like(this: Expr<string>, that: EV<string>): Expr<boolean> {
    return Expr(ExprData.BinOp(this[Expr.Data], BinaryOp.Like, ExprData(that)))
  }

  /*dynamic<X = T>(...path: Array<string>): Fields<X> {
    return new Proxy<any>(
      (...args: Array<any>) => {
        const method = path[path.length - 1]
        const e: any =
          path.length > 1 ? this.get(path.slice(0, -1).join('.')) : this
        return e[method]?.apply(e, args)
      },
      {
        get: (_, key) => {
          const e: any = path.length > 0 ? this.get(path.join('.')) : this
          if (typeof key !== 'string') return e[key]
          return this.dynamic(...path, key)
        }
      }
    )
  }*/

  at<T>(this: Expr<Array<T>>, index: number): Expr<T | null> {
    return this.get(`[${Number(index)}]`)
  }

  /*includes<T>(this: Expr<Array<T>>, value: EV<T>): Expr<boolean> {
    return Expr(value).isIn(this)
  }*/

  sure(): Expr<NonNullable<T>> {
    return this as any
  }

  get<T>(name: string): Expr<T> {
    return Expr(ExprData.Access(this[Expr.Data], name))
  }

  toJSON() {
    return this[Expr.Data]
  }
}

export function and(...conditions: Array<EV<boolean>>): Expr<boolean> {
  return conditions
    .map(Expr.create)
    .reduce(
      (condition, expr) => condition.and(expr),
      Expr(ExprData.Value(true))
    )
}

export function or(...conditions: Array<EV<boolean>>): Expr<boolean> {
  return conditions
    .map(Expr.create)
    .reduce(
      (condition, expr) => condition.or(expr),
      Expr(ExprData.Value(false))
    )
}

export namespace Expr {
  export const Data = Symbol.for('@alinea/Expr.Data')
  export const IsExpr = Symbol.for('@alinea/Expr.IsExpr')
  export const ToExpr = Symbol.for('@alinea/Expr.ToExpr')
  export const NULL = create(null)

  /*export function value<T>(value: T): Expr<T> {
    return new Expr<T>(new ExprData.Param(new ParamData.Value(value)))
  }*/

  export function create<T>(input: EV<T>): Expr<T> {
    if (isExpr<T>(input)) return input
    return Expr(ExprData.Value(input))
  }

  export function hasExpr<T>(input: any): input is {[Expr.ToExpr](): Expr<T>} {
    return (
      input &&
      (typeof input === 'function' || typeof input === 'object') &&
      input[Expr.ToExpr]
    )
  }

  export function isExpr<T>(input: any): input is Expr<T> {
    return (
      input !== null &&
      (typeof input === 'object' || typeof input === 'function') &&
      input[Expr.IsExpr]
    )
  }
}
