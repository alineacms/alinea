import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragType,
  dashboardEntryDragTypes,
  dispense,
  requiredAtom,
  uploadSizeError
} from './utils.js'

test('throws until a required atom is initialized', () => {
  const valueAtom = requiredAtom<string>('test.value')
  const store = createStore()

  expect(() => store.get(valueAtom)).toThrow(
    'Required atom "test.value" was not initialized'
  )

  store.set(valueAtom, 'ready')
  expect(store.get(valueAtom)).toBe('ready')
})

test('required atom values remain scoped to their store', () => {
  const valueAtom = requiredAtom<string>('test.scoped')
  const first = createStore()
  const second = createStore()

  first.set(valueAtom, 'first')
  second.set(valueAtom, 'second')

  expect(first.get(valueAtom)).toBe('first')
  expect(second.get(valueAtom)).toBe('second')
})

test('required atoms store functions without evaluating them', () => {
  const callbackAtom = requiredAtom<(value: string) => string>('test.callback')
  const callback = (value: string) => `received ${value}`
  const store = createStore()

  store.set(callbackAtom, callback)

  expect(store.get(callbackAtom)).toBe(callback)
  expect(store.get(callbackAtom)('value')).toBe('received value')
})

test('dispense weakly caches values by object identity', () => {
  const family = dispense((_key: object) => requiredAtom<number>('test'))
  const first = {}
  const second = {}

  expect(family(first)).toBe(family(first))
  expect(family(first)).not.toBe(family(second))
})

test('creates dashboard entry drag data with a plain text fallback', () => {
  expect(dashboardEntryDragItem(42)).toEqual({
    'text/plain': '42',
    [dashboardEntryDragType]: '42'
  })
  expect(dashboardEntryDragTypes).toEqual([
    dashboardEntryDragType,
    'text/plain'
  ])
})

test('accepts dashboard entry and plain text drag types', () => {
  expect(
    acceptsDashboardEntryDrag(new Set([dashboardEntryDragType]))
  ).toBeTrue()
  expect(acceptsDashboardEntryDrag(new Set(['text/plain']))).toBeTrue()
  expect(acceptsDashboardEntryDrag(new Set(['application/json']))).toBeFalse()
})

test('reports files that exceed the configured upload limit', () => {
  const file = new File(['oversized'], 'photo.jpg')

  expect(uploadSizeError(file, file.size - 1)).toContain('photo.jpg')
  expect(uploadSizeError(file, file.size)).toBeUndefined()
  expect(uploadSizeError(file, undefined)).toBeUndefined()
})
