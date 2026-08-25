import {expect, test} from 'bun:test'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {Config} from '#/index.js'
import {
  createDashboardAtomFixture,
  createDashboardStore,
  DashboardTestPage
} from '#test/DashboardFixture.js'
import {atom, createStore} from 'jotai'
import type {Key} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {RootAtoms, rootAtoms} from './root.js'
import {authReady, preloadUserPolicyAtom} from './user.js'

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
  expect(root.tree('en')).toBe(root.tree('en'))
  expect(root.tree('fr')).not.toBe(root.tree('en'))
})

test('root icon uses the original file fallback', async () => {
  const {store} = await createDashboardAtomFixture()
  const root = rootAtoms('main', 'pages')

  expect(store.get(root.icon)).toBe(LucideFile)
})

test('root explorers follow route locales and keep media unlocalized', async () => {
  const workspace = 'localized_root_test'
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      [workspace]: Config.workspace('Localized', {
        source: '.',
        roots: {
          legacy_media: Config.root('Media', {
            contains: ['MediaFile'],
            i18n: {locales: ['en', 'fr']},
            isMediaRoot: true
          }),
          pages: Config.root('Pages', {
            contains: ['Page'],
            i18n: {locales: ['en', 'fr']}
          })
        }
      })
    }
  })
  const db = new SourceDB(config)
  await db.sync()
  await db.create({
    id: 'english-root-entry',
    locale: 'en',
    root: 'pages',
    type: DashboardTestPage,
    workspace,
    set: {title: 'English entry'}
  })
  await db.create({
    id: 'french-root-entry',
    locale: 'fr',
    root: 'pages',
    type: DashboardTestPage,
    workspace,
    set: {title: 'French entry'}
  })
  const store = createDashboardStore(config, db)
  await store.get(authReady)
  const root = rootAtoms(workspace, 'pages')

  store.set(routeAtom, {
    browser: true,
    route: {page: 'entry', workspace, root: 'pages', locale: 'fr'}
  })
  const frenchPage = await store.get(root.explorer.pageReady)

  expect(frenchPage.locale).toBe('fr')
  expect(frenchPage.items.map(item => item.title)).toEqual(['French entry'])

  store.set(routeAtom, {
    browser: true,
    route: {page: 'entry', workspace, root: 'pages', locale: 'en'}
  })
  const englishPage = await store.get(root.explorer.pageReady)

  expect(englishPage.locale).toBe('en')
  expect(englishPage.items.map(item => item.title)).toEqual(['English entry'])

  store.set(routeAtom, {
    browser: true,
    route: {page: 'entry', workspace, root: 'legacy_media', locale: 'fr'}
  })
  const mediaRoot = rootAtoms(workspace, 'legacy_media')
  const mediaPage = await store.get(mediaRoot.explorer.pageReady)

  expect(store.get(mediaRoot.i18n)).toBeUndefined()
  expect(mediaPage.locale).toBeNull()
})

test('tree bundles own independent expansion state', () => {
  const root = rootAtoms('workspace', 'pages')
  const store = createStore()
  const first = root.createTree(null, atom(new Set<Key>()))
  const second = root.createTree(null, atom(new Set<Key>()))

  store.set(first.expandedKeys, new Set(['parent']))

  expect(store.get(first.expandedKeys)).toEqual(new Set(['parent']))
  expect(store.get(second.expandedKeys)).toEqual(new Set())
})

test('root tree expansion is shared between locales', () => {
  const root = rootAtoms('workspace', 'pages')
  const store = createStore()

  store.set(root.tree('en').expandedKeys, new Set(['parent']))

  expect(store.get(root.tree('fr').expandedKeys)).toEqual(new Set(['parent']))
})

test('tree children are loaded only when their parent is expanded', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const root = rootAtoms('main', 'pages')
  const tree = root.createTree(null, atom(new Set<Key>()))

  const rootSnapshot = await store.get(tree.ready)
  const rootItems = store.get(tree.items)

  expect(rootItems.map(item => item.id)).toEqual([parent._id])
  expect(rootItems[0]?.hasChildren).toBe(true)
  expect(rootItems.some(item => item.id === child._id)).toBe(false)
  expect(rootSnapshot).toEqual({
    expandedKeys: new Set(),
    items: [{id: parent._id, children: []}],
    selectedKeys: new Set()
  })

  store.set(tree.expandedKeys, new Set([parent._id]))
  const expandedSnapshot = await store.get(tree.ready)
  const expandedItems = store.get(tree.items)

  expect(expandedItems.map(item => item.id)).toEqual([parent._id, child._id])
  expect(expandedSnapshot).toEqual({
    expandedKeys: new Set([parent._id]),
    items: [{id: parent._id, children: [{id: child._id, children: []}]}],
    selectedKeys: new Set()
  })
})

test('selected entry ancestors load without expanding unrelated branches', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const root = rootAtoms('main', 'pages')
  const tree = root.createTree(null, atom(new Set<Key>([child._id])))

  const snapshot = await store.get(tree.ready)
  const selectedItems = store.get(tree.items)

  expect(selectedItems.map(item => item.id)).toEqual([parent._id, child._id])
  expect(snapshot.expandedKeys).toEqual(new Set([parent._id]))
  expect(snapshot.items).toEqual([
    {id: parent._id, children: [{id: child._id, children: []}]}
  ])
  expect(snapshot.selectedKeys).toEqual(new Set([child._id]))
})

test('entry data loads by id without loading its child level', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const tree = rootAtoms('main', 'pages').createTree(null, atom(new Set<Key>()))
  await store.get(tree.ready)

  let pending: Promise<unknown> | undefined
  try {
    store.get(tree.item(child._id))
  } catch (error) {
    if (error instanceof Promise) pending = error
    else throw error
  }
  await pending

  expect(store.get(tree.item(child._id)).id).toBe(child._id)
  expect(store.get(tree.snapshot).items).toEqual([
    {id: parent._id, children: []}
  ])
})

test('unreadable children do not make a tree item expandable', async () => {
  const {child, config, parent, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({id: child._id, deny: {read: true}})
  store.set(preloadUserPolicyAtom, localUser, policy)
  const tree = rootAtoms('main', 'pages').createTree(null, atom(new Set<Key>()))

  await store.get(tree.ready)

  expect(
    store.get(tree.items).find(item => item.id === parent._id)?.hasChildren
  ).toBe(false)
})
