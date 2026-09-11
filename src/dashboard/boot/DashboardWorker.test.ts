import {cms} from '#test/cms.js'
import {createTestConnection} from '#test/CreateConnection.js'
import type {LocalConnection} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {FSSource} from '#/core/source/FSSource.js'
import {IndexedDBSource} from '#/core/source/IndexedDBSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith} from '#/core/source/Source.js'
import {expect, test} from 'bun:test'
import {indexedDB} from 'fake-indexeddb'
import {ActivityEvent} from './ActivityEvent.js'
import {DashboardWorker} from './DashboardWorker.js'

test('loads local state without starting a remote sync', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let remoteSyncs = 0
  const client: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      remoteSyncs += 1
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(new MemorySource())

  await worker.load('deferred-remote', cms.config, client)

  expect(remoteSyncs).toBe(0)
  expect(worker.activities()).toEqual([])

  await worker.sync()

  expect(remoteSyncs).toBe(1)
  expect(
    await (
      await worker.db
    ).get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip'
    })
  ).toMatchObject({title: 'Chocolate chip'})
})

test('serializes concurrent sync requests and waits for each result', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let remoteSyncs = 0
  let releaseSync: (() => void) | undefined
  let markSyncStarted: (() => void) | undefined
  const syncStarted = new Promise<void>(resolve => {
    markSyncStarted = resolve
  })
  const holdSync = new Promise<void>(resolve => {
    releaseSync = resolve
  })
  const client: LocalConnection = {
    ...baseClient,
    async getTreeIfDifferent(sha) {
      remoteSyncs += 1
      markSyncStarted?.()
      await holdSync
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(new MemorySource())
  await worker.load('coalesced-sync', cms.config, client)

  const first = worker.sync()
  const second = worker.sync()

  await syncStarted
  expect(remoteSyncs).toBe(1)

  let settled = false
  void second.then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)

  releaseSync?.()
  await Promise.all([first, second])

  expect(settled).toBe(true)
  expect(remoteSyncs).toBe(2)
})

