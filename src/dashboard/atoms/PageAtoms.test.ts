import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import type {PreparedRoute} from './loaders/Route.js'
import {navigationAtom} from './NavigationAtoms.js'
import {currentEntryAtom, pageAtom} from './PageAtoms.js'
import {createNavigation} from './navigation/Navigation.js'

test('page atoms require navigation to commit prepared data', () => {
  const navigation = createNavigation<PreparedRoute>({
    history: {
      read: () => ({page: 'entry'}),
      push() {},
      replace() {},
      subscribe: () => () => {}
    },
    prepare: async () => ({type: 'empty', canManageMembers: false}) as const
  })
  const store = createStore()
  store.set(navigationAtom, navigation)

  expect(() => store.get(pageAtom)).toThrow(
    'Dashboard page was read before it was prepared'
  )

  const page = {type: 'empty', canManageMembers: false} as const
  store.set(navigation.prepared, page)

  expect(store.get(pageAtom)).toBe(page)
  expect(store.get(currentEntryAtom)).toBeNull()
})
