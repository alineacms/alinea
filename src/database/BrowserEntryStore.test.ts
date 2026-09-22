import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'
import {versionedCacheName} from './Version.js'
import {Config as ConfigBuilder} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {indexedDB} from 'fake-indexeddb'
import {BrowserEntryStore} from './BrowserEntryStore.js'

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
  const options = {indexedDB, name, revision: 'config-1'}
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

test('browser entry stores abandon a superseded revision without persisting', async () => {
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
  const name = `alinea-browser-abandon-${crypto.randomUUID()}`
  const oldStore = await BrowserEntryStore.open(config, {
    indexedDB,
    name,
    revision: 'config-1'
  })
  // Dirty the old store past its persistence layer, as in-flight work can
  // after a revision switch.
  await oldStore.database.apply(
    [
      {
        op: 'create',
        id: 'old-page',
        type: 'Page',
        locale: null,
        data: {title: 'Old page'}
      }
    ],
    {source: oldStore.source}
  )
  const nextStore = await BrowserEntryStore.open(config, {
    indexedDB,
    name,
    revision: 'config-2'
  })
  await nextStore.mutate([
    {
      op: 'create',
      id: 'next-page',
      type: 'Page',
      locale: null,
      data: {title: 'Next page'}
    }
  ])
  await nextStore.close()
  // A trailing close of the superseded store must not overwrite the
  // replacement revision's cache entry.
  await oldStore.abandon()
  await expect(
    oldStore.mutate([
      {
        op: 'create',
        id: 'late-page',
        type: 'Page',
        locale: null,
        data: {title: 'Late page'}
      }
    ])
  ).rejects.toThrow()

  const reopened = await BrowserEntryStore.open(config, {
    indexedDB,
    name,
    revision: 'config-2'
  })
  try {
    expect(await reopened.find({select: Entry.id})).toEqual(['next-page'])
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
  const cache = await openCache(versionedCacheName(name))
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

  const store = await BrowserEntryStore.open(config, {
    indexedDB,
    name,
    revision: 'config-1'
  })
  try {
    expect(await store.sync()).toBe((await source.getTree()).sha)
    expect(await store.find({select: Entry.id})).toEqual([])
  } finally {
    await store.close()
  }
})

test('browser entry stores clean up databases from other Alinea versions', async () => {
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
  const cache = await openCache(oldName)
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

  const store = await BrowserEntryStore.open(config, {
    indexedDB,
    name,
    revision: 'config-1'
  })
  try {
    expect(await store.find({select: Entry.id})).toEqual([])
  } finally {
    await store.close()
  }
  expect(
    (await indexedDB.databases()).map(database => database.name)
  ).toContain(versionedCacheName(name))
  expect(
    (await indexedDB.databases()).map(database => database.name)
  ).not.toContain(oldName)
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
    indexedDB,
    name: `alinea-browser-batched-${crypto.randomUUID()}`,
    revision: 'config-1'
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
