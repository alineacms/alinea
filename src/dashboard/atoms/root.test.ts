import {expect, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {SourceDB, SourceDB as LocalDB} from '#/database/entry/SourceDB.js'
import {WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {Config, Field, Query} from '#/index.js'
import {
  createDashboardAtomFixture,
  createDashboardStore,
  DashboardTestPage,
  dashboardTestConfig,
  TestEvents
} from '#test/DashboardFixture.js'
import {atom, createStore} from 'jotai'
import type {Key} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {eventsAtom} from './core.js'
import {RootAtoms, rootAtoms} from './root.js'
import {authReady, preloadUserPolicyAtom} from './user.js'

class CountingDB extends LocalDB {
  resolveCount = 0
  queries: Array<GraphQuery> = []

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    this.resolveCount++
    this.queries.push(query)
    return super.resolve(query)
  }
}

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
  await db.create({
    id: 'french-child-entry',
    locale: 'fr',
    parentId: 'french-root-entry',
    root: 'pages',
    type: DashboardTestPage,
    workspace,
    set: {title: 'French child'}
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
  const frenchChildrenPage = await store.get(
    root.children('french-root-entry').pageReady
  )
  expect(frenchChildrenPage.locale).toBe('fr')
  expect(frenchChildrenPage.items.map(item => item.title)).toEqual([
    'French child'
  ])

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

test('tree renders children only when their parent is expanded', async () => {
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

test('tree queries only root and expanded parent levels', async () => {
  const db = new CountingDB(dashboardTestConfig)
  await db.sync()
  const parent = await db.create({
    type: DashboardTestPage,
    set: {title: 'Parent'}
  })
  const child = await db.create({
    type: DashboardTestPage,
    parentId: parent._id,
    set: {title: 'Child'}
  })
  await db.create({
    type: DashboardTestPage,
    parentId: child._id,
    set: {title: 'Grandchild'}
  })
  const store = createDashboardStore(dashboardTestConfig, db)
  await store.get(authReady)
  const tree = rootAtoms('main', 'pages').createTree(null, atom(new Set<Key>()))
  db.queries = []

  await store.get(tree.ready)

  expect(db.queries.every(query => 'parentId' in query || 'id' in query)).toBe(
    true
  )
  expect(db.queries.some(query => query.parentId === parent._id)).toBe(false)
  expect(db.queries.some(query => query.parentId === child._id)).toBe(false)

  store.set(tree.expandedKeys, new Set([parent._id]))
  await store.get(tree.ready)

  expect(db.queries.some(query => query.parentId === parent._id)).toBe(true)
  expect(db.queries.some(query => query.parentId === child._id)).toBe(false)
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

test('entry models and child levels are shared across trees', async () => {
  const db = new CountingDB(dashboardTestConfig)
  await db.sync()
  const parent = await db.create({
    type: DashboardTestPage,
    set: {title: 'Parent'}
  })
  const firstChild = await db.create({
    type: DashboardTestPage,
    parentId: parent._id,
    set: {title: 'First child'}
  })
  const secondChild = await db.create({
    type: DashboardTestPage,
    parentId: parent._id,
    set: {title: 'Second child'}
  })
  const store = createDashboardStore(dashboardTestConfig, db)
  await store.get(authReady)
  const selectedKeys = atom(new Set<Key>([firstChild._id]))
  const expandedKeys = atom(new Set([parent._id]))
  const root = rootAtoms('main', 'pages')
  const tree = root.createTree(null, selectedKeys, expandedKeys)

  await store.get(tree.ready)
  const subscriptions = [
    store.sub(root.treeEntries(null), () => {}),
    store.sub(tree.children(parent._id), () => {}),
    ...store
      .get(tree.items)
      .map(item => store.sub(tree.item(item.id), () => {}))
  ]
  await Promise.all([
    store.get(root.treeEntries(null)),
    store.get(tree.children(parent._id))
  ])
  db.resolveCount = 0
  db.queries = []
  await store.get(tree.children(parent._id))
  expect(db.resolveCount).toBe(0)

  store.set(selectedKeys, new Set<Key>([secondChild._id]))
  await store.get(tree.ready)
  expect(db.resolveCount).toBe(3)
  const selectionResolveCount = db.resolveCount
  const secondTree = root.createTree(
    null,
    atom(new Set<Key>()),
    atom(new Set([parent._id]))
  )
  await store.get(secondTree.ready)
  for (const unsubscribe of subscriptions) unsubscribe()

  expect(db.resolveCount).toBe(selectionResolveCount)
})

test('child levels reload when a child ordering field changes', async () => {
  const OrderedPage = Config.document('Ordered page', {
    contains: ['OrderedPage'],
    fields: {title: Field.text('Title')},
    orderChildrenBy: {asc: Query.title}
  })
  const config = Config.create({
    schema: {OrderedPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {
          pages: Config.root('Pages', {contains: ['OrderedPage']})
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const parent = await db.create({
    type: OrderedPage,
    set: {title: 'Parent'}
  })
  const second = await db.create({
    type: OrderedPage,
    parentId: parent._id,
    set: {title: 'B'}
  })
  const first = await db.create({
    type: OrderedPage,
    parentId: parent._id,
    set: {title: 'A'}
  })
  const store = createDashboardStore(config, db)
  const events = new TestEvents()
  store.set(eventsAtom, events)
  await store.get(authReady)
  const children = rootAtoms('main', 'pages')
    .createTree(null, atom(new Set<Key>()))
    .children(parent._id)
  const unsubscribe = store.sub(children, () => {})

  expect((await store.get(children)).map(entry => entry.id)).toEqual([
    first._id,
    second._id
  ])

  await db.update({
    type: OrderedPage,
    id: second._id,
    set: {title: '0'}
  })
  events.emit(
    new IndexEvent({op: 'index', sha: String(await db.sha), ids: [second._id]})
  )

  expect((await store.get(children)).map(entry => entry.id)).toEqual([
    second._id,
    first._id
  ])
  unsubscribe()
})

test('ordered children stay drag-disabled under a hidden parent', async () => {
  const HiddenOrderedFolder = Config.document('Hidden ordered folder', {
    contains: ['Page'],
    fields: {title: Field.text('Title')},
    hidden: true,
    orderChildrenBy: {asc: Query.title}
  })
  const workspace = 'hidden_ordered_parent_test'
  const config = Config.create({
    schema: {HiddenOrderedFolder, Page: DashboardTestPage},
    workspaces: {
      [workspace]: Config.workspace('Main', {
        source: '.',
        roots: {
          pages: Config.root('Pages', {
            contains: ['HiddenOrderedFolder', 'Page']
          })
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const parent = await db.create({
    root: 'pages',
    type: HiddenOrderedFolder,
    workspace,
    set: {title: 'Hidden parent'}
  })
  const child = await db.create({
    parentId: parent._id,
    root: 'pages',
    type: DashboardTestPage,
    workspace,
    set: {title: 'Child'}
  })
  const store = createDashboardStore(config, db)
  await store.get(authReady)
  const tree = rootAtoms(workspace, 'pages').createTree(
    null,
    atom(new Set<Key>([child._id]))
  )

  await store.get(tree.ready)

  expect(store.get(tree.item(child._id)).dragDisabled).toBe(true)
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
