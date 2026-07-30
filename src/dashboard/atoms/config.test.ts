import {expect, test} from 'bun:test'
import {
  createDashboardAtomFixture,
  DashboardTestPage
} from '#test/DashboardFixture.js'
import {optionsAtom} from './user.js'
import {
  navigationAtom,
  pageAtom,
  pageResourceAtom,
  routeAtom
} from './routing.js'
import {type TreeSnapshot, workspaceAtoms} from './config.js'
import {entryAtoms} from './entry.js'
import {entryRevisionAtom} from './entry/load.js'
import {loadEntryData} from './explorer.js'

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

  const page = await store.get(pageResourceAtom)

  expect(
    page.sidebar?.snapshot.children.get(parent._id)?.map(entry => entry.id)
  ).toEqual([child._id])
  expect(page.sidebar?.expandedKeys).toEqual(new Set([parent._id]))
})

test('navigation commits with its tree snapshot prepared', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  const navigation = store.get(navigationAtom)
  await store.get(pageResourceAtom)

  await store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: child._id
  })
  const page = await store.get(pageAtom)

  expect(
    page.sidebar?.snapshot.children.get(parent._id)?.map(entry => entry.id)
  ).toEqual([child._id])
  expect(store.get(navigation.pending)).toBeUndefined()
  expect(store.get(navigation.route).entry).toBe(child._id)
})

test('tree expansion retains previously expanded entries on navigation', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  await store.get(pageResourceAtom)
  const tree = workspaceAtoms('main').tree

  expect(store.get(tree.expandedKeys)).toEqual(new Set())

  await store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: child._id
  })
  const page = await store.get(pageAtom)

  expect(page.sidebar?.expandedKeys).toEqual(new Set([parent._id]))

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
  await store.get(pageResourceAtom)
  const workspace = workspaceAtoms('main')
  const tree = workspace.tree
  const root = workspace.root('pages')

  store.set(tree.expandedKeys, new Set([parent._id]))
  await tree.prepare(store.get, root, null)
  const snapshot: TreeSnapshot = await store.get(tree.snapshot(root))

  expect(snapshot.children.get(parent._id)?.map(entry => entry.id)).toEqual([
    child._id
  ])
})

test('entry loading reports a removed entry instead of retained UI data', async () => {
  const {child, db, store} = await createDashboardAtomFixture()
  const entry = entryAtoms(child._id)

  expect((await loadEntryData(store.get, entry))?.id).toBe(child._id)
  await db.remove(child._id)
  store.set(entryRevisionAtom(child._id), revision => revision + 1)

  expect(await loadEntryData(store.get, entry)).toBeUndefined()
})

test('requested route changes after navigation is allowed', async () => {
  const {child, store} = await createDashboardAtomFixture()
  const navigation = store.get(navigationAtom)
  await store.get(pageResourceAtom)
  const result = store.set(routeAtom, {
    workspace: 'main',
    root: 'pages',
    entry: child._id
  })
  expect(store.get(navigation.requestedRoute).entry).toBeUndefined()
  expect(store.get(navigation.pending)).toBeUndefined()
  await Promise.resolve()
  expect(store.get(navigation.requestedRoute).entry).toBe(child._id)
  await result
})

test('navigation prepares a sibling entry from an entry page', async () => {
  const {child, db, store} = await createDashboardAtomFixture()
  const sibling = await db.create({
    type: DashboardTestPage,
    set: {title: 'Sibling'}
  })
  await store.get(pageResourceAtom)

  expect(
    await store.set(routeAtom, {
      workspace: 'main',
      root: 'pages',
      entry: child._id
    })
  ).toBe(true)
  expect(
    await store.set(routeAtom, {
      workspace: 'main',
      root: 'pages',
      entry: sibling._id
    })
  ).toBe(true)
  const page = await store.get(pageResourceAtom)
  expect(page.content.type).toBe('entry')
  if (page.content.type !== 'entry') return
  expect(page.content.entry.id).toBe(sibling._id)
})
