import {
  createDashboardAtomFixture,
  createDashboardStore
} from '#test/DashboardFixture.js'
import {LocalDB} from '#/database/LocalDB.js'
import {WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {Config, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {atom, createStore} from 'jotai'
import {LucideFile} from '../icons.js'
import {routeAtom} from './nav.js'
import {rootAtoms} from './root.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {
  createExplorerAtoms,
  ExplorerEntry,
  explorerOverviewLinkIds,
  explorerThumbnailId,
  type ExplorerItemData
} from './explorer.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'

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

test('picker confirmation can use the rendered locale while another loads', () => {
  let confirmed: {selection: Array<string>; locale: string | null} | undefined
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages', locale: 'fr'},
    {
      onConfirm(selection, locale) {
        confirmed = {selection, locale}
      }
    }
  )
  const store = createStore()

  store.set(explorer.selection, new Set(['entry-1']))
  store.set(explorer.selectedLocale, 'de')
  store.set(explorer.onConfirm, 'fr')

  expect(confirmed).toEqual({selection: ['entry-1'], locale: 'fr'})

  store.set(explorer.onConfirm, null)
  expect(confirmed).toEqual({selection: ['entry-1'], locale: null})
})

test('page explorers keep their row navigation action', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {enableNavigation: true}
  )

  expect(explorer.hasRowAction).toBe(true)
  expect(explorer.items('en')).not.toBe(explorer.items('fr'))
})

test('page explorers browse into media folders instead of editing them', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'media'},
    {enableNavigation: true}
  )
  const folder = folderEntry({
    id: 'images',
    title: 'Images',
    path: 'images',
    type: 'MediaLibrary',
    workspace: 'workspace',
    root: 'media',
    locale: null,
    parentId: null,
    parents: [],
    index: 'a0',
    data: {},
    hasChildren: true
  })
  const store = createStore()

  store.set(explorer.onAction, folder, null)

  expect(store.get(explorer.location).parentId).toBe('images')
})

test('explorers default to index sorting', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'media'},
    {}
  )
  const store = createStore()

  expect(store.get(explorer.sort)).toEqual({sortBy: 'index', direction: 'asc'})
})

test('uses the locale from its initial location', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages', locale: 'fr'},
    {selectedLocale: 'en'}
  )
  const store = createStore()

  expect(store.get(explorer.selectedLocale)).toBe('fr')
})

test('all-workspace search is opt-in and defaults to the current workspace', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {allowAllWorkspaces: true, mode: 'search'}
  )
  const store = createStore()

  expect(explorer.allowAllWorkspaces).toBe(true)
  expect(store.get(explorer.searchScope)).toBe('workspace')
  expect(store.get(explorer.canSearchEverything)).toBe(true)
  store.set(explorer.searchScope, 'everything')
  expect(store.get(explorer.searchScope)).toBe('everything')
  expect(store.get(explorer.searchesEverything)).toBe(false)
  store.set(explorer.search, 'Alpha')
  expect(store.get(explorer.canSearchEverything)).toBe(true)
  expect(store.get(explorer.resultMode)).toBe('matches')
  expect(store.get(explorer.searchesEverything)).toBe(true)
  store.set(explorer.search, '')
  expect(store.get(explorer.resultMode)).toBe('browse')
  expect(store.get(explorer.searchScope)).toBe('everything')
  expect(store.get(explorer.searchesEverything)).toBe(false)
})

