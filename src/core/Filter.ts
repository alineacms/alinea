import {Expr} from './pages/Expr.js'

type Primitive = string | number | boolean | null

type InferValue<T> = T extends Expr<infer V> ? V : T

export type Condition<V> =
  | {
      is?: V
      isNot?: V
      in?: ReadonlyArray<V>
      notIn?: ReadonlyArray<V>
      gt?: V
      gte?: V
      lt?: V
      lte?: V
      startsWith?: string
      or?: Condition<V>
    }
  | V

type OrCondition<Fields> = {or: Array<Filter<Fields>>}
type AndCondition<Fields> = {
  [K in keyof Fields as InferValue<Fields[K]> extends Primitive
    ? K
    : never]?: Condition<InferValue<Fields[K]>>
}

export type Filter<Fields> = OrCondition<Fields> | AndCondition<Fields>
