import {expect, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {createStore} from 'jotai'
import {activityState} from './activity.js'
import {eventsAtom, graphAtom} from './core.js'
import {activityAtom} from './activity.js'
import {entryRevisionAtom, graphReadyAtom, shaAtom, syncAtom} from './graph.js'
import {createDashboardAtomFixture, TestEvents} from '#test/DashboardFixture.js'

test('waits for the initial graph sync', async () => {
  const {db} = await createDashboardAtomFixture()
  let releaseSync: (() => void) | undefined
  let markSyncStarted: (() => void) | undefined
  const syncStarted = new Promise<void>(resolve => {
    markSyncStarted = resolve
  })
  const syncReady = new Promise<void>(resolve => {
    releaseSync = resolve
  })
  db.sync = async () => {
    markSyncStarted?.()
    await syncReady
    return db.sha
  }
  const store = createStore()
  store.set(graphAtom, db)

  const ready = store.get(graphReadyAtom)
  await syncStarted
  let settled = false
  void ready.then(() => {
    settled = true
  })

  expect(settled).toBe(false)

  releaseSync?.()
  await ready

  expect(settled).toBe(true)
})

test('reads the indexed content hash without synchronizing the graph', async () => {
  const {db} = await createDashboardAtomFixture()
  const store = createStore()
  const events = new TestEvents()
  let syncs = 0
  const sync = db.sync.bind(db)
  db.sync = async () => {
    syncs++
    return sync()
  }
  store.set(graphAtom, db)
  store.set(eventsAtom, events)

  expect(await store.get(shaAtom)).toBe(db.sha)
  expect(syncs).toBe(0)

  const unsubscribe = store.sub(shaAtom, () => {})
  events.emit(new IndexEvent({op: 'index', sha: 'external-sha', ids: []}))

  expect(await store.get(shaAtom)).toBe('external-sha')

  const sha = await store.set(syncAtom)
  unsubscribe()

  expect(syncs).toBe(1)
  expect(sha).toBeString()
  expect(await store.get(shaAtom)).toBe(sha)
})

test('only invalidates revisions for changed entry ids', async () => {
  const {db} = await createDashboardAtomFixture()
  const store = createStore()
  const events = new TestEvents()
  store.set(graphAtom, db)
  store.set(eventsAtom, events)

  const first = entryRevisionAtom('first')
  const second = entryRevisionAtom('second')
  let firstChanges = 0
  let secondChanges = 0
  const unsubscribeFirst = store.sub(first, () => firstChanges++)
  const unsubscribeSecond = store.sub(second, () => secondChanges++)

  events.emit(new IndexEvent({op: 'index', sha: 'changed-sha', ids: ['first']}))

  expect(store.get(first)).toBe('changed-sha')
  expect(store.get(second)).toBeUndefined()
  expect(firstChanges).toBe(1)
  expect(secondChanges).toBe(0)

  unsubscribeFirst()
  unsubscribeSecond()
})

test('summarizes current activity without hiding its history', () => {
  const state = activityState([
    {
      id: 'pending',
      type: 'mutation',
      status: 'pending',
      operations: [],
      startedAt: 4
    },
    {
      id: 'failed',
      type: 'mutation',
      status: 'failed',
      operations: [],
      startedAt: 3,
      finishedAt: 4,
      error: 'Broken'
    },
    {
      id: 'blocked',
      type: 'mutation',
      status: 'blocked',
      operations: [],
      startedAt: 2
    },
    {
      id: 'completed',
      type: 'upload',
      status: 'succeeded',
      operations: [],
      startedAt: 1,
      finishedAt: 2
    }
  ])

  expect(state.items).toHaveLength(4)
  expect(state.isMutating).toBe(true)
  expect(state.hasFailed).toBe(true)
  expect(state.hasBlocked).toBe(true)
  expect(state.canRetry).toBe(true)
  expect(state.canDiscard).toBe(false)
})

test('a failed upload can be discarded but not retried', () => {
  const state = activityState([
    {
      id: 'failed-upload',
      type: 'upload',
      status: 'failed',
      operations: [],
      startedAt: 1,
      finishedAt: 2,
      error: 'Upload failed'
    }
  ])

  expect(state.hasFailed).toBe(true)
  expect(state.canRetry).toBe(false)
  expect(state.canDiscard).toBe(true)
})

test('hydrates activity after a worker action already started', async () => {
  const {db} = await createDashboardAtomFixture()
  const store = createStore()
  const events = new TestEvents()
  const graph = Object.assign(db, {
    async activities() {
      return [
        {
          id: 'mutation',
          type: 'mutation',
          status: 'running',
          operations: [],
          startedAt: Date.now()
        }
      ]
    }
  })
  store.set(graphAtom, graph)
  store.set(eventsAtom, events)

  const unsubscribe = store.sub(activityAtom, () => {})
  await Promise.resolve()

  expect(store.get(activityAtom).isMutating).toBe(true)

  unsubscribe()
})
