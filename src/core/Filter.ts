import {Expr} from './pages/Expr.js'

type InferValue<T> = T extends Expr<infer V> ? V : T

export type Condition<V> =
  | {
      is?: V
      isNot?: V
      in?: ReadonlyArray<V>
      gt?: V
      gte?: V
      lt?: V
      lte?: V
      startsWith?: string
      or?: Condition<V>
    }
  | V

export type Filter<Fields> = {
  [K in keyof Fields]?: Condition<InferValue<Fields[K]>>
}
