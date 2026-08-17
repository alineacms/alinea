import {expect, test} from 'bun:test'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {createStore} from 'jotai'
import {LucideFile} from '../icons.js'
import {RootAtoms, rootAtoms} from './root.js'
import {authReady} from './user.js'

test('rootAtoms returns stable bundles independent of route state', () => {
  const root = rootAtoms('workspace', 'pages')

  expect(root).toBeInstanceOf(RootAtoms)
  expect(rootAtoms('workspace', 'pages')).toBe(root)
  expect(rootAtoms('workspace', 'media')).not.toBe(root)
  expect(rootAtoms('other-workspace', 'pages')).not.toBe(root)
  expect(root.children(null)).toBe(root.explorer)
  expect(root.children('parent')).toBe(root.children('parent'))
  expect(root.children('parent')).not.toBe(root.explorer)
  expect(root.explorer.supportsInlineExpansion).toBe(false)
  expect(root.treeItems('en')).toBe(root.treeItems('en'))
  expect(root.treeItems('fr')).not.toBe(root.treeItems('en'))
  expect(root.treeChildren('en', null)).toBe(root.treeChildren('en', null))
  expect(root.treeChildren('en', 'parent')).not.toBe(
    root.treeChildren('en', null)
  )
})

test('root icon uses the original file fallback', async () => {
  const {store} = await createDashboardAtomFixture()
  const root = rootAtoms('main', 'pages')

  expect(store.get(root.icon)).toBe(LucideFile)
})

test('tree expansion is independent of locale data', () => {
  const root = rootAtoms('workspace', 'pages')
  const store = createStore()

  store.set(root.treeExpandedKeys, new Set(['parent']))

  expect(store.get(root.treeExpandedKeys)).toEqual(new Set(['parent']))
})

test('preloading the tree primes the synchronous tree items atom', async () => {
  const {store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const root = rootAtoms('main', 'pages')

  const readyItems = await store.get(root.treeReady(null))

  expect(readyItems).not.toBeEmpty()
  expect(store.get(root.treeItems(null))).toEqual(readyItems)
})
