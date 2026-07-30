import {expect, test} from 'bun:test'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {optionsAtom} from './user.js'
import {
  navigationAtom,
  prepareInitialContentAtom,
  routeAtom
} from './routing.js'
import {type TreeSnapshot, workspaceAtoms} from './config.js'

test('initial navigation expands the routed entry parent chain', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  const options = store.get(optionsAtom)
  store.set(optionsAtom, {
    ...options,
    history: {
      read: () => ({
        page: 'entry',
        workspace: 'main',
        root: 'pages',
        entry: child._id
      }),
      push() {},
      replace() {},
      subscribe: () => () => {}
    }
  })

  await store.set(prepareInitialContentAtom)

  const workspace = workspaceAtoms('main')
  expect(store.get(workspace.tree.expandedKeys)).toEqual(new Set([parent._id]))
  expect(
    store
      .get(workspace.tree.snapshot(workspace.root('pages')))
      .children.get(parent._id)
      ?.map(entry => entry.id)
  ).toEqual([child._id])
})

test('navigation commits with its tree snapshot prepared', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  const navigation = store.get(navigationAtom)
  store.set(navigation.prepared, {
    type: 'empty',
    canManageMembers: false
  })
  const workspace = workspaceAtoms('main')

  await store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: child._id
  })

  expect(
    store
      .get(workspace.tree.snapshot(workspace.root('pages')))
      .children.get(parent._id)
      ?.map(entry => entry.id)
  ).toEqual([child._id])
  expect(store.get(navigation.pending)).toBeUndefined()
  expect(store.get(navigation.route).entry).toBe(child._id)
})

test('tree expansion retains previously expanded entries on navigation', async () => {
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

  expect(store.get(tree.expandedKeys)).toEqual(
    new Set([parent._id, 'manual-entry'])
  )
})

test('tree snapshot exposes children of expanded entries', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  await store.set(prepareInitialContentAtom)
  const workspace = workspaceAtoms('main')
  const tree = workspace.tree
  const root = workspace.root('pages')

  store.set(tree.expandedKeys, new Set([parent._id]))
  const snapshotAtom = tree.snapshot(root)
  const snapshot = await new Promise<TreeSnapshot>(resolve => {
    let unsubscribe = () => {}
    function readSnapshot() {
      const current = store.get(snapshotAtom)
      if (!current.children.has(parent._id)) return
      unsubscribe()
      resolve(current)
    }
    unsubscribe = store.sub(snapshotAtom, readSnapshot)
    readSnapshot()
  })

  expect(snapshot.children.get(parent._id)?.map(entry => entry.id)).toEqual([
    child._id
  ])
})

test('requested route follows tree navigation synchronously', async () => {
  const {child, store} = await createDashboardAtomFixture()
  const navigation = store.get(navigationAtom)
  store.set(navigation.prepared, {
    type: 'empty',
    canManageMembers: false
  })
  const result = store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: child._id
  })
  expect(store.get(navigation.requestedRoute).entry).toBe(child._id)
  expect(store.get(navigation.pending)).toBeUndefined()
  await result
})
