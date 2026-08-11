import {expect, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {createStore} from 'jotai'
import {eventsAtom, graphAtom} from './core.js'
import {mutationQueueState} from './dashboard.js'
import {entryRevisionAtom, shaAtom, syncAtom} from './graph.js'
import {createDashboardAtomFixture, TestEvents} from '#test/DashboardFixture.js'

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

  events.emit(
    new IndexEvent({op: 'index', sha: 'changed-sha', ids: ['first']})
  )

  expect(store.get(first)).toBe('changed-sha')
  expect(store.get(second)).toBeUndefined()
  expect(firstChanges).toBe(1)
  expect(secondChanges).toBe(0)

  unsubscribeFirst()
  unsubscribeSecond()
})

test('summarizes mutation queue state without a store instance', () => {
  const state = mutationQueueState([
    {status: 'pending'},
    {status: 'syncing'},
    {status: 'failed', error: 'Broken'},
    {status: 'blocked'}
  ] as Parameters<typeof mutationQueueState>[0])

  expect(state.pending).toBe(1)
  expect(state.syncing).toBe(1)
  expect(state.failed).toBe(1)
  expect(state.blocked).toBe(1)
  expect(state.error).toBe('Broken')
})
