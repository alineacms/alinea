import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'
import {versionedCacheName} from './Version.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {IDBKeyRange, indexedDB} from 'fake-indexeddb'
import {BrowserEntryStore} from './BrowserEntryStore.js'

// The stores keep their pages in this IndexedDB implementation.
const idb = {indexedDB, IDBKeyRange}

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

test('browser entry stores hand their storage to a replacement', async () => {
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
    name,
    revision: 'config-1',
    ...idb
  })
  await oldStore.mutate([
    {
      op: 'create',
      id: 'old-page',
      type: 'Page',
      locale: null,
      data: {title: 'Old page'}
    }
  ])
  // The replacement takes the content over from the old store's memory.
  const nextStore = await BrowserEntryStore.open(config, {
    name,
    revision: 'config-2',
    replaces: oldStore,
    ...idb
  })
  // Work the old store finishes afterwards changes only its memory copy.
  const late = oldStore.database.apply(
    [
      {
        op: 'create',
        id: 'late-page',
        type: 'Page',
        locale: null,
        data: {title: 'Late page'}
      }
    ],
    {source: oldStore.source}
  )
  const abandoned = late.then(() => oldStore.abandon())
  await nextStore.mutate([
    {
      op: 'create',
      id: 'next-page',
      type: 'Page',
      locale: null,
      data: {title: 'Next page'}
    }
  ])
  await Promise.all([late, abandoned, nextStore.close()])
  await expect(
    oldStore.mutate([
      {
        op: 'create',
        id: 'closed-page',
        type: 'Page',
        locale: null,
        data: {title: 'Closed page'}
      }
    ])
  ).rejects.toThrow()

  const reopened = await BrowserEntryStore.open(config, {
    name,
    revision: 'config-2',
    ...idb
  })
  try {
    const ids = await reopened.find({select: Entry.id})
    expect(ids.toSorted()).toEqual(['next-page', 'old-page'])
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

test('browser entry stores keep persisted content across dashboard builds', async () => {
  const pages = (searchable: boolean) => {
    const Page = ConfigBuilder.document('Page', {
      fields: {
        title: Field.text('Title'),
        body: Field.text('Body', {searchable})
      }
    })
    const config: Config = {
      schema: {Page},
      workspaces: {
        main: ConfigBuilder.workspace('Main', {
          source: 'content',
          roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
        })
      }
    }
    return config
  }
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
