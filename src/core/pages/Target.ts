import {Callable} from '../util/Callable.js'
import {rowId} from '../util/RowId.js'
import {Cursor} from './Cursor.js'
import {EV, Expr, createExprData} from './Expr.js'
import {Fields} from './Fields.js'
import {
  BinaryOp,
  ExprData,
  Selection,
  targetData,
  toSelection
} from './ResolveData.js'
import {TargetData} from './TargetData.js'

const {create, entries} = Object

export declare class TargetI<Row = object> {
  get [Target.IsTarget](): true
  get [targetData](): TargetData
  [toSelection](): Selection.Row
}

export interface TargetI<Row = object> extends Callable {
  (conditions?: {
    [K in keyof Row]?: EV<Row[K]>
  }): Cursor.Find<Row>
}

export type Target<Row> = Target.Definition<Row> & TargetI<Row>

export namespace Target {
  export type Definition<Row> = {
    [K in keyof Row as K extends string ? K : never]: Fields<Row[K]>
  }
}

export const Target = class {
  static readonly IsTarget = Symbol.for('@alinea/Target.IsTarget')
  cache = create(null)

  constructor(public data: TargetData) {}

  static isTarget<T>(target: any): target is TargetI<T> {
    return target && target[Target.IsTarget]
  }

  call(...input: Array<any>) {
    return new Cursor.Find({
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
          return Expr<boolean>(
            ExprData.BinOp(
              field[Expr.Data],
              BinaryOp.Equals,
              createExprData(value)
            )
          )
        })
      : input.map(ev => Expr<boolean>(createExprData(ev)))
    return Expr.and(...conditions)[Expr.Data]
  }

  get(field: string) {
    if (field in this.cache) return this.cache[field]
    return (this.cache[field] = Expr(ExprData.Field(this.data, field)))
  }

  static create<T>(data: TargetData): Target<T> {
    const impl = new this(data)
    const name = data.name || 'target'
    const call = {[name]: (...args: Array<any>) => impl.call(...args)}[name]
    const id = rowId()
    return new Proxy<any>(call, {
      ownKeys() {
        return ['prototype', id]
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === id) return {enumerable: true, configurable: true}
        return Reflect.getOwnPropertyDescriptor(target, prop)
      },
      get: (_, prop) => {
        if (typeof prop === 'string') {
          if (prop === id) return data
          return impl.get(prop)
        }
        switch (prop) {
          case Target.IsTarget:
            return true
          case targetData:
            return data
          case toSelection:
            return Selection.Row(data)
        }
      }
    })
  }
}
