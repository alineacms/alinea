import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'
import {versionedCacheName} from './Version.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {FakeLocks} from '#test/FakeLocks.js'
import {expect, test} from 'bun:test'
import {IDBKeyRange, indexedDB} from 'fake-indexeddb'
import {indexedDBStorage} from '@alinea/sqlite-wasm/indexeddb'
import {
  BrowserEntryStore,
  holdCache,
  isCorruptDatabaseError
} from './BrowserEntryStore.js'

// The stores keep their pages in this IndexedDB implementation.
const idb = {indexedDB, IDBKeyRange}

test('only one worker holds a cache', async () => {
  const locks = new FakeLocks()
  const name = `alinea-browser-held-${crypto.randomUUID()}`
  expect(await holdCache(name, {locks})).toBe(true)
  // A worker of another build would write the same pages.
  expect(await holdCache(name, {locks})).toBe(false)
  expect(await holdCache(name, {locks, wait: 20})).toBe(false)
  const waiting = holdCache(name, {locks, wait: Infinity})
  locks.drop(`${versionedCacheName(name)}-pages`)
  expect(await waiting).toBe(true)
})

test('no worker holds a cache without Web Locks', async () => {
  const name = `alinea-browser-no-locks-${crypto.randomUUID()}`
  expect(await holdCache(name, {locks: undefined})).toBe(false)
  // Web Locks that refuse, as in a sandboxed context.
  const refusing = {
    request: () => Promise.reject(new DOMException('Denied', 'SecurityError'))
  }
  expect(await holdCache(name, {locks: refusing})).toBe(false)
})

test('browser entry store snapshots read the cache without storing', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const options = {
    ...idb,
    name: `alinea-browser-snapshot-${crypto.randomUUID()}`,
    revision: 'config-1'
  }
  const holder = await BrowserEntryStore.open(config, options)
  await holder.mutate([
    {op: 'create', id: 'page', type: 'Page', locale: null, data: {title: 'A'}}
  ])
  // Another worker: the same IndexedDB, seen from another realm.
  const snapshot = await BrowserEntryStore.snapshot(config, {
    ...options,
    indexedDB: new Proxy(indexedDB, {})
  })
  if (!snapshot) throw new Error('Expected a snapshot')
  expect(await snapshot.find({select: Entry.id})).toEqual(['page'])
  await snapshot.mutate([
    {op: 'create', id: 'other', type: 'Page', locale: null, data: {title: 'B'}}
  ])
  await snapshot.close()
  await holder.close()
  const reopened = await BrowserEntryStore.open(config, options)
  try {
    expect(await reopened.find({select: Entry.id})).toEqual(['page'])
  } finally {
    await reopened.close()
  }
})

test('browser entry store snapshots of an empty cache are undefined', async () => {
  const snapshot = await BrowserEntryStore.snapshot(
    {schema: {}, workspaces: {}},
    {
      ...idb,
      name: `alinea-browser-no-snapshot-${crypto.randomUUID()}`,
      revision: 'config-1'
    }
  )
  expect(snapshot).toBeUndefined()
})

test('browser entry stores start over from a reset', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const options = {
    ...idb,
    name: `alinea-browser-reset-${crypto.randomUUID()}`,
    revision: 'config-1'
  }
  const damaged = await BrowserEntryStore.open(config, options)
  await damaged.mutate([
    {
      op: 'create',
      id: 'page',
      type: 'Page',
      locale: null,
      data: {title: 'Page'}
    }
  ])
  await damaged.close()
  const fresh = await BrowserEntryStore.open(config, {...options, reset: true})
  expect(await fresh.find({select: Entry.id})).toEqual([])
  await fresh.close()
  const reopened = await BrowserEntryStore.open(config, options)
  try {
    expect(await reopened.find({select: Entry.id})).toEqual([])
  } finally {
    await reopened.close()
  }
})

