import {expect, test} from 'bun:test'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {clientAtom} from '../user.js'
import {previewTokenAtom} from './preview.js'

test('requests one preview token per dashboard client', async () => {
  const {store} = await createDashboardAtomFixture()
  const client = store.get(clientAtom)
  let requests = 0
  store.set(clientAtom, {
    ...client,
    previewToken() {
      requests++
      return Promise.resolve('session-token')
    }
  })

  expect(await store.get(previewTokenAtom)).toBe('session-token')
  expect(await store.get(previewTokenAtom)).toBe('session-token')
  expect(requests).toBe(1)
})
