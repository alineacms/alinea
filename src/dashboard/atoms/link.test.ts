import {expect, test} from 'bun:test'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {authReady} from './user.js'
import {linkEntryAtoms} from './link.js'

test('preloading a link entry primes its synchronous atom', async () => {
  const {child, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const linkEntry = linkEntryAtoms(child._id)

  const ready = await store.get(linkEntry.ready)

  expect(ready?.title).toBe('Child')
  expect(store.get(linkEntry.value)).toEqual(ready)
})
