type Primitive = string | number | boolean | null

export interface Ops<Value = unknown> {
  is?: Value
  isNot?: Value
  in?: ReadonlyArray<Value>
  notIn?: ReadonlyArray<Value>
  gt?: Value
  gte?: Value
  lt?: Value
  lte?: Value
  startsWith?: string
  or?: Condition<Value> | Array<Condition<Value>>
}

interface ObjectOps<Fields> {
  has?: Filter<Fields>
}

interface ArrayOps<Fields> {
  includes?: Filter<Fields>
}

type FieldOps<Fields> = {
  [K in keyof Fields]?: Condition<Fields[K]>
}

export interface AnyCondition<Value>
  extends Ops<Value>,
    ArrayOps<Value>,
    ObjectOps<Value> {}

export type Condition<Value> = [Value] extends [Primitive]
  ? Ops<Value> | Value
  : [Value] extends [Array<any>]
    ? ArrayOps<Value[0]>
    : ObjectOps<Value>

type AndCondition<Fields> = {and: Array<Filter<Fields> | undefined>}
type OrCondition<Fields> = {or: Array<Filter<Fields> | undefined>}

export type Filter<Fields = unknown> =
  | AndCondition<Fields>
  | OrCondition<Fields>
  | FieldOps<Fields>
