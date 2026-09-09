import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {entryVersionId, type IndexedEntry} from '../entry/Schema.js'
import {
  EntryRuntime,
  type EntryReplacement,
  type LoadedPayload
} from './EntryRuntime.js'

const config: Config = {schema: {}, workspaces: {}}

test('nested structural relations agree with Graph on the demo corpus', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const index = new EntryIndex(cms.config)
  await index.syncWith(new FSSource('test/fixtures/demo'))
  const resolver = new EntryResolver(cms.config, index)
  const runtime = new EntryRuntime(cms.config, db)
  const entries: Array<EntryReplacement> = []
  for (const entry of index.filter({}))
    entries.push({
      entry: {...entry, versionStatus: entry.status, ordinal: entries.length},
      payloadId: entry.rowHash,
      data: entry.data
    })
  await runtime.apply({fromRevision: 'empty', toRevision: 'r1', entries})
  const cases: Array<GraphQuery> = [
    {select: {id: Entry.id, children: {edge: 'children', select: Entry.id}}},
    {
      select: {
        id: Entry.id,
        children: {edge: 'children', depth: 3, select: Entry.id}
      }
    },
    {select: {id: Entry.id, parents: {edge: 'parents', select: Entry.id}}},
    {
      select: {
        id: Entry.id,
        parents: {edge: 'parents', depth: 1, select: Entry.id}
      }
    },
    {select: {id: Entry.id, siblings: {edge: 'siblings', select: Entry.id}}},
    {
      select: {
        id: Entry.id,
        siblings: {edge: 'siblings', includeSelf: true, select: Entry.id}
      }
    },
    {
      select: {
        id: Entry.id,
        translations: {
          edge: 'translations',
          includeSelf: true,
          select: Entry.id
        }
      }
    },
    {select: {id: Entry.id, parent: {edge: 'parent', select: Entry.id}}},
    {select: {id: Entry.id, next: {edge: 'next', select: Entry.id}}},
    {select: {id: Entry.id, previous: {edge: 'previous', select: Entry.id}}},
    {
      select: {
        children: {
          edge: 'children',
          select: {id: Entry.id, parents: {edge: 'parents', count: true}}
        }
      }
    }
  ]
  for (const query of cases)
    expect(await runtime.resolve(query)).toEqual(await resolver.resolve(query))
})

function replacement(id: string, title = id): EntryReplacement {
  const entry: IndexedEntry = {
    id,
    title,
    type: 'Page',
    locale: null,
    versionStatus: 'published',
    status: 'published',
    workspace: 'main',
    root: 'pages',
    parentId: null,
    parents: [],
    level: 0,
    index: id,
    path: id,
    url: `/${id}`,
    active: true,
    main: true,
    seeded: null,
    rowHash: title
  }
  return {entry, payloadId: `${id}:${title}`}
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return {promise, resolve}
}

test('hydrates projection after pagination and retains unchanged data across deltas', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const loaded: Array<string> = []
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      loaded.push(...requests.map(request => request.payloadId))
      return requests.map(request => ({
        ...request,
        data: {value: request.payloadId}
      }))
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'b', 'c'].map(id => replacement(id))
  })
  expect(await runtime.resolve({select: Entry.id, take: 1})).toEqual(['a'])
  expect(loaded).toEqual([])
  expect(await runtime.resolve({select: Entry.data, skip: 1, take: 1})).toEqual(
    [{value: 'b:b'}]
  )
  expect(loaded).toEqual(['b:b'])
  await runtime.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [replacement('a', 'new')]
  })
  expect(await runtime.resolve({select: Entry.data, skip: 1, take: 1})).toEqual(
    [{value: 'b:b'}]
  )
  expect(loaded).toEqual(['b:b'])
  expect(await runtime.resolve({count: true, skip: 1, take: 1})).toBe(1)
  expect(loaded).toEqual(['b:b'])
})

test('data predicates hydrate candidates before limiting and do not confuse missing with null', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      return requests.map(request => ({
        ...request,
        data: request.payloadId.startsWith('b:')
          ? {metadata: {updatedAt: 7}}
          : {}
      }))
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'b', 'c'].map(id => replacement(id))
  })
  expect(
    await runtime.resolve({updatedAt: {gt: 5}, select: Entry.id, take: 1})
  ).toEqual(['b'])
  expect(await runtime.resolve({updatedAt: null, count: true})).toBe(0)
})

test('grouped counts hydrate membership and paginate groups rather than rows', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  let loads = 0
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      loads += requests.length
      return requests.map(request => ({
        ...request,
        data: {metadata: {updatedAt: 7}}
      }))
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'b', 'c'].map(id => replacement(id))
  })
  expect(await runtime.resolve({groupBy: Entry.updatedAt, count: true})).toBe(1)
  expect(loads).toBe(3)
  expect(
    await runtime.resolve({groupBy: Entry.updatedAt, count: true, skip: 1})
  ).toBe(0)
  expect(
    await runtime.resolve({
      groupBy: Entry.updatedAt,
      select: Entry.id,
      orderBy: {desc: Entry.id}
    })
  ).toEqual(['a'])
  expect(loads).toBe(3)
})