test('queues a separate sync when the revision changes', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let firstRemoteSyncs = 0
  let secondRemoteSyncs = 0
  let releaseFirstSync: (() => void) | undefined
  let markFirstSyncStarted: (() => void) | undefined
  const firstSyncStarted = new Promise<void>(resolve => {
    markFirstSyncStarted = resolve
  })
  const holdFirstSync = new Promise<void>(resolve => {
    releaseFirstSync = resolve
  })
  const firstClient: LocalConnection = {
    ...baseClient,
    async getTreeIfDifferent(sha) {
      firstRemoteSyncs += 1
      markFirstSyncStarted?.()
      await holdFirstSync
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const secondClient: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      secondRemoteSyncs += 1
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(new MemorySource())
  await worker.load('first-revision', cms.config, firstClient)
  const first = worker.sync()
  await firstSyncStarted

  await worker.load('second-revision', cms.config, secondClient)
  const second = worker.sync()

  expect(secondRemoteSyncs).toBe(0)

  releaseFirstSync?.()
  await Promise.all([first, second])

  expect(firstRemoteSyncs).toBe(1)
  expect(secondRemoteSyncs).toBe(1)
})

test('waits for a new revision to finish loading before syncing it', async () => {
  const source = new MemorySource()
  const getTree = source.getTree.bind(source)
  let holdNextTreeRead = false
  let releaseTreeRead: (() => void) | undefined
  let markTreeReadStarted: (() => void) | undefined
  const treeReadStarted = new Promise<void>(resolve => {
    markTreeReadStarted = resolve
  })
  const holdTreeRead = new Promise<void>(resolve => {
    releaseTreeRead = resolve
  })
  source.getTree = async () => {
    if (holdNextTreeRead) {
      markTreeReadStarted?.()
      await holdTreeRead
    }
    return getTree()
  }
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let firstRemoteSyncs = 0
  let secondRemoteSyncs = 0
  const firstClient: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      firstRemoteSyncs += 1
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const secondClient: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      secondRemoteSyncs += 1
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(source)
  await worker.load('first-loaded-revision', cms.config, firstClient)

  holdNextTreeRead = true
  const load = worker.load('loading-revision', cms.config, secondClient)
  await treeReadStarted
  const sync = worker.sync()
  await Promise.resolve()

  expect(firstRemoteSyncs).toBe(0)
  expect(secondRemoteSyncs).toBe(0)

  holdNextTreeRead = false
  releaseTreeRead?.()
  await load
  await sync

  expect(firstRemoteSyncs).toBe(0)
  expect(secondRemoteSyncs).toBe(1)
})

test('keeps syncs bound to their load across a failed revision', async () => {
  const source = new MemorySource()
  const getTree = source.getTree.bind(source)
  let failNextTreeRead = false
  source.getTree = async () => {
    if (failNextTreeRead) {
      failNextTreeRead = false
      throw new Error('Invalid local cache')
    }
    return getTree()
  }
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let releaseFirstSync: (() => void) | undefined
  let markFirstSyncStarted: (() => void) | undefined
  const firstSyncStarted = new Promise<void>(resolve => {
    markFirstSyncStarted = resolve
  })
  const holdFirstSync = new Promise<void>(resolve => {
    releaseFirstSync = resolve
  })
  const firstClient: LocalConnection = {
    ...baseClient,
    async getTreeIfDifferent(sha) {
      markFirstSyncStarted?.()
      await holdFirstSync
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  let recoveredRemoteSyncs = 0
  const recoveredClient: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      recoveredRemoteSyncs += 1
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(source)
  await worker.load('loaded-before-failure', cms.config, firstClient)
  const firstSync = worker.sync()
  await firstSyncStarted

  failNextTreeRead = true
  const failedLoad = worker.load(
    'failed-loading-revision',
    cms.config,
    baseClient
  )
  const queuedSync = worker.sync()
  const queuedSyncError = queuedSync.catch(error => error)

  await expect(failedLoad).rejects.toThrow('Invalid local cache')
  expect(await queuedSyncError).toEqual(
    expect.objectContaining({message: 'Failed to load database'})
  )

  await worker.load('loaded-before-failure', cms.config, recoveredClient)
  const recoveredSync = worker.sync()

  releaseFirstSync?.()
  await Promise.all([firstSync, recoveredSync])

  expect(recoveredRemoteSyncs).toBe(1)
})

test('records remote database sync activity and keeps its outcome', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()

  const baseClient = createTestConnection(remoteDB)
  let releaseSync: (() => void) | undefined
  let markSyncStarted: (() => void) | undefined
  const syncStarted = new Promise<void>(resolve => {
    markSyncStarted = resolve
  })
  const holdSync = new Promise<void>(resolve => {
    releaseSync = resolve
  })
  const client: LocalConnection = {
    ...baseClient,
    async getTreeIfDifferent(sha) {
      markSyncStarted?.()
      await holdSync
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(new MemorySource())
  const statuses: Array<string> = []
  worker.addEventListener(ActivityEvent.type, event => {
    if (event instanceof ActivityEvent)
      statuses.push(event.activities[0]?.status ?? 'missing')
  })

  await worker.load('sync-status', cms.config, client)
  const sync = worker.sync()
  await syncStarted

  expect(statuses).toEqual(['running'])
  expect(worker.activities()).toEqual([
    expect.objectContaining({type: 'fetch', status: 'running'})
  ])

  releaseSync?.()
  await sync

  expect(statuses).toEqual(['running', 'succeeded'])
  expect(worker.activities()).toEqual([
    expect.objectContaining({
      type: 'fetch',
      status: 'succeeded',
      finishedAt: expect.any(Number)
    })
  ])
})

test('keeps successful content actions in activity history', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteSource = new MemorySource()
  await syncWith(remoteSource, fixture)
  const remoteDB = new LocalDB(cms.config, remoteSource)
  await remoteDB.sync()

  const worker = new DashboardWorker(new MemorySource())
  await worker.load(
    'content-activity-history',
    cms.config,
    createTestConnection(remoteDB)
  )
  await worker.sync()
  const db = await worker.db
  const original = await db.get({
    type: cms.schema.DemoRecipe,
    path: 'chocolate-chip'
  })
  const completed = new Promise<void>(resolve => {
    worker.addEventListener(ActivityEvent.type, event => {
      if (
        event instanceof ActivityEvent &&
        event.activities.some(
          activity =>
            activity.id === 'successful-mutation' &&
            activity.status === 'succeeded'
        )
      )
        resolve()
    })
  })

  await worker.queue('successful-mutation', [
    {
      op: 'create',
      id: original._id,
      type: original._type,
      locale: null,
      status: 'draft',
      overwrite: true,
      data: {title: 'Updated title'}
    }
  ])
  await completed

  expect(worker.activities()).toContainEqual(
    expect.objectContaining({
      id: 'successful-mutation',
      type: 'mutation',
      status: 'succeeded',
      target: {
        workspace: original._workspace,
        root: original._root,
        entry: original._id,
        locale: null
      },
      finishedAt: expect.any(Number)
    })
  )
})

test('recovers from an incompatible IndexedDB cache using the remote source', async () => {
  const staleSource = new MemorySource()
  const contents = new TextEncoder().encode(
    JSON.stringify({
      _id: 'stale-entry',
      _type: 'DemoHome',
      _index: 'a0',
      _root: 'removed-root',
      title: 'Stale entry'
    })
  )
  const sha = await staleSource.addBlob(contents)
  await staleSource.applyChanges({
    fromSha: (await staleSource.getTree()).sha,
    changes: [
      {
        op: 'add',
        path: 'removed-root/index.json',
        sha,
        contents
      }
    ]
  })
  const localSource = new IndexedDBSource(
    indexedDB,
    'dashboard-worker-incompatible-cache'
  )
  await syncWith(localSource, staleSource)
  await expect(new LocalDB(cms.config, localSource).sync()).rejects.toThrow(
    'Invalid root: removed-root'
  )

  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let remoteSyncs = 0
  let remoteUnavailable = true
  const client: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      remoteSyncs++
      if (remoteUnavailable) throw new Error('Remote unavailable')
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(localSource)
  worker.dispatchEvent = () => true

  await worker.load('incompatible-cache', cms.config, client)
  await expect(worker.sync()).rejects.toThrow(
    'Failed to load cached content and fetch remote updates\n' +
      'Cached content: Invalid root: removed-root for workspace demo\n' +
      'Remote updates: Remote unavailable'
  )

  remoteUnavailable = false
  await worker.retryActivity()

  expect(remoteSyncs).toBe(2)
  expect(
    await (
      await worker.db
    ).get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip'
    })
  ).toMatchObject({title: 'Chocolate chip'})

  remoteUnavailable = true
  await expect(worker.sync()).rejects.toThrow('Remote unavailable')
  expect(remoteSyncs).toBe(3)
})

test('retries a failed initial sync', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
  await remoteDB.sync()
  const baseClient = createTestConnection(remoteDB)
  let unavailable = true
  const client: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      if (unavailable) throw new Error('Remote unavailable')
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(new MemorySource())
  await worker.load('retry-initial-sync', cms.config, client)

  await expect(worker.sync()).rejects.toThrow('Remote unavailable')

  unavailable = false
  await worker.sync()

  expect(
    await (
      await worker.db
    ).get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip'
    })
  ).toMatchObject({title: 'Chocolate chip'})
})

