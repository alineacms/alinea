import {cms} from '#test/cms.js'
import {createTestConnection} from '#test/CreateConnection.js'
import type {LocalConnection} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith} from '#/core/source/Source.js'
import {expect, test} from 'bun:test'
import {DashboardWorker} from './DashboardWorker.js'

test('discarding failed mutations restores the remote state', async () => {
  const fixture = new FSSource('test/fixtures/demo')
  const remoteDB = new LocalDB(cms.config, fixture)
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
  worker.dispatchEvent = () => true
  await worker.load('test', cms.config, client)
  await initialSyncStarted
  const db = await worker.db
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
  await worker.queue('test-mutation', [mutation])
  await recoveryFailed
  expect(
    await db.get({type: cms.schema.DemoRecipe, id: original._id})
  ).toMatchObject({title: 'Optimistic title'})

  unavailable = false
  await worker.discardQueue()

  expect(
    await db.get({type: cms.schema.DemoRecipe, id: original._id})
  ).toMatchObject({title: original.title})
})
