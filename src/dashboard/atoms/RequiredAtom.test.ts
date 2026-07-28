import {createStore} from 'jotai'
import {expect, test} from 'bun:test'
import {requiredAtom} from './RequiredAtom.js'

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
