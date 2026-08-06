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

test('picker can mark initial links without preselecting them', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {
      initialSelection: ['linked-entry'],
      onConfirm() {},
      policy: Policy.ALLOW_ALL,
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
      policy: Policy.ALLOW_ALL,
      selectionMode: 'multiple'
    }
  )
  const store = createStore()

  expect(store.get(explorer.selection)).toEqual(new Set(['linked-entry']))
})
