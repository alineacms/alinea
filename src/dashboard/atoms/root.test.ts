import {expect, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {LocalDB} from '#/database/LocalDB.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
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
import type {DropTarget, Key} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {
  Blog,
  BlogPost,
  config as overviewConfig,
  Product
} from '#test/overview.js'
import {IcOutlineDescription} from '../icons.js'
import {eventsAtom} from './core.js'
import {RootAtoms, rootAtoms} from './root.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'

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

test('root icon uses the Material description fallback', async () => {
  const {store} = await createDashboardAtomFixture()
  const root = rootAtoms('main', 'pages')

  expect(store.get(root.icon)).toBe(IcOutlineDescription)
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
  const db = new LocalDB(config)
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
  await store.get(userPolicyReadyAtom)
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

  // Preserve the rendered explorer locale while an async replacement page loads.
  store.set(routeAtom, {browser: true, route: {page: 'splash'}})
  expect(store.get(root.children('french-root-entry').selectedLocale)).toBe(
    'fr'
  )

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
  // The explorer of the previous root keeps its locale and rows
  const previousPage = await store.get(root.explorer.pageReady)

  expect(previousPage.locale).toBe('en')
  expect(previousPage.items.map(item => item.title)).toEqual(['English entry'])

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
  await store.get(userPolicyReadyAtom)
  const root = rootAtoms('main', 'pages')
  const tree = root.createTree(null, atom(new Set<Key>()))

  const {snapshot: rootSnapshot} = await store.get(tree.ready)
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
  const {snapshot: expandedSnapshot} = await store.get(tree.ready)
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
  await store.get(userPolicyReadyAtom)
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
  await store.get(userPolicyReadyAtom)
  const root = rootAtoms('main', 'pages')
  const tree = root.createTree(null, atom(new Set<Key>([child._id])))

  const {snapshot} = await store.get(tree.ready)
  const selectedItems = store.get(tree.items)

  expect(selectedItems.map(item => item.id)).toEqual([parent._id, child._id])
  expect(snapshot.expandedKeys).toEqual(new Set([parent._id]))
  expect(snapshot.items).toEqual([
    {id: parent._id, children: [{id: child._id, children: []}]}
  ])
  expect(snapshot.selectedKeys).toEqual(new Set([child._id]))
})

test('the sidebar tree reveals the folder of a selected media file as its location', async () => {
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {media: Config.media()}
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const media = {workspace: 'main', root: 'media'}
  const folder = await db.create({
    ...media,
    type: MediaLibrary,
    set: {title: 'Folder', path: 'folder'}
  })
  const nested = await db.create({
    ...media,
    type: MediaLibrary,
    parentId: folder._id,
    set: {title: 'Nested', path: 'nested'}
  })
  const file = await db.create({
    ...media,
    type: MediaFile,
    parentId: nested._id,
    set: {title: 'File', path: 'file', location: 'file.jpg'}
  })
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const root = rootAtoms('main', 'media')

  store.set(routeAtom, {
    browser: true,
    route: {page: 'entry', workspace: 'main', root: 'media', entry: file._id}
  })
  const tree = root.tree(null)
  const {snapshot} = await store.get(tree.ready)

  expect(snapshot.expandedKeys).toEqual(new Set([folder._id]))
  expect(snapshot.items).toEqual([
    {id: folder._id, children: [{id: nested._id, children: []}]}
  ])
  expect(snapshot.selectedKeys).toEqual(new Set())
  expect(snapshot.locationKey).toBe(nested._id)
  expect(store.get(tree.selectedItem)?.id).toBe(nested._id)
})

test('the explorers of a root browse to a location by opening its page', async () => {
  const {parent, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const root = rootAtoms('main', 'pages')

  store.set(root.explorer.location, {
    workspace: 'main',
    root: 'pages',
    parentId: parent._id
  })

  expect(store.get(root.explorer.location).parentId).toBeUndefined()
  expect(store.get(routeAtom)).toMatchObject({
    page: 'entry',
    workspace: 'main',
    root: 'pages',
    entry: parent._id,
    view: 'overview'
  })
})

test('tree removes selected and expanded entries that become unreadable', async () => {
  const {config, parent, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const tree = rootAtoms('main', 'pages').createTree(
    null,
    atom(new Set<Key>([parent._id])),
    {expandedKeys: atom(new Set([parent._id]))}
  )

  await store.get(tree.ready)

  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({id: parent._id, deny: {read: true}})
  store.set(preloadUserPolicyAtom, localUser, policy)

  const {snapshot} = await store.get(tree.ready)
  expect(snapshot).toEqual({
    expandedKeys: new Set([parent._id]),
    items: [],
    selectedKeys: new Set([parent._id])
  })
  expect(store.get(tree.view).entries).toEqual(new Map())
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
  await store.get(userPolicyReadyAtom)
  const selectedKeys = atom(new Set<Key>([firstChild._id]))
  const expandedKeys = atom(new Set([parent._id]))
  const root = rootAtoms('main', 'pages')
  const tree = root.createTree(null, selectedKeys, {expandedKeys})

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

  // The selected sibling and its parents are listed already
  store.set(selectedKeys, new Set<Key>([secondChild._id]))
  await store.get(tree.ready)
  expect(db.resolveCount).toBe(0)
  const selectionResolveCount = db.resolveCount
  const secondTree = root.createTree(null, atom(new Set<Key>()), {
    expandedKeys: atom(new Set([parent._id]))
  })
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
  await store.get(userPolicyReadyAtom)
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

test('children of an ordered hidden parent are ordered', async () => {
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
  await store.get(userPolicyReadyAtom)
  const tree = rootAtoms(workspace, 'pages').createTree(
    null,
    atom(new Set<Key>([child._id]))
  )

  await store.get(tree.ready)

  expect(store.get(tree.item(child._id)).ordered).toBe(true)
})

test('media folders are reordered by hand and move into folders', async () => {
  const db = new LocalDB(overviewConfig)
  await db.sync()
  const folder = (title: string) =>
    db.create({
      type: MediaLibrary,
      workspace: 'main',
      root: 'media',
      set: {title}
    })
  const photos = await folder('Photos')
  const logos = await folder('Logos')
  const store = createDashboardStore(overviewConfig, db)
  await store.get(userPolicyReadyAtom)
  const root = rootAtoms('main', 'media')
  const tree = root.tree(null)
  const move = async (target: DropTarget) => {
    await store.get(tree.ready)
    await store.set(root.onMove, {keys: new Set([photos._id]), target}, tree)
  }
  const parentOf = (id: string) =>
    db.get({id, select: {parentId: Query.parentId, index: Query.index}})
  // The media root lists its folders in their manual order
  await move({key: logos._id, position: 'after'})
  const moved = await parentOf(photos._id)
  expect(moved.parentId).toBe(null)
  expect(moved.index > (await parentOf(logos._id)).index).toBe(true)
  await move({key: logos._id, position: 'on'})
  expect((await parentOf(photos._id)).parentId).toBe(logos._id)
})

test('entries of an ordered parent keep their place', async () => {
  const db = new LocalDB(overviewConfig)
  await db.sync()
  const main = {workspace: 'main', root: 'blog'}
  const blog = await db.create({...main, type: Blog, set: {title: 'Blog'}})
  const post = (title: string) =>
    db.create({...main, type: BlogPost, parentId: blog._id, set: {title}})
  const first = await post('First')
  const second = await post('Second')
  const store = createDashboardStore(overviewConfig, db)
  await store.get(userPolicyReadyAtom)
  const root = rootAtoms('main', 'blog')
  const tree = root.tree(null)
  store.set(tree.expandedKeys, new Set([blog._id]))
  await store.get(tree.ready)
  const index = (id: string) => db.get({id, select: Query.index})
  const before = await index(first._id)
  // The blog orders its posts by date
  await store.set(
    root.onMove,
    {keys: new Set([first._id]), target: {key: second._id, position: 'after'}},
    tree
  )
  expect(await index(first._id)).toBe(before)
})

test('entries do not move into themselves or into entries without children', async () => {
  const db = new LocalDB(overviewConfig)
  await db.sync()
  const logos = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Logos'}
  })
  const photos = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    parentId: logos._id,
    set: {title: 'Photos'}
  })
  const [shirt, socks] = await Promise.all(
    ['Shirt', 'Socks'].map(title =>
      db.create({
        type: Product,
        workspace: 'main',
        root: 'products',
        set: {title}
      })
    )
  )
  const store = createDashboardStore(overviewConfig, db)
  await store.get(userPolicyReadyAtom)
  const move = async (root: RootAtoms, id: string, target: DropTarget) => {
    const tree = root.tree(null)
    store.set(tree.expandedKeys, new Set([logos._id]))
    await store.get(tree.ready)
    await store.set(root.onMove, {keys: new Set([id]), target}, tree)
  }
  const parentId = async (id: string) =>
    (await db.get({id, select: {parentId: Query.parentId}})).parentId
  const media = rootAtoms('main', 'media')
  await move(media, logos._id, {key: photos._id, position: 'on'})
  await move(media, logos._id, {key: logos._id, position: 'on'})
  expect(await parentId(logos._id)).toBe(null)
  const products = rootAtoms('main', 'products')
  await move(products, shirt._id, {key: socks._id, position: 'on'})
  expect(await parentId(shirt._id)).toBe(null)
})

test('entry data loads by id without loading its child level', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
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
  await store.get(userPolicyReadyAtom)
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

test('canCreate shows with a type-level create grant', () => {
  const Page = Config.document('Page', {
    fields: {title: Field.text('Title')}
  })
  const pages = Config.root('Pages', {contains: ['Page']})
  const config = Config.create({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {source: '.', roots: {pages}})
    }
  })
  const createStore = (policy: WriteablePolicy) => {
    const store = createDashboardStore(config, new LocalDB(config))
    store.set(preloadUserPolicyAtom, localUser, policy)
    return store
  }
  const withTypeGrant = createStore(
    new WriteablePolicy(getScope(config)).set({
      type: Page,
      allow: {create: true}
    })
  )
  expect(withTypeGrant.get(rootAtoms('main', 'pages').canCreate)).toBe(true)

  const withoutGrant = createStore(new WriteablePolicy(getScope(config)))
  expect(withoutGrant.get(rootAtoms('main', 'pages').canCreate)).toBe(false)
})

