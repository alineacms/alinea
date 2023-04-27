import {createId} from 'alinea/core/Id'
import {object, string} from 'cito'
import {Callable} from 'rado/util/Callable'
import {Cursor} from './Cursor.js'
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

export declare class TargetI<T = any> {
  get [Target.IsTarget](): true
  get [Target.Data](): TargetData
}

export interface TargetI<T = any> extends Callable {
  (conditions: {
    [K in keyof T]?: T[K] extends Expr<infer V> ? EV<V> : never
  }): Cursor.Find<T>
  (): Cursor.Find<T>
  // (...conditions: Array<EV<boolean>>): Cursor.Find<T>
}

export type TargetFrom<Row> = Target<{
  [K in keyof Row as K extends string ? K : never]: Fields<Row[K]>
}>

export type TargetRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}

export type Target<Definition> = Definition & TargetI<Definition>

export namespace Target {
  export type From<Row> = TargetFrom<Row>
  export type Row<Definition> = TargetRow<Definition>
}

export const Target = class {
  static readonly Data = Symbol('Target.Data')
  static readonly IsTarget = Symbol('Target.IsTarget')
  cache = create(null)

  constructor(public data: TargetData) {}

  static isTarget<T>(target: any): target is TargetI<T> {
    return target && target[Target.IsTarget]
  }

  call(...input: Array<any>) {
    return new Cursor.Find({
      id: createId(),
      target: this.data,
      where: this.condition(input)
    })
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
    const rowId = `@@@${createId()}`
    return new Proxy<any>(call, {
      ownKeys() {
        return [rowId]
      },
      getOwnPropertyDescriptor() {
        return {enumerable: true, configurable: true}
      },
      get: (_, prop) => {
        if (typeof prop === 'string') {
          if (prop === rowId) return data
          return impl.get(prop)
        }
        switch (prop) {
          case Target.IsTarget:
            return true
          case Target.Data:
            return data
        }
      }
    })
  }
}
