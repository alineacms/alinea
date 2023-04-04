import {object, string} from 'cito'
import {Callable} from 'rado/util/Callable'
import {Select, SelectFirst} from './Cursor.js'
import {BinaryOp, EV, Expr, ExprData, and} from './Expr.js'
import {Fields} from './Fields.js'

const {create, entries} = Object

export type TargetData = typeof TargetData.infer
export const TargetData = object(
  class {
    name? = string.optional
    alias? = string.optional
  }
)

export interface TargetImplSingle<T> extends Callable {
  (conditions: {
    [K in keyof T]?: T[K] extends Expr<infer V> ? EV<V> : never
  }): SelectFirst<T>
  (...conditions: Array<EV<boolean>>): SelectFirst<T>
}

export declare class TargetImpl<T> {
  get [Target.IsTarget](): true
}

export interface TargetImpl<T> extends Callable {
  (conditions: {
    [K in keyof T]?: T[K] extends Expr<infer V> ? EV<V> : never
  }): Select<T>
  (...conditions: Array<EV<boolean>>): Select<T>
}

export type TargetFrom<Row> = Target<{
  [K in keyof Row as K extends string ? K : never]: Fields<Row[K]>
}>

export type TargetRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}

export type Target<Definition> = Definition & TargetImpl<Definition>

export namespace Target {
  export type From<Row> = TargetFrom<Row>
  export type Row<Definition> = TargetRow<Definition>
}

export const Target = class {
  static readonly IsTarget = Symbol('IsTarget')
  cache = create(null)

  constructor(public data: TargetData) {}

  call(...input: Array<any>) {
    return new Select({target: this.data, where: this.condition(input)})
  }

  condition(input: Array<any>): ExprData | undefined {
    if (input.length === 0) return undefined
    const isConditionalRecord = input.length === 1 && !Expr.isExpr(input[0])
    const conditions = isConditionalRecord
      ? entries(input[0]).map(([key, value]) => {
          const field = Expr(ExprData.Field(this.data, key))
          return Expr(
            ExprData.BinOp(field[Expr.Data], BinaryOp.Equals, ExprData(value))
          )
        })
      : input.map(ev => Expr(ExprData(ev)))
    return and(...conditions)[Expr.Data]
  }

  get(field: string) {
    if (field in this.cache) return this.cache[field]
    return (this.cache[field] = Expr(ExprData.Field(this.data, field)))
  }

  static create<Definition>(data: TargetData): Target<Definition> {
    const impl = new this(data)
    const name = data.name || 'target'
    const call = {[name]: (...args: Array<any>) => impl.call(...args)}[name]
    return new Proxy<any>(call, {
      get: (_, prop) => {
        if (typeof prop === 'string') return impl.get(prop)
      }
    })
  }
}
