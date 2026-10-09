import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {createEntryRow} from '#/core/util/EntryRows.js'
import type {Source} from '#/core/source/Source.js'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {memorySnapshots} from '@alinea/sqlite-wasm/snapshots'
import {expect, test} from 'bun:test'
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb'
import {sql} from 'rado'
import {BrowserEntryStore} from './BrowserEntryStore.js'
import {databaseVersion, versionedCacheName} from './Version.js'
import {wasmHandle, wasmSqlite} from './driver/WasmDatabase.js'

const name = 'alinea-entry-database'

test('reopens the newest base without fetching blobs', async () => {
  const storage = memorySnapshots()
  const source = await pageSource()
  const options = {name, fingerprint: 'config-1', storage}
  const first = await BrowserEntryStore.open(pages(false), options)
  await first.syncWith(source)
  await first.close()

  const requested = countBlobs(source)
  const next = await BrowserEntryStore.open(pages(false), options)
  try {
    expect(await next.find({select: Entry.title})).toEqual(['Page'])
    await next.syncWith(source)
    expect(requested()).toBe(0)
  } finally {
    await next.close()
  }
})

test('derives the base of another config again', async () => {
  const storage = memorySnapshots()
  const source = await pageSource()
  const first = await BrowserEntryStore.open(pages(false), {
    name,
    fingerprint: 'config-1',
    storage
  })
  await first.syncWith(source)
  expect(await first.find({search: 'needle', select: Entry.id})).toEqual([])
  await first.close()

  const requested = countBlobs(source)
  const next = await BrowserEntryStore.open(pages(true), {
    name,
    fingerprint: 'config-2',
    storage
  })
  try {
    expect(await next.find({search: 'needle', select: Entry.id})).toEqual([
      'page'
    ])
    await next.syncWith(source)
    expect(requested()).toBe(0)
  } finally {
    await next.close()
  }
  expect((await storage.list()).map(base => base.branch)).toEqual([
    'config-2',
    'config-1'
  ])
})

test('skips the reindex for a base of the same config', async () => {
  const storage = memorySnapshots()
  const options = {name, fingerprint: 'config-1', storage}
  const first = await BrowserEntryStore.open(pages(false), options)
  await first.syncWith(await pageSource())
  await first.close()
  const next = await BrowserEntryStore.open(pages(true), options)
  try {
    expect(await next.find({search: 'needle', select: Entry.id})).toEqual([])
  } finally {
    await next.close()
  }
})

test('keeps the newest base of the two newest configs', async () => {
  const storage = memorySnapshots()
  const source = await pageSource()
  for (const fingerprint of ['config-1', 'config-2', 'config-3']) {
    const store = await BrowserEntryStore.open(pages(false), {
      name,
      fingerprint,
      storage
    })
    await store.syncWith(source)
    await store.close()
  }
  expect((await storage.list()).map(base => base.branch)).toEqual([
    'config-3',
    'config-2'
  ])
})

test('stores on one base change apart', async () => {
  const storage = memorySnapshots()
  const options = {name, fingerprint: 'config-1', storage}
  const first = await BrowserEntryStore.open(pages(false), options)
  await first.syncWith(await pageSource())
  await first.close()

  const a = await BrowserEntryStore.open(pages(false), options)
  const b = await BrowserEntryStore.open(pages(false), options)
  try {
    const create = (id: string) => ({
      op: 'create' as const,
      id,
      type: 'Page',
      locale: null,
      data: {title: id}
    })
    await a.mutate([create('a')])
    await a.sync()
    await b.mutate([create('b')])
    await b.sync()
    expect((await a.find({select: Entry.id})).toSorted()).toEqual(['a', 'page'])
    expect((await b.find({select: Entry.id})).toSorted()).toEqual(['b', 'page'])
  } finally {
    await Promise.all([a.close(), b.close()])
  }
  const next = await BrowserEntryStore.open(pages(false), options)
  try {
    expect((await next.find({select: Entry.id})).toSorted()).toEqual([
      'b',
      'page'
    ])
  } finally {
    await next.close()
  }
})

test('previews an entry over a store on a base', async () => {
  const storage = memorySnapshots()
  const options = {name, fingerprint: 'config-1', storage}
  const first = await BrowserEntryStore.open(pages(false), options)
  await first.syncWith(await pageSource())
  await first.close()
  const store = await BrowserEntryStore.open(pages(false), options)
  try {
    const entry = await store.get({id: 'page', select: Entry})
    const {rowHash: _rowHash, fileHash: _fileHash, ...base} = entry
    const previewed = await createEntryRow(
      pages(false),
      {...base, title: 'Preview', data: {...entry.data, title: 'Preview'}},
      entry.status
    )
    const titles = (preview?: Entry) =>
      store.find({
        select: Entry.title,
        preview: preview && {entry: preview}
      })
    expect(await titles(previewed)).toEqual(['Preview'])
    expect(await titles()).toEqual(['Page'])
  } finally {
    await store.close()
  }
})

