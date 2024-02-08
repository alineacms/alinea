import {createExprData} from './CreateExprData.js'
import {createSelection} from './CreateSelection.js'
import {Cursor, OrderBy, OrderDirection} from './Cursor.js'
import {BinaryOp, ExprData, UnaryOp} from './ExprData.js'
import {Projection} from './Projection.js'
import type {Selection} from './Selection.js'

/** Expression or value of type T */
export type EV<T> = Expr<T> | T
export type Condition = Expr<boolean> | HasExpr<boolean>

export interface Expr<T> extends ExprI<T> {}

export function Expr<T>(expr: ExprData): Expr<T> {
  return new ExprI(expr)
}

export interface HasExpr<T> {
  [Expr.ToExpr](): Expr<T>
}

export interface ExprI<T> {
  [Expr.Data]: ExprData
  [Expr.ExprRef]: boolean
}

export class ExprI<T> {
  constructor(expr: ExprData) {
    this[Expr.Data] = expr
    this[Expr.ExprRef] = true
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
      ExprData.BinOp(this[Expr.Data], BinaryOp.Equals, createExprData(that))
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
      ExprData.BinOp(this[Expr.Data], BinaryOp.NotEquals, createExprData(that))
    )
  }

  isNull(): Expr<boolean> {
    return Expr(ExprData.UnOp(UnaryOp.IsNull, this[Expr.Data]))
  }

  isNotNull(): Expr<boolean> {
    return this.isNull().not()
  }

  isIn(that: EV<ReadonlyArray<T>> | Cursor.Find<T>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.In, createExprData(that))
    )
  }

  isNotIn(that: EV<ReadonlyArray<T>> | Cursor.Find<T>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.NotIn, createExprData(that))
    )
  }

  isBetween(min: EV<T>, max: EV<T>): Expr<boolean> {
    return this.isGreaterOrEqual(min).and(this.isLessOrEqual(max))
  }

  isGreater(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Greater, createExprData(that))
    )
  }

  isGreaterOrEqual(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(
        this[Expr.Data],
        BinaryOp.GreaterOrEqual,
        createExprData(that)
      )
    )
  }

  isLess(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Less, createExprData(that))
    )
  }

  isLessOrEqual(that: EV<any>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(
        this[Expr.Data],
        BinaryOp.LessOrEqual,
        createExprData(that)
      )
    )
  }

  add(
    this: Expr<number>,
    that: EV<number>,
    ...rest: Array<EV<number>>
  ): Expr<number>
  add(...args: Array<EV<number>>): Expr<number> {
    return Expr(
      args
        .map(Expr.create)
        .map(expr => expr[Expr.Data])
        .reduce((a, b) => ExprData.BinOp(a, BinaryOp.Add, b))
    )
  }

  subtract(
    this: Expr<number>,
    that: EV<number>,
    ...rest: Array<EV<number>>
  ): Expr<number>
  subtract(...args: Array<EV<number>>): Expr<number> {
    return Expr(
      args
        .map(Expr.create)
        .map(expr => expr[Expr.Data])
        .reduce((a, b) => ExprData.BinOp(a, BinaryOp.Subt, b))
    )
  }

  multiply(
    this: Expr<number>,
    that: EV<number>,
    ...rest: Array<EV<number>>
  ): Expr<number>
  multiply(...args: Array<EV<number>>): Expr<number> {
    return Expr(
      args
        .map(Expr.create)
        .map(expr => expr[Expr.Data])
        .reduce((a, b) => ExprData.BinOp(a, BinaryOp.Mult, b))
    )
  }

  remainder(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Mod, createExprData(that))
    )
  }

  divide(
    this: Expr<number>,
    that: EV<number>,
    ...rest: Array<EV<number>>
  ): Expr<number>
  divide(...args: Array<EV<number>>): Expr<number> {
    return Expr(
      args
        .map(Expr.create)
        .map(expr => expr[Expr.Data])
        .reduce((a, b) => ExprData.BinOp(a, BinaryOp.Div, b))
    )
  }

  concat(this: Expr<string>, that: EV<string>): Expr<string> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Concat, createExprData(that))
    )
  }

  endsWith(this: Expr<string>, that: string): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Like, createExprData(`%${that}`))
    )
  }

  startsWith(this: Expr<string>, that: string): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Like, createExprData(`${that}%`))
    )
  }

  like(this: Expr<string>, that: EV<string>): Expr<boolean> {
    return Expr(
      ExprData.BinOp(this[Expr.Data], BinaryOp.Like, createExprData(that))
    )
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
    return new CaseBuilder<T, Projection.Infer<S>>(this).when(expr, select)
  }

  at<T>(this: Expr<Array<T>>, index: number): Expr<T | null> {
    return this.get(`[${Number(index)}]`)
  }

  includes<T>(this: Expr<Array<T>>, value: EV<T>): Expr<boolean> {
    return Expr(createExprData(value)).isIn(this)
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
        [Expr.create(expr)[Expr.Data], createSelection(select)]
      ])
    )
  }

  orElse<S extends Projection>(select: S): Expr<Res | Projection.Infer<S>> {
    return Expr(
      ExprData.Case(this.expr[Expr.Data], this.cases, createSelection(select))
    )
  }

  end(): Expr<Res> {
    return Expr(ExprData.Case(this.expr[Expr.Data], this.cases))
  }
}

export namespace Expr {
  export const Data = Symbol.for('@alinea/Expr.Data')
  export const ExprRef = Symbol.for('@alinea/Expr.ExprRef')
  export const ToExpr = Symbol.for('@alinea/Expr.ToExpr')
  export const NULL = create(null)

  /*export function value<T>(value: T): Expr<T> {
    return new Expr<T>(new ExprData.Param(new ParamData.Value(value)))
  }*/

  export function create<T>(input: EV<T>): Expr<T> {
    if (hasExpr<T>(input)) return input[Expr.ToExpr]()
    if (isExpr<T>(input)) return input
    return Expr(ExprData.Value(input))
  }

  export function hasExpr<T>(input: any): input is HasExpr<T> {
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
      input[Expr.ExprRef]
    )
  }

  export function and(
    ...conditions: Array<Condition | boolean>
  ): Expr<boolean> {
    return conditions
      .map(Expr.create)
      .reduce(
        (condition, expr) => condition.and(expr),
        Expr(ExprData.Value(true))
      )
  }

  export function or(...conditions: Array<Condition | boolean>): Expr<boolean> {
    return conditions
      .map(Expr.create)
      .reduce(
        (condition, expr) => condition.or(expr),
        Expr(ExprData.Value(false))
      )
  }
}
