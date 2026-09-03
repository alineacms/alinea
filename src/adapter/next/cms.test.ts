import type {LocalDB} from '#/core/db/LocalDB.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {chunkCookieValue} from '#/preview/ChunkCookieValue.js'
import {PREVIEW_COOKIE_NAME} from '#/preview/PreviewCookies.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {afterEach, beforeEach, expect, mock, test} from 'bun:test'
import PLazy from 'p-lazy'

const phase = process.env.NEXT_PHASE
let previewCookies: Array<{name: string; value: string}> = []

mock.module('./context.js', () => ({
  requestContext: async () => ({
    isDev: false,
    handlerUrl: new URL('https://example.com/api/cms'),
    apiKey: 'test-api-key'
  })
}))

mock.module('next/constants.js', () => ({
  PHASE_PRODUCTION_SERVER: 'production-server',
  PHASE_PRODUCTION_BUILD: 'production-build'
}))

mock.module('next/headers.js', () => ({
  cookies: async () => ({getAll: () => previewCookies}),
  draftMode: async () => ({isEnabled: true})
}))

const {NextCMS} = await import('./cms.js')

beforeEach(() => {
  process.env.NEXT_PHASE = 'production-server'
  previewCookies = []
})

afterEach(() => {
  if (phase === undefined) delete process.env.NEXT_PHASE
  else process.env.NEXT_PHASE = phase
})

test('skips syncing a bundled database for a matching preview content hash', async () => {
  const contentHash = 'matching-content-hash'
  const syncWith = mock(async () => contentHash)
  const resolve = mock(async (query: GraphQuery) => query)
  const db = {
    sha: contentHash,
    first: mock(async () => undefined),
    syncWith,
    resolve
  }
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalDB)
  const payload = await encodePreviewPayload({
    locale: null,
    entryId: 'entry-id',
    contentHash,
    status: 'draft',
    patch: new Uint8Array()
  })
  previewCookies = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)

  await cms.resolve({syncInterval: 0})

  expect(syncWith).not.toHaveBeenCalled()
})

test('syncs a bundled database for a mismatched preview content hash', async () => {
  const contentHash = 'requested-content-hash'
  const syncWith = mock(async () => contentHash)
  const resolve = mock(async (query: GraphQuery) => query)
  const db = {
    sha: 'stale-content-hash',
    first: mock(async () => undefined),
    syncWith: async () => {
      db.sha = contentHash
      return syncWith()
    },
    resolve
  }
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalDB)
  const payload = await encodePreviewPayload({
    locale: null,
    entryId: 'entry-id',
    contentHash,
    status: 'draft',
    patch: new Uint8Array()
  })
  previewCookies = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)

  await cms.resolve({syncInterval: 0})

  expect(syncWith).toHaveBeenCalledTimes(1)
})
