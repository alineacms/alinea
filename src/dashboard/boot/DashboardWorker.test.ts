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

  const load = worker.load('sync-status', cms.config, client)
  await syncStarted

  expect(statuses).toEqual(['running'])
  expect(worker.activities()).toEqual([
    expect.objectContaining({type: 'fetch', status: 'running'})
  ])

  releaseSync?.()
  await load

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
  const db = await worker.db
  if (!(db instanceof LocalDB)) throw new Error('Expected local database')
  // Index notifications are orthogonal to the activity behavior under test.
  db.index.dispatchEvent = () => true
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
  const client: LocalConnection = {
    ...baseClient,
    getTreeIfDifferent(sha) {
      remoteSyncs++
      return baseClient.getTreeIfDifferent(sha)
    }
  }
  const worker = new DashboardWorker(localSource)
  worker.dispatchEvent = () => true

  await worker.load('incompatible-cache', cms.config, client)

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
  await initialSyncStarted
  const db = await worker.db
  if (!(db instanceof LocalDB)) throw new Error('Expected local database')
  // Index notifications are orthogonal to the queue behavior under test.
  db.index.dispatchEvent = () => true
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
