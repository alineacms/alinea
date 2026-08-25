import type {Filter} from './Filter.js'
import {isRecord} from './util/Objects.js'

export interface FilterCheck<Input = unknown> {
  (input: Input): boolean
}

export interface FilterFieldReader<Input = unknown> {
  (input: Input, name: string): unknown
}

export function filterChecker<Input = unknown>(
  filter: Filter,
  getField: FilterFieldReader<Input> = defaultFieldReader
): FilterCheck<Input> {
  const logical = logicalFilter(filter)
  if (logical) {
    const checks = logical.filters
      .filter(filter => filter !== undefined)
      .map(filter => filterChecker(filter, getField))
    return logical.operation === 'or'
      ? input => checks.some(check => check(input))
      : input => checks.every(check => check(input))
  }
  if (!isRecord(filter)) return input => input === filter
  const conditions = createConditions(filter, getField)
  return input => conditions.every(condition => condition(input))
}

function createConditions<Input>(
  operations: Record<string, unknown>,
  getField: FilterFieldReader<Input>
): Array<FilterCheck<Input>> {
  const conditions: Array<FilterCheck<Input>> = []
  for (const [name, operation] of Object.entries(operations)) {
    if (operation === undefined) continue
    if (!isRecord(operation)) {
      conditions.push(input => getField(input, name) === operation)
      continue
    }
    if (operation.is !== undefined)
      conditions.push(input => getField(input, name) === operation.is)
    if (operation.isNot !== undefined)
      conditions.push(input => getField(input, name) !== operation.isNot)
    const inValues = operation.in
    if (Array.isArray(inValues))
      conditions.push(input => inValues.includes(getField(input, name)))
    const notInValues = operation.notIn
    if (Array.isArray(notInValues))
      conditions.push(input => !notInValues.includes(getField(input, name)))
    if (operation.gt !== undefined)
      conditions.push(input => compare(getField(input, name), operation.gt) > 0)
    if (operation.gte !== undefined)
      conditions.push(
        input => compare(getField(input, name), operation.gte) >= 0
      )
    if (operation.lt !== undefined)
      conditions.push(input => compare(getField(input, name), operation.lt) < 0)
    if (operation.lte !== undefined)
      conditions.push(
        input => compare(getField(input, name), operation.lte) <= 0
      )
    if (typeof operation.startsWith === 'string' && operation.startsWith)
      conditions.push(input => {
        const value = getField(input, name)
        return (
          typeof value === 'string' &&
          value.startsWith(operation.startsWith as string)
        )
      })
    if (operation.or) {
      const nested = (
        Array.isArray(operation.or) ? operation.or : [operation.or]
      ).flatMap(value =>
        isRecord(value) ? createConditions(value, getField) : []
      )
      conditions.push(input => nested.some(condition => condition(input)))
    }
    if (operation.has !== undefined) {
      const has = filterChecker(operation.has as Filter)
      conditions.push(input => has(getField(input, name)))
    }
    if (operation.includes !== undefined) {
      const includes = filterChecker(operation.includes as Filter)
      conditions.push(input => {
        const value = getField(input, name)
        return Array.isArray(value) && value.some(item => includes(item))
      })
    }
  }
  return conditions
}

function defaultFieldReader(input: unknown, name: string): unknown {
  return isRecord(input) ? input[name] : undefined
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number')
    return left < right ? -1 : left > right ? 1 : 0
  if (typeof left === 'string' && typeof right === 'string')
    return left < right ? -1 : left > right ? 1 : 0
  return Number.NaN
}

function logicalFilter(
  value: unknown
): {operation: 'and' | 'or'; filters: Array<Filter | undefined>} | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 1) return
  if (Array.isArray(value.or)) return {operation: 'or', filters: value.or}
  if (Array.isArray(value.and)) return {operation: 'and', filters: value.and}
}
