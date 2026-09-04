import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {SourceDB as LocalDB} from '#/database/entry/SourceDB.js'
import {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
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
    source: {getTree: async () => ({sha: 'stale-content-hash'})},
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

test('uses a bundled source tree without requesting it from the handler', async () => {
  const contentHash = 'requested-content-hash'
  const syncWith = mock(async () => contentHash)
  const sync = mock(async () => {
    db.sha = contentHash
    return contentHash
  })
  const db = {
    sha: 'stale-index-hash',
    source: {getTree: async () => ({sha: contentHash})},
    first: mock(async () => undefined),
    sync,
    syncWith,
    resolve: mock(async (query: GraphQuery) => query)
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

  expect(sync).toHaveBeenCalledTimes(1)
  expect(syncWith).not.toHaveBeenCalled()
})

test('applies a valid preview patch without syncing unrelated tree changes', async () => {
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
  const contentHash = db.sha
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
  expect(syncWith).not.toHaveBeenCalled()
  expect(results.map(result => result?.title)).toEqual([
    previewTitle,
    previewTitle
  ])
})