test('workspace search includes all locales and unlocalized roots', async () => {
  const Page = Config.document('Page', {
    fields: {title: Field.text('Title')}
  })
  const config = Config.create({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {
          pages: Config.root('Pages', {
            contains: ['Page'],
            i18n: {locales: ['en', 'fr']}
          }),
          media: Config.root('Media', {contains: ['Page']})
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.create({
    type: Page,
    root: 'pages',
    locale: 'en',
    set: {title: 'Shared result'}
  })
  await db.create({
    type: Page,
    root: 'pages',
    locale: 'fr',
    set: {title: 'Shared result'}
  })
  await db.create({
    type: Page,
    root: 'media',
    set: {title: 'Shared result'}
  })
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages', locale: 'en'},
    {allowAllWorkspaces: true, mode: 'search'}
  )
  store.set(explorer.search, 'Shared result')

  const items = await store.get(explorer.itemsReady('en'))

  expect(items).toHaveLength(3)
  expect(items.map(item => [item.root, item.locale])).toEqual(
    expect.arrayContaining([
      ['pages', 'en'],
      ['pages', 'fr'],
      ['media', null]
    ])
  )
})

test('ready pages snapshot the search that produced their items', async () => {
  const {store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {mode: 'search'}
  )

  const idlePage = await store.get(explorer.pageReady)
  expect(idlePage.search).toBe('')
  expect(idlePage.items).toEqual([])

  store.set(explorer.search, 'Parent')

  const searchPage = await store.get(explorer.pageReady)
  expect(searchPage.search).toBe('Parent')
  expect(searchPage.items.map(item => item.title)).toContain('Parent draft')
})

test('ready pages include inherited upload permissions for the current folder', async () => {
  const {child, config, parent, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({id: parent._id, deny: {upload: true}})
  store.set(preloadUserPolicyAtom, localUser, policy)
  store.set(routeAtom, {
    browser: true,
    route: {
      page: 'entry',
      workspace: 'main',
      root: 'pages',
      entry: child._id
    }
  })
  const explorer = rootAtoms('main', 'pages').children(child._id)

  const page = await store.get(explorer.pageReady)

  expect(page.canUpload).toBe(false)
})

test('search temporarily overrides the preferred result mode', () => {
  const explorer = createExplorerAtoms(
    {workspace: 'workspace', root: 'pages'},
    {condition: {_type: 'Page'}}
  )
  const store = createStore()

  store.set(explorer.resultMode, 'browse')
  expect(store.get(explorer.resultMode)).toBe('browse')
  store.set(explorer.search, 'Alpha')
  expect(store.get(explorer.resultMode)).toBe('matches')
  store.set(explorer.search, '')
  expect(store.get(explorer.resultMode)).toBe('browse')

  store.set(explorer.resultMode, 'matches')
  store.set(explorer.search, 'Alpha')
  expect(store.get(explorer.resultMode)).toBe('matches')
  store.set(explorer.search, '')
  expect(store.get(explorer.resultMode)).toBe('matches')
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
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms({workspace: 'main', root: 'pages'}, {})

  const readyItems = await store.get(explorer.itemsReady(null))

  expect(readyItems).not.toBeEmpty()
  expect(store.get(explorer.items(null))).toEqual(readyItems)
})

test('preloading items includes expanded inline children', async () => {
  const {store, parent} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
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

test('matches only contain selectable rows for compound conditions', async () => {
  const {store, child} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {
      condition: {_type: 'Page', _status: 'published'},
      initialResultMode: 'matches'
    }
  )

  const items = await store.get(explorer.itemsReady(null))

  expect(items.map(item => item.id)).toEqual([child._id])
  expect(items.every(item => store.get(explorer.isSelectable(item)))).toBe(true)
})

test('card browse queries show direct children without applying conditions', async () => {
  const {store, child, parent} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {
      condition: {_id: child._id},
      initialResultMode: 'browse',
      initialView: 'card'
    }
  )

  const rootItems = await store.get(explorer.itemsReady(null))

  expect(rootItems.map(item => item.id)).toEqual([parent._id])

  store.set(explorer.location, current => ({
    ...current,
    parentId: parent._id
  }))
  const childItems = await store.get(explorer.itemsReady(null))

  expect(childItems.map(item => item.id)).toEqual([child._id])
})

test('filtered card queries stay scoped to the selected location', async () => {
  const {store, child, parent} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {
      condition: {_type: 'Page'},
      initialResultMode: 'matches',
      initialView: 'card'
    }
  )

  store.set(explorer.location, current => ({
    ...current,
    parentId: parent._id
  }))
  const items = await store.get(explorer.itemsReady(null))

  expect(items.map(item => item.id)).toEqual([child._id])
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

test('the thumbnail is the first image in field order, including lists', () => {
  const Block = Config.type('Block', {
    fields: {photo: Field.image('Photo')}
  })
  const Product = Config.document('Product', {
    fields: {
      title: Field.text('Title'),
      related: Field.entry('Related'),
      gallery: Field.image.multiple('Gallery'),
      blocks: Field.list('Blocks', {schema: {Block}}),
      cover: Field.image('Cover')
    }
  })
  const image = (id: string, entry: string) => ({
    _id: id,
    _index: 'a0',
    _type: 'image',
    _entry: entry
  })
  expect(
    explorerThumbnailId(Product, {
      related: {_id: 'r', _type: 'entry', _entry: 'page'},
      gallery: [image('g1', 'first'), image('g2', 'second')],
      cover: image('c', 'cover')
    })
  ).toBe('first')
  expect(
    explorerThumbnailId(Product, {
      gallery: [],
      blocks: [
        {_id: 'b', _index: 'a0', _type: 'Block', photo: image('p', 'block')}
      ],
      cover: image('c', 'cover')
    })
  ).toBe('block')
  expect(explorerThumbnailId(Product, {title: 'No images'})).toBeUndefined()
})

test('overview link ids only come from overview fields', () => {
  const Page = Config.document('Page', {
    fields: {
      title: Field.text('Title'),
      author: Field.entry('Author', {overview: true}),
      cover: Field.image('Cover')
    }
  })
  expect(
    explorerOverviewLinkIds(Page, {
      author: {_id: 'a', _type: 'entry', _entry: 'author-1'},
      cover: {_id: 'c', _type: 'image', _entry: 'image-1'}
    })
  ).toEqual(['author-1'])
})

test('search results load thumbnails and linked entry titles', async () => {
  const Author = Config.document('Author', {
    fields: {title: Field.text('Title')}
  })
  const Product = Config.document('Product', {
    fields: {
      title: Field.text('Title'),
      author: Field.entry('Author', {overview: true}),
      gallery: Field.image.multiple('Gallery')
    }
  })
  const config = Config.create({
    schema: {Author, Product},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          pages: Config.root('Pages', {contains: [Author, Product]}),
          media: Config.media()
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  await db.create({
    id: 'photo',
    type: MediaFile,
    root: 'media',
    set: {
      title: 'Photo',
      path: 'photo',
      location: 'photo.jpg',
      extension: '.jpg',
      preview: 'data:image/webp;base64,preview',
      averageColor: '#524537'
    }
  })
  await db.create({
    id: 'author',
    type: Author,
    root: 'pages',
    set: {title: 'Maya'}
  })
  await db.create({
    id: 'table',
    type: Product,
    root: 'pages',
    set: {
      title: 'Dining table',
      author: {_id: 'l1', _type: 'entry', _entry: 'author'},
      gallery: [{_id: 'g1', _index: 'a0', _type: 'image', _entry: 'photo'}]
    }
  })
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {mode: 'search'}
  )
  store.set(explorer.search, 'Dining')

  const [item] = await store.get(explorer.itemsReady(null))
  const {data} = store.get(item.data)

  expect(store.get(data.thumbnail)).toEqual({
    id: 'photo',
    title: 'Photo',
    preview: 'data:image/webp;base64,preview',
    averageColor: '#524537'
  })
  expect(store.get(data.linked).get('author')?.title).toBe('Maya')
})