test('corrupt database errors are recognized through their causes', () => {
  const corrupt = Object.assign(new Error('database disk image is malformed'), {
    code: 'SQLITE_CORRUPT'
  })
  expect(isCorruptDatabaseError(corrupt)).toBe(true)
  expect(
    isCorruptDatabaseError(new Error('Failed to load', {cause: corrupt}))
  ).toBe(true)
  expect(
    isCorruptDatabaseError(
      new AggregateError([new Error('offline'), corrupt], 'Both failed')
    )
  ).toBe(true)
  expect(isCorruptDatabaseError(new Error('Remote unavailable'))).toBe(false)
})

test('browser entry stores reopen a persisted SQLite file', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  const name = `alinea-browser-db-${crypto.randomUUID()}`
  const options = {...idb, name, revision: 'config-1'}
  const initial = await BrowserEntryStore.open(config, options)
  const mutation = initial.mutate([
    {
      op: 'create',
      id: 'page',
      type: 'Page',
      locale: null,
      data: {title: 'Page'}
    }
  ])
  await Promise.all([mutation, initial.close()])

  let requestedBlobs = 0
  const getBlobs = source.getBlobs.bind(source)
  source.getBlobs = async function* (shas, blobOptions) {
    requestedBlobs += shas.length
    yield* getBlobs(shas, blobOptions)
  }
  const reopened = await BrowserEntryStore.open(config, options)
  try {
    await reopened.sync()
    expect(requestedBlobs).toBe(0)
    expect(await reopened.find({select: Entry.title})).toEqual(['Page'])
  } finally {
    await reopened.close()
  }
})

test('browser entry stores discard a corrupt persisted SQLite file', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  const name = `alinea-browser-corrupt-${crypto.randomUUID()}`
  // A stored page that is not a SQLite file, in the layout of the storage.
  const request = indexedDB.open(`${versionedCacheName(name)}-pages`, 1)
  request.onupgradeneeded = () => {
    request.result.createObjectStore('chunks')
    request.result.createObjectStore('meta')
  }
  const pages = await requestResult(request)
  const transaction = pages.transaction(['chunks', 'meta'], 'readwrite')
  transaction.objectStore('chunks').put(new Uint8Array(4096).fill(7), 0)
  transaction.objectStore('meta').put({size: 4096, chunkSize: 4096}, 'database')
  await transactionComplete(transaction)
  pages.close()

  const store = await BrowserEntryStore.open(config, {
    name,
    revision: 'config-1',
    ...idb
  })
  try {
    expect(await store.sync()).toBe((await source.getTree()).sha)
    expect(await store.find({select: Entry.id})).toEqual([])
  } finally {
    await store.close()
  }
})

test('browser entry stores clean up databases from other versions and layouts', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const name = `alinea-browser-version-${crypto.randomUUID()}`
  const oldName = `${name}-old-version`
  // The file as one record, as this version stored it before.
  const oldLayout = versionedCacheName(name)
  for (const cacheName of [oldName, oldLayout]) {
    const cache = await openCache(cacheName)
    const transaction = cache.transaction('database', 'readwrite')
    transaction.objectStore('database').put(
      {
        revision: 'config-1',
        data: new Uint8Array([1, 2, 3])
      },
      'entries'
    )
    await transactionComplete(transaction)
    cache.close()
  }

  const store = await BrowserEntryStore.open(config, {
    name,
    revision: 'config-1',
    ...idb
  })
  try {
    expect(await store.find({select: Entry.id})).toEqual([])
  } finally {
    await store.close()
  }
  const names = (await indexedDB.databases()).map(database => database.name)
  expect(names).toContain(`${versionedCacheName(name)}-pages`)
  expect(names).not.toContain(oldName)
  expect(names).not.toContain(oldLayout)
})