test('retrying failed mutations clears the preceding fetch failure', async () => {
  const {db, original, setUnavailable, worker} =
    await createFailedMutationFixture()

  setUnavailable(false)
  await worker.retryActivity()

  expect(
    await db.get({type: cms.schema.DemoRecipe, id: original._id})
  ).toMatchObject({title: 'Optimistic title'})
  expect(
    worker.activities().find(activity => activity.id === 'test-mutation')
  ).toMatchObject({status: 'succeeded'})
  expect(
    worker.activities().find(activity => activity.type === 'fetch')
  ).toMatchObject({status: 'succeeded'})
})

test('discarding failed mutations restores the remote state', async () => {
  const {db, original, setUnavailable, worker} =
    await createFailedMutationFixture()

  setUnavailable(false)
  await worker.discardActivity()

  expect(
    await db.get({type: cms.schema.DemoRecipe, id: original._id})
  ).toMatchObject({title: original.title})
  expect(worker.activities()).toContainEqual(
    expect.objectContaining({
      id: 'test-mutation',
      type: 'mutation',
      status: 'discarded'
    })
  )
})

async function createFailedMutationFixture() {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteSource = new MemorySource()
  await syncWith(remoteSource, fixture)
  const remoteDB = new LocalDB(cms.config, remoteSource)
  await remoteDB.sync()

  const localSource = new MemorySource()
  await syncWith(localSource, fixture)

  const baseClient = createTestConnection(remoteDB)
  let unavailable = false
  let initialSync: (() => void) | undefined
  let failedRecovery: (() => void) | undefined
  const initialSyncStarted = new Promise<void>(resolve => {
    initialSync = resolve
  })
  const recoveryFailed = new Promise<void>(resolve => {
    failedRecovery = resolve
  })
  const client: LocalConnection = {
    ...baseClient,
    mutate(mutations) {
      if (unavailable) return Promise.reject(new Error('Remote unavailable'))
      return baseClient.mutate(mutations)
    },
    async getTreeIfDifferent(sha) {
      if (unavailable) {
        failedRecovery?.()
        throw new Error('Remote unavailable')
      }
      initialSync?.()
      return baseClient.getTreeIfDifferent(sha)
    },
    async *getBlobs(shas) {
      if (unavailable) throw new Error('Remote unavailable')
      yield* baseClient.getBlobs(shas)
    }
  }

  const worker = new DashboardWorker(localSource)
  await worker.load('test', cms.config, client)
  const sync = worker.sync()
  await initialSyncStarted
  await sync
  const db = await worker.db
  const original = await db.get({
    type: cms.schema.DemoRecipe,
    path: 'chocolate-chip'
  })
  const mutation: Mutation = {
    op: 'update',
    id: original._id,
    locale: null,
    status: 'published',
    set: {title: 'Optimistic title'}
  }
  unavailable = true
  const fetchFailure = new Promise<void>(resolve => {
    worker.addEventListener(ActivityEvent.type, event => {
      if (
        event instanceof ActivityEvent &&
        event.activities.some(
          activity => activity.type === 'fetch' && activity.status === 'failed'
        )
      )
        resolve()
    })
  })
  await worker.queue('test-mutation', [mutation])
  await recoveryFailed
  await fetchFailure
  expect(
    await db.get({type: cms.schema.DemoRecipe, id: original._id})
  ).toMatchObject({title: 'Optimistic title'})
  expect(worker.activities()).toContainEqual(
    expect.objectContaining({
      type: 'fetch',
      status: 'failed',
      error: 'Remote unavailable'
    })
  )
  return {
    db,
    original,
    setUnavailable(value: boolean) {
      unavailable = value
    },
    worker
  }
}
