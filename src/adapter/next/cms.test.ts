import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {chunkCookieValue} from '#/preview/ChunkCookieValue.js'
import {PREVIEW_COOKIE_NAME} from '#/preview/PreviewCookies.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import * as iso from '@alinea/iso'
import {afterEach, beforeEach, expect, mock, test} from 'bun:test'
import PLazy from 'p-lazy'

const phase = process.env.NEXT_PHASE
const runtime = process.env.NEXT_RUNTIME
let previewCookies: Array<{name: string; value: string}> = []
let handlerUrl = new URL('https://example.com/api/cms')
type HandlerFetch = (
  ...args: Parameters<typeof iso.fetch>
) => ReturnType<typeof iso.fetch>
const defaultFetch: HandlerFetch = iso.fetch
let handlerFetch = defaultFetch

mock.module('@alinea/iso', () => ({
  ...iso,
  fetch: (...args: Parameters<typeof iso.fetch>) => handlerFetch(...args)
}))

mock.module('./context.js', () => ({
  requestContext: async () => ({
    isDev: false,
    handlerUrl,
    apiKey: 'test-api-key'
  })
}))

mock.module('next/constants.js', () => ({
  PHASE_PRODUCTION_SERVER: 'production-server',
  PHASE_PRODUCTION_BUILD: 'production-build'
}))

let isDraft = true

mock.module('next/headers.js', () => ({
  cookies: async () => ({getAll: () => previewCookies}),
  draftMode: async () => ({isEnabled: isDraft})
}))

const {NextCMS} = await import('./cms.js')

beforeEach(() => {
  process.env.NEXT_PHASE = 'production-server'
  previewCookies = []
  isDraft = true
  handlerUrl = new URL('https://example.com/api/cms')
  handlerFetch = defaultFetch
})

afterEach(() => {
  if (phase === undefined) delete process.env.NEXT_PHASE
  else process.env.NEXT_PHASE = phase
  if (runtime === undefined) delete process.env.NEXT_RUNTIME
  else process.env.NEXT_RUNTIME = runtime
})

test('forwards Edge queries to the configured handler', async () => {
  process.env.NEXT_RUNTIME = 'edge'
  handlerFetch = mock(async input => {
    const url = new URL(String(input))
    expect(url.origin).toBe('https://example.com')
    expect(url.pathname).toBe('/api/cms')
    expect(url.searchParams.get('action')).toBe('resolve')
    return Response.json([{title: 'Forwarded'}])
  })
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))

  expect(await cms.resolve({})).toEqual([{title: 'Forwarded'}])
  expect(handlerFetch).toHaveBeenCalledTimes(1)
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

test('syncs once for a stale preview content hash and still applies the patch', async () => {
  const Page = Config.document('Page', {fields: {}})
  const config = Config.create({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages')}
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const entry = await db.create({
    type: Page,
    set: {title: 'Previewed entry'},
    select: Entry
  })
  const contentHash = await db.sha
  const baseText = new TextDecoder().decode(
    JsonLoader.format(config.schema, createRecord(entry, entry.status))
  )
  const previewTitle = 'Updated in preview'
  const updatedText = new TextDecoder().decode(
    JsonLoader.format(
      config.schema,
      createRecord(
        {
          ...entry,
          title: previewTitle,
          data: {...entry.data, title: previewTitle}
        },
        entry.status
      )
    )
  )
  const patch = await createFilePatch(baseText, updatedText)
  await db.create({type: Page, set: {title: 'Unrelated entry'}})
  // The handler is at the revision this db already holds, which makes the
  // sync triggered by the stale cookie hash a no-op.
  handlerFetch = mock(async () => Response.json(null))
  const syncWith = mock(db.syncWith.bind(db))
  db.syncWith = syncWith
  let initializations = 0
  const cms = new NextCMS(config)
  cms.bundledDb = PLazy.from(async () => {
    initializations += 1
    return db
  })
  const payload = await encodePreviewPayload({
    locale: entry.locale,
    entryId: entry.id,
    contentHash,
    status: entry.status,
    patch
  })
  previewCookies = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)

  const results = await Promise.all([
    cms.first({id: entry.id, select: Entry}),
    cms.first({id: entry.id, select: Entry})
  ])

  expect(initializations).toBe(1)
  // Once per resolve: React's cache() only dedups within a request scope,
  // which bun test has none of. Each sync is a no-op against this db.
  expect(syncWith).toHaveBeenCalled()
  expect(results.map(result => result?.title)).toEqual([
    previewTitle,
    previewTitle
  ])
})

test('syncs without asking the handler for the shared sha in draft mode', async () => {
  const syncWith = mock(async () => 'remote-content-hash')
  const db = {
    sha: 'local-content-hash',
    first: mock(async () => undefined),
    syncWith,
    resolve: mock(async (query: GraphQuery) => query)
  }
  handlerFetch = mock(async () => Response.json(null))
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalDB)

  await cms.resolve({syncInterval: 5000})

  expect(syncWith).toHaveBeenCalledTimes(1)
  expect(handlerFetch).not.toHaveBeenCalled()
})

test('reports the bundled database revision and the last sync', async () => {
  isDraft = false
  const sha = 'synced-content-hash'
  const db = {
    sha: 'stale-content-hash',
    syncWith: mock(async () => {
      db.sha = sha
      return sha
    }),
    resolve: mock(async (query: GraphQuery) => query)
  }
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalDB)

  expect(await cms.status()).toEqual({
    source: 'database',
    sha: 'stale-content-hash',
    syncedAt: undefined
  })
  await cms.resolve({syncInterval: 0})
  const status = await cms.status()
  expect(status.source).toBe('database')
  expect(status.sha).toBe(sha)
  expect(status.syncedAt).toBeInstanceOf(Date)
})

test('reports the handler revision when queries are forwarded', async () => {
  process.env.NEXT_RUNTIME = 'edge'
  handlerFetch = mock(async () =>
    Response.json({sha: 'handler-content-hash', entries: []})
  )
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))

  expect(await cms.status()).toEqual({
    source: 'handler',
    sha: 'handler-content-hash',
    syncedAt: undefined
  })
})

test('serves the bundled database when the handler cannot be synced', async () => {
  isDraft = false
  const db = {
    sha: 'bundled-content-hash',
    syncWith: mock(async () => {
      throw new Error('Handler unavailable')
    }),
    resolve: mock(async (query: GraphQuery) => query)
  }
  const cms = new NextCMS(Config.create({schema: {}, workspaces: {}}))
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalDB)
  const warn = console.warn
  console.warn = mock(() => {})
  try {
    await cms.resolve({syncInterval: 0})
    expect(db.resolve).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledTimes(1)
  } finally {
    console.warn = warn
  }
  const status = await cms.status()
  expect(status.sha).toBe('bundled-content-hash')
  expect(status.syncedAt).toBeUndefined()
})
