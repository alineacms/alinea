import {expect, spyOn, test} from 'bun:test'
import {createStore, type Atom} from 'jotai'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {linkEntryAtoms, type LinkEntryState} from './link.js'
import {authReady} from './user.js'

type Store = ReturnType<typeof createStore>

function waitForChange(store: Store, value: Atom<LinkEntryState>) {
  return new Promise<void>(resolve => {
    const unsubscribe = store.sub(value, () => {
      unsubscribe()
      resolve()
    })
  })
}

test('batches link entry reads started in the same turn', async () => {
  const {child, db, parent, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const resolve = spyOn(db, 'resolve')
  const parentEntry = linkEntryAtoms(parent._id)
  const childEntry = linkEntryAtoms(child._id)

  const changed = [
    waitForChange(store, parentEntry),
    waitForChange(store, childEntry)
  ]

  expect(store.get(parentEntry)).toEqual({state: 'loading'})
  expect(store.get(childEntry)).toEqual({state: 'loading'})
  await Promise.all(changed)

  expect(resolve).toHaveBeenCalledTimes(1)
  expect(resolve.mock.calls[0][0]).toMatchObject({
    id: {in: [parent._id, child._id]}
  })
  expect(store.get(parentEntry)).toMatchObject({
    state: 'hasData',
    data: {id: parent._id, title: 'Parent draft'}
  })
  expect(store.get(childEntry)).toMatchObject({
    state: 'hasData',
    data: {id: child._id, title: 'Child'}
  })
  resolve.mockRestore()
})

test('contains link entry load errors in the atom state', async () => {
  const {child, db, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const error = new Error('Could not load link entry')
  const resolve = spyOn(db, 'resolve').mockRejectedValue(error)
  const linkEntry = linkEntryAtoms(child._id)

  const changed = waitForChange(store, linkEntry)

  expect(store.get(linkEntry)).toEqual({state: 'loading'})
  await changed

  expect(store.get(linkEntry)).toEqual({state: 'hasError', error})
  resolve.mockRestore()
})
