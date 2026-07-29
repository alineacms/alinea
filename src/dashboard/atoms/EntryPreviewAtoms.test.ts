import {expect, test} from 'bun:test'
import {requestPreviewSessionToken} from './EntryPreviewAtoms.js'

test('shares concurrent preview token requests for an origin', async () => {
  const tokenRequests = new Map<string, Promise<string>>()
  let requests = 0
  const client = {
    previewToken() {
      requests++
      return Promise.resolve('session-token')
    }
  }

  const first = requestPreviewSessionToken(
    tokenRequests,
    'https://example.com',
    client
  )
  const second = requestPreviewSessionToken(
    tokenRequests,
    'https://example.com',
    client
  )

  expect(first).toBe(second)
  expect(await second).toBe('session-token')
  expect(requests).toBe(1)

  expect(
    await requestPreviewSessionToken(
      tokenRequests,
      'https://example.com',
      client
    )
  ).toBe('session-token')
  expect(requests).toBe(2)
})