test('a delta during hydration discards the old payload and retries the new revision', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const started = deferred<void>()
  const pending = deferred<ReadonlyArray<LoadedPayload>>()
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      if (requests[0].payloadId === 'a:old') {
        started.resolve()
        return pending.promise
      }
      return requests.map(request => ({...request, data: {title: 'new'}}))
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [replacement('a', 'old')]
  })
  const result = runtime.resolve({select: Entry.data})
  await started.promise
  await runtime.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [replacement('a', 'new')]
  })
  pending.resolve([
    {
      versionId: entryVersionId('a', null, 'published'),
      payloadId: 'a:old',
      data: {title: 'old'}
    }
  ])
  expect(await result).toEqual([{title: 'new'}])
})

test('nested hydration retries the entire projection after a delta', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const started = deferred<void>()
  const pending = deferred<void>()
  const loaded: Array<string> = []
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      loaded.push(...requests.map(request => request.payloadId))
      started.resolve()
      await pending.promise
      return requests.map(request => ({...request, data: {child: true}}))
    }
  })
  const child = replacement('child')
  Object.assign(child.entry, {
    parentId: 'parent',
    parents: ['parent'],
    level: 1
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [replacement('parent', 'old'), child, replacement('unrelated')]
  })
  const result = runtime.resolve({
    id: 'parent',
    select: {
      title: Entry.title,
      nested: {children: {edge: 'children', select: Entry.data}}
    }
  })
  await started.promise
  await runtime.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [replacement('parent', 'new')]
  })
  pending.resolve()
  expect(await result).toEqual([
    {title: 'new', nested: {children: [{child: true}]}}
  ])
  expect(loaded).toEqual(['child:child', 'child:child'])
})

test('relations preserve locale boundaries and translations include null locales', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db)
  const entries: Array<EntryReplacement> = []
  for (const locale of [null, 'en', 'nl']) {
    const parent = replacement('parent')
    const child = replacement('child')
    Object.assign(parent.entry, {locale, ordinal: entries.length})
    Object.assign(child.entry, {
      locale,
      ordinal: entries.length + 1,
      parentId: 'parent',
      parents: ['parent'],
      level: 1
    })
    entries.push(parent, child)
  }
  await runtime.apply({fromRevision: 'empty', toRevision: 'r1', entries})
  expect(
    await runtime.resolve({
      id: 'parent',
      locale: 'en',
      select: {
        children: {edge: 'children', select: Entry.locale},
        translations: {edge: 'translations', select: Entry.locale}
      }
    })
  ).toEqual([{children: ['en'], translations: [null, 'nl']}])
})

test('a revoked in-flight payload failure retries the current revision', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const started = deferred<void>()
  const revoked = deferred<void>()
  const runtime = new EntryRuntime(config, db, {
    async load() {
      started.resolve()
      await revoked.promise
      throw new Error('Old grant revoked')
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [replacement('a')]
  })
  const result = runtime.resolve({select: Entry.data})
  await started.promise
  await runtime.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [],
    removedVersionIds: [entryVersionId('a', null, 'published')]
  })
  revoked.resolve()
  expect(await result).toEqual([])
})

test('duplicate payload responses fail without poisoning the cache', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  let duplicate = true
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      const payloads = requests.map(request => ({...request, data: {ok: true}}))
      return duplicate ? [...payloads, ...payloads] : payloads
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [replacement('a')]
  })
  await expect(runtime.resolve({select: Entry.data})).rejects.toThrow(
    'duplicate'
  )
  duplicate = false
  expect(await runtime.resolve({select: Entry.data})).toEqual([{ok: true}])
})

test('live queries include new matches and unsubscribe cleanly', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [replacement('a')]
  })
  const first = deferred<unknown>()
  const next = deferred<unknown>()
  let deliveries = 0
  const errors: Array<unknown> = []
  const unsubscribe = runtime.subscribe(
    {id: 'b', select: Entry.title},
    {
      next(value) {
        if (++deliveries === 1) first.resolve(value)
        else next.resolve(value)
      },
      error(error) {
        errors.push(error)
      }
    }
  )
  expect(await first.promise).toEqual([])
  await runtime.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [replacement('b', 'new match')]
  })
  expect(await next.promise).toEqual(['new match'])
  unsubscribe()
  await runtime.apply({
    fromRevision: 'r2',
    toRevision: 'r3',
    entries: [],
    removedVersionIds: [entryVersionId('b', null, 'published')]
  })
  expect(await runtime.resolve({select: Entry.id})).toEqual(['a'])
  expect(deliveries).toBe(2)
  expect(errors).toEqual([])
})

test('failed deltas roll back and unreadable payloads never produce partial results', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db)
  await expect(
    runtime.apply({
      fromRevision: 'empty',
      toRevision: 'bad',
      entries: [replacement('a'), replacement('a')]
    })
  ).rejects.toThrow('Duplicate')
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [{entry: replacement('b').entry}]
  })
  expect(await runtime.resolve({select: Entry.id})).toEqual(['b'])
  await expect(runtime.resolve({select: Entry.data})).rejects.toThrow(
    'not readable'
  )
  await expect(
    runtime.apply({fromRevision: 'empty', toRevision: 'r2', entries: []})
  ).rejects.toThrow('revision mismatch')
})
