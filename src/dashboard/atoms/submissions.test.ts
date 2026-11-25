import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {submissionsVersion} from './submissions.js'

test('submissions load again once they are shown again', () => {
  const store = createStore()
  const version = submissionsVersion('form')
  const unsubscribe = store.sub(version, () => {})
  expect(store.get(version)).toBe(0)
  unsubscribe()
  expect(store.get(version)).toBe(1)
})
