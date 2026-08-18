import {expect, test} from 'bun:test'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {atom, createStore} from 'jotai'
import {LucideFile} from '../icons.js'
import {
  createExplorerAtoms,
  ExplorerEntry,
  type ExplorerItemData
} from './explorer.js'
import {authReady} from './user.js'

function folderEntry(value: ExplorerItemData) {
  const item = atom(value)
  const root = atom({icon: atom(LucideFile), label: atom('Pages')})
  return new ExplorerEntry(value.id, value, item, root)
}

test('picker rows select instead of navigating the dashboard', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {enableNavigation: true, onConfirm() {}}
  )
  const folder = folderEntry({
    id: 'folder',
    title: 'Folder',
    path: 'folder',
    type: 'Folder',
    workspace: 'workspace',
    root: 'pages',
    locale: null,
    parentId: null,
    parents: [],
    index: 'a0',
    data: {},
    hasChildren: true
  })
  const store = createStore()

  expect(explorer.hasRowAction).toBe(false)
  store.set(explorer.onAction, folder, null)
  expect(store.get(explorer.location).parentId).toBe('folder')
})

test('page explorers keep their row navigation action', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {enableNavigation: true}
  )

  expect(explorer.hasRowAction).toBe(true)
  expect(explorer.items('en')).not.toBe(explorer.items('fr'))
})

test('limits the picker to its allowed locations', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'outside', root: 'outside'},
    {
      limitLocations: [
        {workspace: 'main', root: 'pages'},
        {workspace: 'main', root: 'media'}
      ]
    }
  )
  const store = createStore()

  expect(store.get(explorer.location)).toEqual({
    workspace: 'main',
    root: 'pages'
  })

  store.set(explorer.location, {workspace: 'main', root: 'media'})
  expect(store.get(explorer.location)).toEqual({
    workspace: 'main',
    root: 'media'
  })

  store.set(explorer.location, {workspace: 'outside', root: 'outside'})
  expect(store.get(explorer.location)).toEqual({
    workspace: 'main',
    root: 'pages'
  })
})

test('preloading items primes the synchronous items atom', async () => {
  const {store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const explorer = createExplorerAtoms({workspace: 'main', root: 'pages'}, {})

  const readyItems = await store.get(explorer.itemsReady(null))

  expect(readyItems).not.toBeEmpty()
  expect(store.get(explorer.items(null))).toEqual(readyItems)
})

test('preloading items includes expanded inline children', async () => {
  const {store, parent} = await createDashboardAtomFixture()
  await store.get(authReady)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {nestedNavigation: true}
  )
  store.set(explorer.expandedKeys, new Set([parent._id]))

  const items = await store.get(explorer.itemsReady(null))
  const parentEntry = items.find(entry => entry.id === parent._id)

  expect(parentEntry).toBeDefined()
  expect(store.get(explorer.children(parentEntry!, null))).not.toBeEmpty()
})

test('picker can mark initial links without preselecting them', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {
      initialSelection: ['linked-entry'],
      onConfirm() {},
      preselect: false,
      selectionMode: 'multiple'
    }
  )
  const store = createStore()

  expect(store.get(explorer.selection)).toEqual(new Set())
  expect(explorer.linkedKeys).toEqual(new Set(['linked-entry']))
})

test('picker preselects initial links by default', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {
      initialSelection: ['linked-entry'],
      onConfirm() {},
      selectionMode: 'multiple'
    }
  )
  const store = createStore()

  expect(store.get(explorer.selection)).toEqual(new Set(['linked-entry']))
})
