import {expect, test} from 'bun:test'
import {Policy} from '#/core/Role.js'
import {atom, createStore} from 'jotai'
import {LucideFile} from '../icons.js'
import {
  createExplorerAtoms,
  ExplorerEntry,
  type ExplorerItemData
} from './explorer.js'

function folderEntry(value: ExplorerItemData) {
  const item = atom(value)
  const root = atom({icon: atom(LucideFile), label: atom('Pages')})
  return new ExplorerEntry(value.id, value, item, root)
}

test('picker rows select instead of navigating the dashboard', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {enableNavigation: true, onConfirm() {}, policy: Policy.ALLOW_ALL}
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
  store.set(explorer.onAction, folder)
  expect(store.get(explorer.location).parentId).toBe('folder')
})

test('page explorers keep their row navigation action', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {enableNavigation: true, policy: Policy.ALLOW_ALL}
  )

  expect(explorer.hasRowAction).toBe(true)
})

test('limits the picker to its allowed locations', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'outside', root: 'outside'},
    {
      policy: Policy.ALLOW_ALL,
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
