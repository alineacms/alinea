import {nextMocks} from '#test/NextMocks.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {beforeEach, expect, mock, test} from 'bun:test'
import PLazy from 'p-lazy'
import {createCMS} from './node.js'

const apiKey = 'local-secret'

beforeEach(() => {
  nextMocks.handlerUrl = new URL('https://example.com/api/cms')
  nextMocks.apiKey = apiKey
})

function testCMS() {
  const resolve = mock(async (query: GraphQuery) => query)
  const syncWith = mock(async () => 'content-hash')
  const db = {sha: 'content-hash', syncWith, resolve}
  const cms = createCMS(
    Config.create({
      baseUrl: 'https://example.com',
      handlerUrl: '/api/cms',
      schema: {},
      workspaces: {}
    })
  )
  const store = db as unknown as LocalStore
  cms.bundledDb = PLazy.from(async () => store)
  return {cms, store, syncWith}
}

test('a handler sharing the database syncs it in process', async () => {
  const {cms, store, syncWith} = testCMS()
  const handle = mock(async (_request: Request) => Response.json(null))
  cms.attachHandler({handle, db: Promise.resolve(store)})
  await cms.resolve({syncInterval: 0})
  // Syncing over HTTP would wait on the database the handler syncs
  expect(syncWith).not.toHaveBeenCalled()
  expect(handle).toHaveBeenCalledTimes(1)
  const [request] = handle.mock.calls[0]
  const url = new URL(request.url)
  expect(url.pathname).toBe('/api/cms')
  expect(url.searchParams.get('action')).toBe('tree')
  expect(url.searchParams.get('sha')).toBe('content-hash')
  expect(request.headers.get('authorization')).toBe(`Bearer ${apiKey}`)
  expect(request.headers.get('accept')).toBe('application/json')
})

test('a handler with its own database is synced with over HTTP', async () => {
  const {cms, syncWith} = testCMS()
  const handle = mock(async (_request: Request) => Response.json(null))
  const other = {} as LocalStore
  cms.attachHandler({handle, db: Promise.resolve(other)})
  await cms.resolve({syncInterval: 0})
  expect(handle).not.toHaveBeenCalled()
  expect(syncWith).toHaveBeenCalledTimes(1)
})
