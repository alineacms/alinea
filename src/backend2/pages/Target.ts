import {Callable} from 'rado/util/Callable'
import {and, EV, Expr, ExprData} from './Expr.js'
import {Fields} from './Fields.js'
import {Select, SelectFirst} from './Select.js'

const {create, entries} = Object

export type TargetData = [name?: string, alias?: string]

export interface TargetImplSingle<T> extends Callable {
  (conditions: {
    [K in keyof T]?: T[K] extends Expr<infer V> ? EV<V> : never
  }): SelectFirst<T>
  (...conditions: Array<EV<boolean>>): SelectFirst<T>
}

declare class WithFirst<T> {
  get ['1'](): TargetImplSingle<T>
}

export interface TargetImpl<T> extends Callable, WithFirst<T> {
  (conditions: {
    [K in keyof T]?: T[K] extends Expr<infer V> ? EV<V> : never
  }): Select<T>
  (...conditions: Array<EV<boolean>>): Select<T>
}

export type Target<Definition> = Definition & TargetImpl<Definition>

export type TargetFrom<Row> = Target<{
  [K in keyof Row as K extends string ? K : never]: Fields<Row[K]>
}>

export type TargetRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}

export namespace Target {
  export type From<Row> = TargetFrom<Row>
  export type Row<Definition> = TargetRow<Definition>
}

export const Target = class {
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
          const field = Expr('field', this.data, key)
          return Expr('binop', field[Expr.Data], 'equals', ExprData(value))
        })
      : input.map(ev => Expr(...ExprData(ev)))
    return and(...conditions)[Expr.Data]
  }

  get(field: string) {
    if (field === '1') return this.call()
    if (field in this.cache) return this.cache[field]
    return (this.cache[field] = Expr('field', this.data, field))
  }

  static create<Definition>(
    data: [name: string, alias?: string]
  ): Target<Definition> {
    const impl = new this(data)
    const call = {[data[0]]: impl.call.bind(impl)}[data[0]]
    return new Proxy<any>(call, {
      get: (_, prop) => {
        if (typeof prop === 'string') return impl.get(prop)
      }
    })
  }
}