test('canCreate follows root grants unless the type denies create', () => {
  const Page = Config.document('Page', {
    fields: {title: Field.text('Title')}
  })
  const pages = Config.root('Pages', {contains: ['Page']})
  const config = Config.create({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {source: '.', roots: {pages}})
    }
  })
  const createStore = (policy: WriteablePolicy) => {
    const store = createDashboardStore(config, new LocalDB(config))
    store.set(preloadUserPolicyAtom, localUser, policy)
    return store
  }
  const withRootGrant = createStore(
    new WriteablePolicy(getScope(config)).set({
      root: pages,
      allow: {create: true}
    })
  )
  expect(withRootGrant.get(rootAtoms('main', 'pages').canCreate)).toBe(true)

  const withTypeDeny = createStore(
    new WriteablePolicy(getScope(config)).set(
      {root: pages, allow: {create: true}},
      {type: Page, deny: {create: true}}
    )
  )
  expect(withTypeDeny.get(rootAtoms('main', 'pages').canCreate)).toBe(false)
})

test('canCreate finds creatable types nested in containers', () => {
  const Article = Config.document('Article', {
    fields: {title: Field.text('Title')}
  })
  const Collection = Config.document('Collection', {
    contains: ['Article'],
    fields: {title: Field.text('Title')}
  })
  const Secret = Config.document('Secret', {
    fields: {title: Field.text('Title')},
    hidden: true
  })
  const collections = Config.root('Collections', {
    contains: ['Collection', 'Secret']
  })
  const config = Config.create({
    schema: {Article, Collection, Secret},
    workspaces: {
      main: Config.workspace('Main', {source: '.', roots: {collections}})
    }
  })
  const createStore = (policy: WriteablePolicy) => {
    const store = createDashboardStore(config, new LocalDB(config))
    store.set(preloadUserPolicyAtom, localUser, policy)
    return store
  }
  const withNestedGrant = createStore(
    new WriteablePolicy(getScope(config)).set({
      type: Article,
      allow: {create: true}
    })
  )
  expect(withNestedGrant.get(rootAtoms('main', 'collections').canCreate)).toBe(
    true
  )

  const withHiddenGrantOnly = createStore(
    new WriteablePolicy(getScope(config)).set({
      type: Secret,
      allow: {create: true}
    })
  )
  expect(
    withHiddenGrantOnly.get(rootAtoms('main', 'collections').canCreate)
  ).toBe(false)
})

