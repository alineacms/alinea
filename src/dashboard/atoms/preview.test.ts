import {clientAtom} from '#/dashboard/atoms/core.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {getPreviewToken, retryPreviewToken} from './preview.js'

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

  expect(await getPreviewToken(store.get(clientAtom))).toBe('session-token')
  expect(await getPreviewToken(store.get(clientAtom))).toBe('session-token')
  expect(requests).toBe(1)
})

test('retries a failed preview token request', async () => {
  const {store} = await createDashboardAtomFixture()
  const client = store.get(clientAtom)
  let requests = 0
  store.set(clientAtom, {
    ...client,
    previewToken() {
      requests++
      if (requests === 1) return Promise.reject(new Error('Token failed'))
      return Promise.resolve('retry-token')
    }
  })
  const nextToken = () => getPreviewToken(store.get(clientAtom))
  await expect(nextToken()).rejects.toThrow('Token failed')
  expect(await nextToken()).toBe('retry-token')
  expect(requests).toBe(2)

  retryPreviewToken(store.get(clientAtom))
  expect(await nextToken()).toBe('retry-token')
  expect(requests).toBe(3)
})
