import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {Graph} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {NodeReplica} from '#/database/driver/NodeReplica.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {chunkCookieValue} from '#/preview/ChunkCookieValue.js'
import {PREVIEW_COOKIE_NAME} from '#/preview/PreviewCookies.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
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

beforeEach(() => {
  process.env.NEXT_PHASE = 'production-server'
  previewCookies = []
})
afterEach(() => {
  if (phase === undefined) delete process.env.NEXT_PHASE
  else process.env.NEXT_PHASE = phase
})

function fixture(title: string, extra = false) {
  return createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title},
    ...(extra
      ? [{id: 'other', type: 'Page', index: 'b', title: 'Unrelated'}]
      : [])
  ])
}

async function withDatabase(
  run: (cms: InstanceType<typeof NextCMS>, db: NodeReplica) => Promise<void>,
  title = 'Original',
  extra = false
) {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-next-cms-'))
  const source = (await fixture(title, extra)).source
  const db = await NodeReplica.open(
    {
      config,
      directory,
      identity: {
        project: 'project',
        namespace: 'main',
        epoch: '1',
        schemaId: 'schema',
        configId: 'config',
        releaseId: 'release'
      }
    },
    source
  )
  const cms = new NextCMS(config)
  cms.bundledDb = PLazy.from(async () => db)
  try {
    await run(cms, db)
  } finally {
    await db.close()
    await rm(directory, {recursive: true, force: true})
  }
}

async function patchPayload(entry: Entry, contentHash: string, title: string) {
  const decoder = new TextDecoder()
  const base = decoder.decode(
    JsonLoader.format(config.schema, createRecord(entry, entry.status))
  )
  const changed = decoder.decode(
    JsonLoader.format(
      config.schema,
      createRecord({...entry, data: {...entry.data, title}}, entry.status)
    )
  )
  return encodePreviewPayload({
    entryId: entry.id,
    locale: entry.locale,
    status: entry.status,
    contentHash,
    patch: await createFilePatch(base, changed)
  })
}

test('build queries use the pinned SQLite graph without initializing the live replica', async () => {
  process.env.NEXT_PHASE = 'production-build'
  const cms = new NextCMS(config)
  const live = mock(async () => {
    throw new Error('Unexpected live build database')
  })
  cms.bundledDb = PLazy.from(live)
  const resolve = mock(async () => ['sql'])
  cms.buildDb = PLazy.from(async () => ({resolve}) as unknown as Graph)
  expect(await cms.find({select: Entry.id})).toEqual(['sql'])
  expect(resolve).toHaveBeenCalledTimes(1)
  expect(live).not.toHaveBeenCalled()
  cms.buildDb = PLazy.from(async () => {
    throw new Error('Broken checkpoint')
  })
  await expect(cms.find({select: Entry.id})).rejects.toThrow(
    'Broken checkpoint'
  )
  expect(live).not.toHaveBeenCalled()
})

test('live queries reconcile SQL and disableSync preserves the current ready snapshot', async () => {
  const remote = await fixture('Updated')
  await withDatabase(async (cms, db) => {
    const original = db.sync.bind(db)
    const sync = spyOn(db, 'sync').mockImplementation(() =>
      original(remote.source)
    )
    try {
      expect(await cms.find({select: Entry.title, disableSync: true})).toEqual([
        'Original'
      ])
      expect(sync).not.toHaveBeenCalled()
      expect(await cms.find({select: Entry.title, syncInterval: 0})).toEqual([
        'Updated'
      ])
      expect(await cms.find({select: Entry.title, disableSync: true})).toEqual([
        'Updated'
      ])
      expect(sync).toHaveBeenCalledTimes(1)
    } finally {
      sync.mockRestore()
    }
  })
})

test('valid file previews survive unrelated tree changes without remote synchronization', async () => {
  const before = await fixture('Original')
  const entry = await before.resolver.get({id: 'a', select: Entry})
  const payload = await patchPayload(
    entry,
    (await before.source.getTree()).sha,
    'Preview'
  )
  await withDatabase(
    async (cms, db) => {
      const sync = spyOn(db, 'sync').mockImplementation(async () => {
        throw new Error('Unexpected remote sync')
      })
      try {
        previewCookies = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)
        expect(
          await Promise.all([
            cms.first({id: 'a', select: Entry.title, search: 'preview'}),
            cms.first({id: 'a', select: Entry.title})
          ])
        ).toEqual(['Preview', 'Preview'])
        expect(sync).not.toHaveBeenCalled()
        previewCookies = []
        expect(
          await cms.first({id: 'a', select: Entry.title, disableSync: true})
        ).toBe('Original')
        expect(
          await cms.first({
            id: 'a',
            select: Entry.title,
            preview: {
              entry: {
                ...entry,
                fileHash: 'direct',
                data: {...entry.data, title: 'Direct'}
              }
            }
          })
        ).toBe('Direct')
      } finally {
        sync.mockRestore()
      }
    },
    'Original',
    true
  )
})

test('preview catch-up fetches a missing base once and keeps edits request-local', async () => {
  const remote = await fixture('Needed base')
  const entry = await remote.resolver.get({id: 'a', select: Entry})
  const payload = await patchPayload(
    entry,
    (await remote.source.getTree()).sha,
    'Preview'
  )
  await withDatabase(async (cms, db) => {
    const original = db.sync.bind(db)
    const sync = spyOn(db, 'sync').mockImplementation(() =>
      original(remote.source)
    )
    try {
      previewCookies = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)
      expect(await cms.first({id: 'a', select: Entry.title})).toBe('Preview')
      expect(sync).toHaveBeenCalledTimes(1)
      previewCookies = []
      expect(
        await cms.first({id: 'a', select: Entry.title, disableSync: true})
      ).toBe('Needed base')
    } finally {
      sync.mockRestore()
    }
  })
})

test('invalid preview patches fail closed and cannot cause repeated catch-up', async () => {
  await withDatabase(async (cms, db) => {
    const sync = spyOn(db, 'sync').mockImplementation(async () => false)
    try {
      for (const contentHash of [db.revision, 'different']) {
        const payload = await encodePreviewPayload({
          entryId: 'a',
          locale: null,
          status: 'published',
          contentHash,
          patch: new Uint8Array()
        })
        previewCookies = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)
        await expect(cms.first({id: 'a', select: Entry.title})).rejects.toThrow(
          'could not be applied'
        )
        expect(sync).toHaveBeenCalledTimes(contentHash === db.revision ? 0 : 1)
      }
    } finally {
      sync.mockRestore()
    }
  })
})
