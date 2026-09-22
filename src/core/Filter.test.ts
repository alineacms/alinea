import {expect, test} from 'bun:test'
import {filterChecker, parseCondition, parseFilter} from './Filter.js'

test('parses field conditions into one shared tree', () => {
  expect(parseFilter({title: 'a', count: {gt: 1, lt: 5}})).toEqual({
    op: 'and',
    nodes: [
      {op: 'field', name: 'title', condition: {op: 'is', value: 'a'}},
      {
        op: 'field',
        name: 'count',
        condition: {
          op: 'and',
          nodes: [
            {op: 'gt', value: 1},
            {op: 'lt', value: 5}
          ]
        }
      }
    ]
  })
})

test('includes takes a nested filter or a plain value', () => {
  expect(parseCondition({includes: 'x'})).toEqual({
    op: 'includes',
    item: {op: 'is', value: 'x'}
  })
  expect(parseCondition({includes: {label: 'x'}})).toEqual({
    op: 'includes',
    item: {
      op: 'has',
      filter: {
        op: 'and',
        nodes: [{op: 'field', name: 'label', condition: {op: 'is', value: 'x'}}]
      }
    }
  })
})

test('rejects malformed conditions instead of ignoring them', () => {
  expect(() => parseCondition({in: 'a'})).toThrow('in requires an array')
  expect(() => parseCondition({startsWith: 1})).toThrow(
    'startsWith requires a string'
  )
  expect(() => parseCondition({like: 'a'})).toThrow('Unsupported condition')
  expect(() => parseFilter('a')).toThrow('must be an object')
})

test('checks or branches with plain values and operator groups', () => {
  const check = filterChecker({title: {or: ['a', {startsWith: 'b'}]}})
  expect(check({title: 'a'})).toBe(true)
  expect(check({title: 'bar'})).toBe(true)
  expect(check({title: 'c'})).toBe(false)
  expect(filterChecker({title: {or: []}})({title: 'a'})).toBe(false)
})

test('compares like SQLite: booleans as integers, numbers before text', () => {
  expect(filterChecker({flag: {gt: false}})({flag: true})).toBe(true)
  expect(filterChecker({flag: {gte: true}})({flag: false})).toBe(false)
  expect(filterChecker({value: {lt: 'a'}})({value: 10})).toBe(true)
  expect(filterChecker({value: {gt: 1}})({value: null})).toBe(false)
  expect(filterChecker({value: {gt: 1}})({})).toBe(false)
})

test('nested has and includes filters address the stored value', () => {
  const check = filterChecker(
    {
      meta: {has: {kind: 'page'}},
      tags: {includes: {label: {startsWith: 'a'}}},
      ids: {includes: 2}
    },
    (input: Record<string, unknown>, name) => input[`_${name}`]
  )
  expect(
    check({
      _meta: {kind: 'page'},
      _tags: [{label: 'zz'}, {label: 'ab'}],
      _ids: [1, 2]
    })
  ).toBe(true)
  expect(check({_meta: {kind: 'post'}, _tags: [], _ids: []})).toBe(false)
})
