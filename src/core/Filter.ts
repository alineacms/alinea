import {isRecord} from './util/Objects.js'
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

/** A validated filter over named fields, shared by every filter backend. */
export type FilterNode =
  | {op: 'and'; nodes: Array<FilterNode>}
  | {op: 'or'; nodes: Array<FilterNode>}
  | {op: 'field'; name: string; condition: ConditionNode}

/** A validated condition on one value. */
export type ConditionNode =
  | {op: 'and'; nodes: Array<ConditionNode>}
  | {op: 'or'; nodes: Array<ConditionNode>}
  | {op: 'is' | 'isNot' | 'gt' | 'gte' | 'lt' | 'lte'; value: unknown}
  | {op: 'in' | 'notIn'; values: Array<unknown>}
  | {op: 'startsWith'; value: string}
  | {op: 'has'; filter: FilterNode}
  | {op: 'includes'; item: ConditionNode}

export function parseFilter(filter: unknown): FilterNode {
  if (!isRecord(filter)) throw new Error('A query filter must be an object')
  const keys = Object.keys(filter)
  if (keys.length === 1 && (keys[0] === 'and' || keys[0] === 'or')) {
    const op = keys[0]
    const values = filter[op]
    if (!Array.isArray(values)) throw new Error(`${op} requires an array`)
    return {op, nodes: definedValues(values).map(parseFilter)}
  }
  const nodes = Array<FilterNode>()
  for (const [name, value] of Object.entries(filter)) {
    if (value === undefined) continue
    nodes.push({op: 'field', name, condition: parseCondition(value)})
  }
  return {op: 'and', nodes}
}

export function parseCondition(condition: unknown): ConditionNode {
  if (condition === undefined) return {op: 'and', nodes: []}
  if (!isRecord(condition)) return {op: 'is', value: condition}
  const nodes = Array<ConditionNode>()
  for (const [op, value] of Object.entries(condition)) {
    if (value === undefined) continue
    switch (op) {
      case 'is':
      case 'isNot':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        nodes.push({op, value})
        break
      case 'in':
      case 'notIn':
        if (!Array.isArray(value)) throw new Error(`${op} requires an array`)
        nodes.push({op, values: [...value]})
        break
      case 'startsWith':
        if (typeof value !== 'string')
          throw new Error('startsWith requires a string')
        if (value !== '') nodes.push({op, value})
        break
      case 'or': {
        const values = Array.isArray(value) ? value : [value]
        nodes.push({op, nodes: definedValues(values).map(parseCondition)})
        break
      }
      case 'has':
        nodes.push({op, filter: parseFilter(value)})
        break
      case 'includes':
        nodes.push({
          op,
          item: isRecord(value)
            ? {op: 'has', filter: parseFilter(value)}
            : {op: 'is', value}
        })
        break
      default:
        throw new Error(`Unsupported condition: ${op}`)
    }
  }
  return nodes.length === 1 ? nodes[0]! : {op: 'and', nodes}
}

function definedValues(values: Array<unknown>): Array<unknown> {
  return values.filter(value => value !== undefined)
}

type FilterCheck<Input> = (input: Input) => boolean
type FieldAccessor<Input> = (input: Input, name: string) => unknown

export function filterChecker<Input = unknown>(
  filter: Filter,
  getField: FieldAccessor<Input> = defaultField
): FilterCheck<Input> {
  return filterCheck(parseFilter(filter), getField)
}

function filterCheck<Input>(
  node: FilterNode,
  getField: FieldAccessor<Input>
): FilterCheck<Input> {
  switch (node.op) {
    case 'and': {
      const checks = node.nodes.map(node => filterCheck(node, getField))
      return input => checks.every(check => check(input))
    }
    case 'or': {
      const checks = node.nodes.map(node => filterCheck(node, getField))
      return input => checks.some(check => check(input))
    }
    case 'field': {
      const check = conditionCheck(node.condition)
      return input => check(getField(input, node.name))
    }
  }
}

function conditionCheck(node: ConditionNode): FilterCheck<unknown> {
  switch (node.op) {
    case 'and': {
      const checks = node.nodes.map(conditionCheck)
      return value => checks.every(check => check(value))
    }
    case 'or': {
      const checks = node.nodes.map(conditionCheck)
      return value => checks.some(check => check(value))
    }
    case 'is':
      return value => value === node.value
    case 'isNot':
      return value => value !== node.value
    case 'in':
      return value => node.values.includes(value)
    case 'notIn':
      return value => !node.values.includes(value)
    case 'gt':
      return value => compare(value, node.value) > 0
    case 'gte':
      return value => compare(value, node.value) >= 0
    case 'lt':
      return value => compare(value, node.value) < 0
    case 'lte':
      return value => compare(value, node.value) <= 0
    case 'startsWith':
      return value => typeof value === 'string' && value.startsWith(node.value)
    case 'has': {
      // Nested filters address the stored value itself, not the input.
      const check = filterCheck(node.filter, defaultField)
      return value => check(value)
    }
    case 'includes': {
      const check = conditionCheck(node.item)
      return value => Array.isArray(value) && value.some(check)
    }
  }
}

function defaultField(input: unknown, name: string): unknown {
  return isRecord(input) ? input[name] : undefined
}

/** Order values the way SQLite orders JSON scalars: booleans are integers,
 * numbers sort before text, and nulls or other types never compare. */
function compare(left: unknown, right: unknown): number {
  const a = scalar(left)
  const b = scalar(right)
  if (a === undefined || b === undefined) return Number.NaN
  if (typeof a !== typeof b) return typeof a === 'number' ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

function scalar(value: unknown): number | string | undefined {
  if (typeof value === 'boolean') return Number(value)
  if (typeof value === 'number' || typeof value === 'string') return value
  return undefined
}