test('canCreate terminates on cyclic contains', () => {
  const A = Config.document('A', {
    contains: ['B'],
    fields: {title: Field.text('Title')}
  })
  const B = Config.document('B', {
    contains: ['A'],
    fields: {title: Field.text('Title')}
  })
  const pages = Config.root('Pages', {contains: ['A']})
  const config = Config.create({
    schema: {A, B},
    workspaces: {
      main: Config.workspace('Main', {source: '.', roots: {pages}})
    }
  })
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(
    preloadUserPolicyAtom,
    localUser,
    new WriteablePolicy(getScope(config)).set({
      type: B,
      allow: {create: true}
    })
  )
  expect(store.get(rootAtoms('main', 'pages').canCreate)).toBe(true)
})

test('tree canCreate follows the selected container', async () => {
  const Tag = Config.document('Tag', {
    fields: {title: Field.text('Title')}
  })
  const Tags = Config.document('Tags', {
    contains: ['Tag'],
    fields: {title: Field.text('Title')}
  })
  const workspace = 'selected_container_test'
  const config = Config.create({
    schema: {Tag, Tags},
    workspaces: {
      [workspace]: Config.workspace('Main', {
        source: '.',
        roots: {general: Config.root('General', {contains: []})}
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const tags = await db.create({
    root: 'general',
    type: Tags,
    workspace,
    set: {title: 'Tags'}
  })
  const tag = await db.create({
    parentId: tags._id,
    root: 'general',
    type: Tag,
    workspace,
    set: {title: 'Tag'}
  })
  const store = createDashboardStore(config, db)
  store.set(
    preloadUserPolicyAtom,
    localUser,
    new WriteablePolicy(getScope(config))
      .set({workspace: config.workspaces[workspace], allow: {read: true}})
      .set({type: Tag, allow: {create: true}})
  )
  const root = rootAtoms(workspace, 'general')
  const selectedKeys = atom(new Set<Key>())
  const tree = root.createTree(null, selectedKeys)
  await store.get(tree.ready)
  expect(store.get(root.canCreate)).toBe(false)
  expect(store.get(tree.canCreate)).toBe(false)

  store.set(selectedKeys, new Set<Key>([tags._id]))
  await store.get(tree.ready)
  expect(store.get(tree.canCreate)).toBe(true)

  store.set(selectedKeys, new Set<Key>([tag._id]))
  await store.get(tree.ready)
  expect(store.get(tree.canCreate)).toBe(true)
})

test('types that are not collapsed expand their children from the start', async () => {
  const Folder = Config.document('Folder', {
    collapsed: false,
    contains: ['Folder', 'Page'],
    fields: {title: Field.text('Title')}
  })
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const config = Config.create({
    schema: {Folder, Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {pages: Config.root('Pages', {contains: ['Folder', 'Page']})}
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const folder = await db.create({type: Folder, set: {title: 'Folder'}})
  const nested = await db.create({
    type: Folder,
    parentId: folder._id,
    set: {title: 'Nested'}
  })
  const page = await db.create({
    type: Page,
    parentId: nested._id,
    set: {title: 'Page'}
  })
  await db.create({type: Page, parentId: page._id, set: {title: 'Child'}})
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const tree = rootAtoms('main', 'pages').createTree(null, atom(new Set<Key>()))

  const {snapshot} = await store.get(tree.ready)
  expect(snapshot.expandedKeys).toEqual(new Set([folder._id, nested._id]))
  expect(snapshot.items).toEqual([
    {
      id: folder._id,
      children: [{id: nested._id, children: [{id: page._id, children: []}]}]
    }
  ])

  // Closed by hand they stay closed
  store.set(tree.expand, new Set([folder._id]))
  const closed = await store.get(tree.ready)
  expect(closed.snapshot.expandedKeys).toEqual(new Set([folder._id]))
  expect(store.get(tree.closedKeys)).toEqual(new Set([nested._id]))
})
