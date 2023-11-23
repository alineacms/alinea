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
import {Cursor, OrderBy, OrderDirection} from './Cursor.js'
import {Projection} from './Projection.js'
import {Selection} from './Selection.js'
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

export type ExprData =
  | ExprData.UnOp
  | ExprData.BinOp
  | ExprData.Field
  | ExprData.Access
  | ExprData.Value
  | ExprData.Record
  | ExprData.Case

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

  asc(): OrderBy {
    return {expr: this[Expr.Data], order: OrderDirection.Asc}
  }

  desc(): OrderBy {
    return {expr: this[Expr.Data], order: OrderDirection.Desc}
  }

  not(): Expr<boolean> {
    return Expr(ExprData.UnOp(UnaryOp.Not, this[Expr.Data]))
  }

  or(this: Expr<boolean>, ...that: Array<EV<boolean>>): Expr<boolean> {
    let res = this
    if (this.isConstant(true)) return res
    for (const e of that) {
      const expr = Expr.create(e)
      if (expr.isConstant(true)) return expr
      if (expr.isConstant(false)) continue
      res = Expr(ExprData.BinOp(res[Expr.Data], BinaryOp.Or, expr[Expr.Data]))
    }
    return res
  }

  and(this: Expr<boolean>, ...that: Array<EV<boolean>>): Expr<boolean> {
    let res = this
    if (this.isConstant(false)) return res
    for (const e of that) {
      const expr = Expr.create(e)
      if (expr.isConstant(false)) return expr
      if (expr.isConstant(true)) continue
      res = Expr(ExprData.BinOp(res[Expr.Data], BinaryOp.And, expr[Expr.Data]))
    }
    return res
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

  when<S extends Projection>(
    expr: EV<T>,
    select: S
  ): CaseBuilder<T, Projection.Infer<S>> {
    return new CaseBuilder(this).when(expr, select)
  }

  at<T>(this: Expr<Array<T>>, index: number): Expr<T | null> {
    return this.get(`[${Number(index)}]`)
  }

  includes<T>(this: Expr<Array<T>>, value: EV<T>): Expr<boolean> {
    return Expr(ExprData(value)).isIn(this)
  }

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

export class CaseBuilder<T, Res> {
  constructor(
    protected expr: Expr<T>,
    protected cases: Array<[ExprData, Selection]> = []
  ) {}

  when<S extends Projection>(
    expr: EV<T>,
    select: S
  ): CaseBuilder<T, Res | Projection.Infer<S>> {
    return new CaseBuilder(
      this.expr,
      this.cases.concat([
        [Expr.create(expr)[Expr.Data], Selection.create(select)]
      ])
    )
  }

  orElse<S extends Projection>(select: S): Expr<Res | Projection.Infer<S>> {
    return Expr(
      ExprData.Case(this.expr[Expr.Data], this.cases, Selection.create(select))
    )
  }

  end(): Expr<Res> {
    return Expr(ExprData.Case(this.expr[Expr.Data], this.cases))
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