test('stores its own base when another wrote the content in other pages', async () => {
  const storage = memorySnapshots()
  const options = {name, fingerprint: 'config-1', storage}
  const source = await pageSource()
  const a = await BrowserEntryStore.open(pages(false), options)
  const b = await BrowserEntryStore.open(pages(false), options)
  // Through another revision first, b lays out the same content differently.
  const other = await createEntrySource(pages(false), [
    {id: 'other', type: 'Page', index: 'a1', data: {title: 'Other'}}
  ])
  await b.syncWith(other)
  await a.syncWith(source)
  await a.close()
  const revision = await b.syncWith(source)
  await b.close()
  const keys = (await storage.list()).map(base => base.key)
  expect(keys).toHaveLength(1)
  expect(keys[0]).toStartWith(`${revision}-config-1-`)
  // A store opened on that base holds nothing new to store.
  const c = await BrowserEntryStore.open(pages(false), options)
  await c.sync()
  await c.close()
  expect((await storage.list()).map(base => base.key)).toEqual(keys)
})

test('starts empty from a base that is not a database', async () => {
  const storage = memorySnapshots()
  await storage.store.write({
    key: 'corrupt',
    branch: 'config-1',
    meta: {},
    visible: 0,
    size: 4096,
    chunkSize: 4096,
    pages: [0],
    page: () => new Uint8Array(4096).fill(7)
  })
  const store = await BrowserEntryStore.open(pages(false), {
    name,
    fingerprint: 'config-1',
    storage
  })
  try {
    expect(await store.find({select: Entry.id})).toEqual([])
  } finally {
    await store.close()
  }
})

test('keeps content in memory without snapshot storage', async () => {
  // IndexedDB snapshots read Blobs with FileReaderSync, which Bun lacks.
  const store = await BrowserEntryStore.open(pages(false), {
    name,
    fingerprint: 'config-1'
  })
  try {
    await store.syncWith(await pageSource())
    expect(await store.find({select: Entry.title})).toEqual(['Page'])
  } finally {
    await store.close()
  }
})

test('deletes the caches of older versions and layouts', async () => {
  const restore = installIndexedDB()
  try {
    const oldVersion = `${name}-v1`
    const oldLayout = `${versionedCacheName(name)}-pages`
    const newVersion = `${name}-v${databaseVersion + 1}-snapshots`
    for (const cache of [oldVersion, oldLayout, newVersion])
      await createCache(indexedDB, cache)
    const store = await BrowserEntryStore.open(pages(false), {
      name,
      fingerprint: 'config-1'
    })
    await store.close()
    const names = (await indexedDB.databases()).map(database => database.name)
    expect(names).not.toContain(oldVersion)
    expect(names).not.toContain(oldLayout)
    expect(names).toContain(newVersion)
  } finally {
    restore()
  }
})

test('syncs source rows in bounded batches', async () => {
  const body = 'x'.repeat(8 * 1024)
  const source = await createEntrySource(
    pages(false),
    Array.from({length: 800}, (_, index) => ({
      id: `page-${index}`,
      type: 'Page',
      index: String(index).padStart(4, '0'),
      data: {body}
    }))
  )
  const storage = memorySnapshots()
  const options = {name, fingerprint: 'config-1', storage}
  const store = await BrowserEntryStore.open(pages(false), options)
  await store.syncWith(source)
  expect(await store.count({})).toBe(800)
  await store.close()
  const next = await BrowserEntryStore.open(pages(false), options)
  try {
    expect(await next.count({})).toBe(800)
  } finally {
    await next.close()
  }
})

test('forks keep the page cache size', async () => {
  const Database = await wasmSqlite()
  const sqlite = new Database()
  sqlite.run('pragma cache_size = -65536')
  const fork = await wasmHandle(sqlite).fork()
  const row = await fork.database.get<{cache_size: number}>(
    sql`pragma cache_size`
  )
  expect(row?.cache_size).toBe(-65536)
})

function pageSource(): Promise<Source> {
  return createEntrySource(pages(false), [
    {
      id: 'page',
      type: 'Page',
      index: 'a0',
      data: {title: 'Page', body: 'needle'}
    }
  ])
}

/** Count the blobs requested from `source` from now on. */
function countBlobs(source: Source): () => number {
  let requested = 0
  const getBlobs = source.getBlobs.bind(source)
  source.getBlobs = async function* (shas, options) {
    requested += shas.length
    yield* getBlobs(shas, options)
  }
  return () => requested
}

async function createCache(factory: IDBFactory, cache: string) {
  const request = factory.open(cache, 1)
  request.onupgradeneeded = () => request.result.createObjectStore('database')
  const db = await requestResult(request)
  const transaction = db.transaction('database', 'readwrite')
  transaction.objectStore('database').put(new Uint8Array([1, 2, 3]), 'entries')
  await transactionComplete(transaction)
  db.close()
}

/** Install an empty IndexedDB as a worker has it, until the returned call. */
function installIndexedDB(): () => void {
  const globals = {indexedDB: new IDBFactory(), IDBKeyRange}
  const previous = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true
    })
  }
  return () => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
  }
}

function pages(searchable: boolean): Config {
  const Page = ConfigBuilder.document('Page', {
    fields: {
      title: Field.text('Title'),
      body: Field.text('Body', {searchable})
    }
  })
  return {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
}
