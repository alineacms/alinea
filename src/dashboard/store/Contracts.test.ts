import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {createTreeSelection} from './Contracts.js'

test('tree selection is independently constructible', async () => {
  const store = createStore()
  const selection = createTreeSelection(new Set(['first']))

  expect(store.get(selection)).toEqual(new Set(['first']))
  await store.set(selection, new Set(['second']))
  expect(store.get(selection)).toEqual(new Set(['second']))
  await expect(store.set(selection, 'all')).rejects.toThrow(
    'Selecting all items is not supported'
  )
})
