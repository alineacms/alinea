import {expect, test} from 'bun:test'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {navigationAtom, routeAtom} from './routing.js'
import {workspaceAtoms} from './config.js'

test('tree expansion follows the routed entry parent chain', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  const navigation = store.get(navigationAtom)
  store.set(navigation.prepared, {
    type: 'empty',
    canManageMembers: false
  })
  const tree = workspaceAtoms('main').tree

  expect(store.get(tree.expandedKeys)).toEqual(new Set())

  await store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: child._id
  })

  expect(store.get(tree.expandedKeys)).toEqual(new Set([parent._id]))

  store.set(tree.expandedKeys, new Set([parent._id, 'manual-entry']))
  await store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: parent._id
  })

  expect(store.get(tree.expandedKeys)).toEqual(new Set(['manual-entry']))
})
