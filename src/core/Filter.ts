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
  extends Ops<Value>, ArrayOps<Value>, ObjectOps<Value> {}

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

interface RuntimeCondition {
  is?: unknown
  isNot?: unknown
  in?: ReadonlyArray<unknown>
  notIn?: ReadonlyArray<unknown>
  gt?: unknown
  gte?: unknown
  lt?: unknown
  lte?: unknown
  startsWith?: string
  or?: RuntimeCondition | Array<RuntimeCondition>
  has?: Filter
  includes?: Filter
}

type FilterCheck<Input> = (input: Input) => boolean

export function filterChecker<Input = unknown>(
  filter: Filter,
  getField: (input: Input, name: string) => unknown = defaultField
): FilterCheck<Input> {
  if (isRecord(filter) && Object.keys(filter).length === 1) {
    if ('or' in filter && Array.isArray(filter.or)) {
      const checks = filter.or
        .filter(value => value !== undefined)
        .map(value => filterChecker(value, getField))
      return input => checks.some(check => check(input))
    }
    if ('and' in filter && Array.isArray(filter.and)) {
      const checks = filter.and
        .filter(value => value !== undefined)
        .map(value => filterChecker(value, getField))
      return input => checks.every(check => check(input))
    }
  }
  if (!isRecord(filter)) return input => input === filter
  const conditions = createConditions(filter, getField)
  return input => conditions.every(condition => condition(input))
}

function createConditions<Input>(
  operations: Record<string, unknown>,
  getField: (input: Input, name: string) => unknown
): Array<FilterCheck<Input>> {
  const conditions = Array<FilterCheck<Input>>()
  for (const [name, operation] of Object.entries(operations)) {
    if (operation === undefined) continue
    if (!isRecord(operation)) {
      conditions.push(input => getField(input, name) === operation)
      continue
    }
    const inner = operation as RuntimeCondition
    if (inner.is !== undefined)
      conditions.push(input => getField(input, name) === inner.is)
    if (inner.isNot !== undefined)
      conditions.push(input => getField(input, name) !== inner.isNot)
    if (inner.in)
      conditions.push(input => inner.in!.includes(getField(input, name)))
    if (inner.notIn)
      conditions.push(input => !inner.notIn!.includes(getField(input, name)))
    if (inner.gt !== undefined)
      conditions.push(input => compare(getField(input, name), inner.gt) > 0)
    if (inner.gte !== undefined)
      conditions.push(input => compare(getField(input, name), inner.gte) >= 0)
    if (inner.lt !== undefined)
      conditions.push(input => compare(getField(input, name), inner.lt) < 0)
    if (inner.lte !== undefined)
      conditions.push(input => compare(getField(input, name), inner.lte) <= 0)
    if (inner.startsWith)
      conditions.push(input => {
        const value = getField(input, name)
        return typeof value === 'string' && value.startsWith(inner.startsWith!)
      })
    if (inner.or) {
      const nested = Array.isArray(inner.or) ? inner.or : [inner.or]
      const checks = nested.flatMap(value =>
        createConditions(value as unknown as Record<string, unknown>, getField)
      )
      conditions.push(input => checks.some(check => check(input)))
    }
    if (inner.has) {
      const has = filterChecker(inner.has)
      conditions.push(input => has(getField(input, name)))
    }
    if (inner.includes) {
      const includes = filterChecker(inner.includes)
      conditions.push(input => {
        const value = getField(input, name)
        return Array.isArray(value) && value.some(item => includes(item))
      })
    }
  }
  return conditions
}

function defaultField(input: unknown, name: string): unknown {
  return isRecord(input) ? input[name] : undefined
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'string' && typeof right === 'string')
    return left < right ? -1 : left > right ? 1 : 0
  return Number.NaN
}

import {isRecord} from './util/Objects.js'