test('browser entry stores keep caches that another worker holds', async () => {
  const name = `alinea-browser-held-version-${crypto.randomUUID()}`
  const heldVersion = `${name}-v1-pages`
  const unheldVersion = `${name}-v2-pages`
  for (const cacheName of [heldVersion, unheldVersion])
    (await openCache(cacheName)).close()
  const locks = new FakeLocks()
  // A tab of another version still uses its cache.
  void locks.request(heldVersion, {}, () => new Promise<void>(() => {}))

  const store = await BrowserEntryStore.open(
    {schema: {}, workspaces: {}},
    {...idb, locks, name, revision: 'config-1'}
  )
  await store.close()
  const names = (await indexedDB.databases()).map(database => database.name)
  expect(names).toContain(heldVersion)
  expect(names).not.toContain(unheldVersion)
})

test('browser entry stores sync source rows in bounded batches', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const body = 'x'.repeat(8 * 1024)
  const source = await createEntrySource(
    config,
    Array.from({length: 800}, (_, index) => ({
      id: `page-${index}`,
      type: 'Page',
      index: String(index).padStart(4, '0'),
      data: {body}
    }))
  )
  const store = await BrowserEntryStore.open(config, {
    name: `alinea-browser-batched-${crypto.randomUUID()}`,
    revision: 'config-1',
    ...idb
  })
  try {
    await store.syncWith(source)
    expect(await store.count({})).toBe(800)
  } finally {
    await store.close()
  }
})

function openCache(name: string): Promise<IDBDatabase> {
  const request = indexedDB.open(name, 1)
  request.onupgradeneeded = () => request.result.createObjectStore('database')
  return requestResult(request)
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

test('browser entry stores keep persisted content across dashboard builds', async () => {
  const source = await createEntrySource(pages(false), [
    {
      id: 'page',
      type: 'Page',
      index: 'a',
      data: {title: 'Page', body: 'needle'}
    }
  ])
  const name = `alinea-browser-rebuild-${crypto.randomUUID()}`
  const first = await BrowserEntryStore.open(pages(false), {
    name,
    revision: 'build-1',
    ...idb
  })
  await first.syncWith(source)
  expect(await first.find({search: 'needle', select: Entry.id})).toEqual([])
  await first.close()

  let requestedBlobs = 0
  const getBlobs = source.getBlobs.bind(source)
  source.getBlobs = async function* (shas, blobOptions) {
    requestedBlobs += shas.length
    yield* getBlobs(shas, blobOptions)
  }
  // The next build changes the config: the content is kept and derived again.
  const next = await BrowserEntryStore.open(pages(true), {
    name,
    revision: 'build-2',
    ...idb
  })
  try {
    expect(await next.find({select: Entry.title})).toEqual(['Page'])
    expect(await next.find({search: 'needle', select: Entry.id})).toEqual([
      'page'
    ])
    await next.syncWith(source)
    expect(requestedBlobs).toBe(0)
  } finally {
    await next.close()
  }
})

test('browser entry stores reopened with the same revision skip the reindex', async () => {
  const source = await createEntrySource(pages(false), [
    {
      id: 'page',
      type: 'Page',
      index: 'a',
      data: {title: 'Page', body: 'needle'}
    }
  ])
  const name = `alinea-browser-same-config-${crypto.randomUUID()}`
  const options = {name, revision: 'config-1', ...idb}
  const first = await BrowserEntryStore.open(pages(false), options)
  await first.syncWith(source)
  await first.close()
  // The search index only changes when the entries are derived again, which a
  // store reopened with the revision it was derived for skips.
  const next = await BrowserEntryStore.open(pages(true), options)
  try {
    expect(await next.find({select: Entry.title})).toEqual(['Page'])
    expect(await next.find({search: 'needle', select: Entry.id})).toEqual([])
  } finally {
    await next.close()
  }
})

test('browser entry stores keep new databases in 64 KB pages', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const name = `alinea-browser-db-${crypto.randomUUID()}`
  const store = await BrowserEntryStore.open(config, {
    ...idb,
    name,
    revision: 'config-1'
  })
  await store.close()
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  const storage = indexedDBStorage(`${versionedCacheName(name)}-pages`, idb)
  const db = await Database.sync(storage)
  try {
    expect(db.exec('pragma page_size')[0].values).toEqual([[65536]])
  } finally {
    db.detach()
    await storage.delete()
  }
})
