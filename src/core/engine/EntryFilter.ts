import type {AnyCondition, Filter} from '../Filter.js'
import {entries} from '../util/Objects.js'

export type EntryFieldReader = (input: any, name: string) => unknown
export type EntryPredicate = (input: any) => boolean

export function compileEntryFilter(
  filter: Filter | undefined,
  read: EntryFieldReader = (input, name) => input?.[name]
): EntryPredicate | undefined {
  if (!filter) return
  return compileFilter(filter, read)
}

function compileFilter(filter: Filter, read: EntryFieldReader): EntryPredicate {
  if (!isObject(filter)) return input => input === filter
  if (isOnlyKey(filter, 'or')) {
    const predicates = filter.or
      .filter(Boolean)
      .map(item => compileFilter(item as Filter, read))
    return input => predicates.some(predicate => predicate(input))
  }
  if (isOnlyKey(filter, 'and')) {
    const predicates = filter.and
      .filter(Boolean)
      .map(item => compileFilter(item as Filter, read))
    return input => predicates.every(predicate => predicate(input))
  }

  const predicates = entries(filter).flatMap(([name, condition]) => {
    if (condition === undefined) return []
    return compileFieldCondition(name, condition, read)
  })
  return input => predicates.every(predicate => predicate(input))
}

function compileFieldCondition(
  name: string,
  condition: unknown,
  read: EntryFieldReader
): EntryPredicate {
  if (!isObject(condition)) return input => read(input, name) === condition

  const ops = condition as AnyCondition<any>
  const predicates = Array<EntryPredicate>()

  if (ops.is !== undefined)
    predicates.push(input => read(input, name) === ops.is)
  if (ops.isNot !== undefined)
    predicates.push(input => read(input, name) !== ops.isNot)
  if (Array.isArray(ops.in))
    predicates.push(input => ops.in!.includes(read(input, name)))
  if (Array.isArray(ops.notIn))
    predicates.push(input => !ops.notIn!.includes(read(input, name)))
  if (ops.gt !== undefined)
    predicates.push(input => (read(input, name) as any) > ops.gt!)
  if (ops.gte !== undefined)
    predicates.push(input => (read(input, name) as any) >= ops.gte!)
  if (ops.lt !== undefined)
    predicates.push(input => (read(input, name) as any) < ops.lt!)
  if (ops.lte !== undefined)
    predicates.push(input => (read(input, name) as any) <= ops.lte!)
  if (ops.startsWith)
    predicates.push(input => {
      const value = read(input, name)
      return typeof value === 'string' && value.startsWith(ops.startsWith!)
    })
  if (ops.or) {
    const alternatives = Array.isArray(ops.or) ? ops.or : [ops.or]
    const alternativePredicates = alternatives.map(item =>
      compileFilter(item as Filter, read)
    )
    predicates.push(input =>
      alternativePredicates.some(predicate => predicate(input))
    )
  }
  if (ops.has) {
    const nested = compileFilter(ops.has as Filter, defaultRead)
    predicates.push(input => nested(read(input, name)))
  }
  if (ops.includes) {
    const nested = compileFilter(ops.includes as Filter, defaultRead)
    predicates.push(input => {
      const value = read(input, name)
      return Array.isArray(value) && value.some(item => nested(item))
    })
  }

  return input => predicates.every(predicate => predicate(input))
}

function defaultRead(input: any, name: string) {
  return input?.[name]
}

function isOnlyKey<T extends string>(
  input: object,
  key: T
): input is Record<T, Array<Filter | undefined>> {
  const keys = Object.keys(input)
  return keys.length === 1 && keys[0] === key
}

function isObject(input: unknown): input is object {
  return Boolean(input && typeof input === 'object')
}
