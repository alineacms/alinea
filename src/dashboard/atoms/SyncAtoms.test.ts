import {expect, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {createStore} from 'jotai'
import {eventsAtom, graphAtom} from './CoreAtoms.js'
import {shaAtom, syncAtom} from './SyncAtoms.js'
import {
  createDashboardAtomFixture,
  TestEvents
} from '#test/DashboardAtomsFixture.js'

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
