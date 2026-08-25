import type {Filter} from '#/core/Filter.js'
import {isRecord} from '#/core/util/Objects.js'

export interface FilterPredicate {
  (input: unknown): boolean
}

export interface FieldReader {
  (input: unknown, name: string): unknown
}

export function filterPredicate(
  filter: Filter,
  getField: FieldReader = recordField
): FilterPredicate {
  if (isRecord(filter) && exactArrayOperator(filter, 'or')) {
    const predicates = filter.or
      .filter(value => value !== undefined)
      .map(value => filterPredicate(value as Filter, getField))
    return input => predicates.some(predicate => predicate(input))
  }
  if (isRecord(filter) && exactArrayOperator(filter, 'and')) {
    const predicates = filter.and
      .filter(value => value !== undefined)
      .map(value => filterPredicate(value as Filter, getField))
    return input => predicates.every(predicate => predicate(input))
  }
  if (!isRecord(filter)) return input => input === filter
  const predicates: Array<FilterPredicate> = []
  for (const [name, operation] of Object.entries(filter)) {
    if (operation === undefined) continue
    if (!isRecord(operation)) {
      predicates.push(input => getField(input, name) === operation)
      continue
    }
    if (operation.is !== undefined)
      predicates.push(input => getField(input, name) === operation.is)
    if (operation.isNot !== undefined)
      predicates.push(input => getField(input, name) !== operation.isNot)
    const inValues = operation.in
    if (Array.isArray(inValues))
      predicates.push(input => inValues.includes(getField(input, name)))
    const notInValues = operation.notIn
    if (Array.isArray(notInValues))
      predicates.push(input => !notInValues.includes(getField(input, name)))
    if (operation.gt !== undefined)
      predicates.push(input => compare(getField(input, name), operation.gt) > 0)
    if (operation.gte !== undefined)
      predicates.push(
        input => compare(getField(input, name), operation.gte) >= 0
      )
    if (operation.lt !== undefined)
      predicates.push(input => compare(getField(input, name), operation.lt) < 0)
    if (operation.lte !== undefined)
      predicates.push(
        input => compare(getField(input, name), operation.lte) <= 0
      )
    if (typeof operation.startsWith === 'string')
      predicates.push(input => {
        const value = getField(input, name)
        return (
          typeof value === 'string' &&
          value.startsWith(operation.startsWith as string)
        )
      })
    if (operation.or) {
      const source = Array.isArray(operation.or) ? operation.or : [operation.or]
      const nested = source.flatMap(value => fieldPredicates(value, getField))
      predicates.push(input => nested.some(predicate => predicate(input)))
    }
    if (operation.has) {
      const nested = filterPredicate(operation.has as Filter)
      predicates.push(input => nested(getField(input, name)))
    }
    if (operation.includes) {
      const nested = filterPredicate(operation.includes as Filter)
      predicates.push(input => {
        const value = getField(input, name)
        return Array.isArray(value) && value.some(item => nested(item))
      })
    }
  }
  return input => predicates.every(predicate => predicate(input))
}

function fieldPredicates(value: unknown, getField: FieldReader) {
  if (!isRecord(value)) return []
  const predicate = filterPredicate(value as Filter, getField)
  return [predicate]
}

function exactArrayOperator(
  value: Record<string, unknown>,
  name: 'and' | 'or'
): value is Record<'and' | 'or', Array<unknown>> {
  return Object.keys(value).length === 1 && Array.isArray(value[name])
}

function recordField(input: unknown, name: string): unknown {
  return isRecord(input) ? input[name] : undefined
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'string' && typeof right === 'string')
    return left < right ? -1 : left > right ? 1 : 0
  return Number.NaN
}
