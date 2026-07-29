import {expect, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {createStore} from 'jotai'
import {
  createMutationQueueState,
  eventsAtom,
  graphAtom,
  shaAtom,
  syncAtom
} from './GraphAtoms.js'
import {createDashboardAtomFixture, TestEvents} from '#test/DashboardFixture.js'

test('reading content state never synchronizes the graph', async () => {
  const {db} = await createDashboardAtomFixture()
  const store = createStore()
  const events = new TestEvents()
  store.set(graphAtom, db)
  store.set(eventsAtom, events)

  expect(await store.get(shaAtom)).toBeUndefined()

  const unsubscribe = store.sub(shaAtom, () => {})
  events.emit(new IndexEvent({op: 'index', sha: 'external-sha'}))

  expect(await store.get(shaAtom)).toBe('external-sha')

  const sha = await store.set(syncAtom)
  unsubscribe()

  expect(sha).toBeString()
  expect(await store.get(shaAtom)).toBe(sha)
})

test('summarizes mutation queue state without a store instance', () => {
  const state = createMutationQueueState([
    {status: 'pending'},
    {status: 'syncing'},
    {status: 'failed', error: 'Broken'},
    {status: 'blocked'}
  ] as Parameters<typeof createMutationQueueState>[0])

  expect(state.pending).toBe(1)
  expect(state.syncing).toBe(1)
  expect(state.failed).toBe(1)
  expect(state.blocked).toBe(1)
  expect(state.error).toBe('Broken')
})
