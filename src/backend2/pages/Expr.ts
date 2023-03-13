import {Select} from './Select.js'
import {TargetData} from './Target.js'

const {fromEntries, entries} = Object

export type UnOp = 'not' | 'isnull'

export type BinOp =
  | 'add'
  | 'subt'
  | 'mult'
  | 'mod'
  | 'div'
  | 'greater'
  | 'greaterorequal'
  | 'less'
  | 'lessorequal'
  | 'equals'
  | 'notequals'
  | 'and'
  | 'or'
  | 'like'
  | 'in'
  | 'notin'
  | 'concat'

export type ExprData =
  | [type: 'unop', op: UnOp, expr: ExprData]
  | [type: 'binop', a: ExprData, op: BinOp, b: ExprData]
  | [type: 'field', target: TargetData, field: string]
  | [type: 'access', expr: ExprData, field: string]
  | [type: 'merge', a: ExprData, b: ExprData]
  | [type: 'value', value: any]
  | [type: 'record', fields: Record<string, ExprData>]

export function ExprData(input: any): ExprData {
  if (input === null || input === undefined) return ['value', null]
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return input[Expr.Data]
  if (input && typeof input === 'object' && !Array.isArray(input))
    return [
      'record',
      fromEntries(entries(input).map(([key, value]) => [key, ExprData(value)]))
    ]
  return ['value', input]
}

/** Expression or value of type T */
export type EV<T> = Expr<T> | T

export interface Expr<T> extends ExprImpl<T> {}

export function Expr<T>(...expr: ExprData): Expr<T> {
  return new ExprImpl(...expr)
}

interface ExprImpl<T> {
  [Expr.Data]: ExprData
  [Expr.IsExpr]: boolean
}

class ExprImpl<T> {
  constructor(...expr: ExprData) {
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
    return Expr('unop', 'not', this[Expr.Data])
  }

  or(this: Expr<boolean>, that: EV<boolean>): Expr<boolean> {
    const a = this
    const b = Expr.create(that)
    if (b.isConstant(true) || a.isConstant(false)) return b
    if (a.isConstant(true) || b.isConstant(false)) return this
    return Expr('binop', a[Expr.Data], 'or', b[Expr.Data])
  }

  and(this: Expr<boolean>, that: EV<boolean>): Expr<boolean> {
    const a = this
    const b = Expr.create(that)
    if (b.isConstant(true) || a.isConstant(false)) return this
    if (a.isConstant(true) || b.isConstant(false)) return b
    return Expr('binop', a[Expr.Data], 'and', b[Expr.Data])
  }

  is(that: EV<T>): Expr<boolean> {
    if (that === null || (Expr.isExpr(that) && that.isConstant(null)))
      return this.isNull()
    return Expr('binop', this[Expr.Data], 'equals', ExprData(that))
  }

  isConstant(value: T): boolean {
    const expr = this[Expr.Data]
    switch (expr[0]) {
      case 'value':
        const [, param] = expr
        return param.value === value
      default:
        return false
    }
  }

  isNot(that: EV<T>): Expr<boolean> {
    if (that === null || (Expr.isExpr(that) && that.isConstant(null)))
      return this.isNotNull()
    return Expr('binop', this[Expr.Data], 'notequals', ExprData(that))
  }

  isNull(): Expr<boolean> {
    return Expr('unop', 'isnull', this[Expr.Data])
  }

  isNotNull(): Expr<boolean> {
    return this.isNull().not()
  }

  isIn(that: EV<Array<T>> | Select<T>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'in', ExprData(that))
  }

  isNotIn(that: EV<Array<T>> | Select<T>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'notin', ExprData(that))
  }

  isGreater(that: EV<any>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'greater', ExprData(that))
  }

  isGreaterOrEqual(that: EV<any>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'greaterorequal', ExprData(that))
  }

  isLess(that: EV<any>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'less', ExprData(that))
  }

  isLessOrEqual(that: EV<any>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'lessorequal', ExprData(that))
  }

  add(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr('binop', this[Expr.Data], 'add', ExprData(that))
  }

  substract(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr('binop', this[Expr.Data], 'subt', ExprData(that))
  }

  multiply(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr('binop', this[Expr.Data], 'mult', ExprData(that))
  }

  remainder(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr('binop', this[Expr.Data], 'mod', ExprData(that))
  }

  divide(this: Expr<number>, that: EV<number>): Expr<number> {
    return Expr('binop', this[Expr.Data], 'div', ExprData(that))
  }

  concat(this: Expr<string>, that: EV<string>): Expr<string> {
    return Expr('binop', this[Expr.Data], 'concat', ExprData(that))
  }

  like(this: Expr<string>, that: EV<string>): Expr<boolean> {
    return Expr('binop', this[Expr.Data], 'like', ExprData(that))
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
    return Expr('access', this[Expr.Data], name)
  }

  toJSON() {
    return this[Expr.Data]
  }

  [Symbol.iterator](): Iterator<ExprData> {
    return this[Expr.Data][Symbol.iterator]()
  }
}

export function and(...conditions: Array<EV<boolean>>): Expr<boolean> {
  return conditions
    .map(Expr.create)
    .reduce((condition, expr) => condition.and(expr), Expr('value', true))
}

export function or(...conditions: Array<EV<boolean>>): Expr<boolean> {
  return conditions
    .map(Expr.create)
    .reduce((condition, expr) => condition.or(expr), Expr('value', false))
}

export namespace Expr {
  export const Data = Symbol('Expr.Data')
  export const IsExpr = Symbol('Expr.IsExpr')
  export const ToExpr = Symbol('Expr.ToExpr')
  export const NULL = create(null)

  /*export function value<T>(value: T): Expr<T> {
    return new Expr<T>(new ExprData.Param(new ParamData.Value(value)))
  }*/

  export function create<T>(input: EV<T>): Expr<T> {
    if (isExpr<T>(input)) return input
    return Expr('value', input)
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
