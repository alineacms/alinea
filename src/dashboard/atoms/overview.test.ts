import '#test/react.js'
import {Entry} from '#/core/Entry.js'
import {getExpr, getRoot} from '#/core/Internal.js'
import {MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field, Query} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {
  Blog,
  Brand,
  Category,
  Product,
  config,
  productsOverview
} from '#test/overview.js'
import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {
  entryTableKey,
  entryTableRowsAtom,
  type EntryTableRequest
} from './entryTable.js'
import {createExplorerAtoms} from './explorer.js'
import {
  formatOverviewSort,
  pageAtom,
  parseOverviewSort,
  routeAtom,
  sortPageOverviewAtom
} from './nav.js'
import {
  columnField,
  loadColumnValues,
  overviewOrder,
  type OverviewParent,
  resolveOverview,
  type OverviewChildren,
  resolveOverviewOptions,
  sortedColumn,
  summarizeRows
} from './overview.js'
import {syncAtom} from './graph.js'
import {getScope} from '#/core/Scope.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'

function rootParent(
  root: 'products' | 'brands' | 'blog' | 'media'
): OverviewParent {
  return {kind: 'root', data: getRoot(config.workspaces.main[root])}
}

const blogParent: OverviewParent = {kind: 'type', name: 'Blog', type: Blog}

test('the title comes first, then built-in columns, then the parent columns', () => {
  const overview = resolveOverview(config, rootParent('products'))
  // The article number is placed at the start
  expect(overview.columns.map(column => column.key)).toEqual([
    'articleNumber',
    'status',
    'updated',
    'author',
    'categories',
    'brand',
    'price'
  ])
  expect(overview.actions).toEqual(productsOverview.actions!)
})

test('the type column shows for lists of several types', () => {
  const blog = resolveOverview(config, blogParent)
  expect(blog.columns.map(column => column.key)).toEqual([
    'type',
    'status',
    'updated',
    'author',
    'date'
  ])
  const search = resolveOverview(config, rootParent('products'), {mixed: true})
  expect(search.columns[1].key).toBe('type')
})

test('a parent column replaces the built-in column with its key', () => {
  const author = resolveOverview(config, blogParent).columns.find(
    column => column.key === 'author'
  )!
  expect(author.builtin).toBeUndefined()
  expect(author.header).toBe('Author')
  expect(Object.keys(author.select!.byType!)).toEqual(['BlogPost', 'Event'])
})

test('built-in columns can be hidden', () => {
  const Folder = Config.document('Folder', {
    contains: ['Folder'],
    fields: {},
    overview: {
      columns: {},
      builtins: {status: false, updated: false, author: false}
    }
  })
  const overview = resolveOverview(
    Config.create({
      schema: {Folder},
      workspaces: {
        main: Config.workspace('Main', {
          source: 'content',
          roots: {pages: Config.root('Pages', {contains: ['Folder']})}
        })
      }
    }),
    {kind: 'type', name: 'Folder', type: Folder}
  )
  expect(overview.columns).toEqual([])
})

test('fields and expressions sort, links only with sortBy', () => {
  const columns = new Map(
    resolveOverview(config, rootParent('products')).columns.map(column => [
      column.key,
      column
    ])
  )
  expect(columns.get('price')!.sortBy).toBe(Product.price)
  expect(columns.get('articleNumber')!.sortBy).toBe(Product.articleNumber)
  expect(columns.get('categories')!.sortBy).toBeUndefined()
  expect(getExpr(columns.get('brand')!.sortBy!).type).toBe('relation')
  expect(getExpr(columns.get('updated')!.sortBy!)).toEqual(
    getExpr(Entry.updatedAt)
  )
})

test('per type sort values switch on the entry type', () => {
  const author = resolveOverview(config, blogParent).columns.find(
    column => column.key === 'author'
  )!
  const internal = getExpr(author.sortBy!)
  expect(internal.type).toBe('typeSwitch')
  expect(Object.keys((internal as {cases: object}).cases)).toEqual([
    'BlogPost',
    'Event'
  ])
})

test('sortable: false opts out of sorting', () => {
  const Things = Config.document('Things', {
    fields: {},
    contains: ['Product'],
    overview: {
      columns: {
        price: Config.column({
          header: 'Price',
          select: Product.price,
          sortable: false
        }),
        brand: Config.column({header: 'Brand', select: Product.brand}),
        categories: Config.column({
          header: 'Categories',
          select: Product.categories
        })
      }
    }
  })
  const overview = resolveOverview(config, {
    kind: 'type',
    name: 'Things',
    type: Things
  })
  const sortBy = (key: string) =>
    overview.columns.find(column => column.key === key)!.sortBy
  expect(sortBy('price')).toBeUndefined()
  // Links and lists need sortBy
  expect(sortBy('brand')).toBeUndefined()
  expect(sortBy('categories')).toBeUndefined()
})

test('the editor sort orders the query, the default order applies otherwise', () => {
  const blog = resolveOverview(config, blogParent)
  expect(overviewOrder(blog, undefined)).toBe(Type.overview(Blog)!.sort)
  expect(overviewOrder(blog, {column: 'title', direction: 'asc'})).toEqual({
    asc: Entry.title
  })
  // Unknown or unsortable columns fall back to the default order
  const products = resolveOverview(config, rootParent('products'))
  expect(
    overviewOrder(products, {column: 'categories', direction: 'asc'})
  ).toBeUndefined()
  expect(sortedColumn(blog, undefined)).toEqual({
    column: 'date',
    direction: 'desc'
  })
})

test('orderChildrenBy is the default order when overview.sort is missing', () => {
  const Legacy = Config.document('Legacy', {
    contains: ['Product'],
    fields: {},
    orderChildrenBy: {asc: Query.title}
  })
  const Both = Config.document('Both', {
    contains: ['Product'],
    fields: {},
    orderChildrenBy: {asc: Query.title},
    overview: {sort: {desc: Product.price}}
  })
  expect(Type.childrenOrder(Legacy)).toEqual({asc: Query.title})
  expect(Type.childrenOrder(Both)).toEqual({desc: Product.price})
  expect(
    resolveOverview(config, {kind: 'type', name: 'Legacy', type: Legacy}).sort
  ).toEqual({asc: Query.title})
})

test('fields marked overview: true become columns without parent columns', () => {
  const Note = Config.document('Note', {
    fields: {stock: Field.number('Stock', {overview: true})}
  })
  const legacy = Config.create({
    schema: {Product, Note},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          shared: Config.root('Shared', {contains: ['Product', 'Note']}),
          products: Config.root('Products', {contains: ['Product']})
        }
      })
    }
  })
  const single = resolveOverview(legacy, {
    kind: 'root',
    data: getRoot(legacy.workspaces.main.products)
  }).columns.find(column => column.key === 'stock')!
  expect(single.header).toBe('Stock')
  expect(single.select).toEqual({all: Product.stock})
  // Several types with the field share one column, per type
  const shared = resolveOverview(legacy, {
    kind: 'root',
    data: getRoot(legacy.workspaces.main.shared)
  }).columns.find(column => column.key === 'stock')!
  expect(Object.keys(shared.select!.byType!)).toEqual(['Product', 'Note'])
  // Parents with columns ignore the deprecated option
  expect(
    resolveOverview(config, rootParent('products')).columns.some(
      column => column.key === 'stock'
    )
  ).toBe(false)
})

test('the media library lists a preview, dimensions, size and file type', () => {
  const overview = resolveOverview(config, rootParent('media'))
  expect(overview.columns.map(column => column.key)).toEqual([
    'preview',
    'dimensions',
    'size',
    'fileType'
  ])
  const [, dimensions, size, fileType] = overview.columns
  expect(dimensions.format!({width: 1200, height: 800}, {locale: null})).toBe(
    '1200 × 800 px'
  )
  expect(dimensions.format!({width: null, height: null}, {locale: null})).toBe(
    ''
  )
  expect(size.format!(345466, {locale: null})).toBe('345 kB')
  expect(size.align).toBe('end')
  expect(fileType.format!('.jpg', {locale: null})).toBe('JPG')
  expect(overview.columns[0].sortBy).toBeUndefined()
  const folder = resolveOverview(config, {
    kind: 'type',
    name: 'MediaLibrary',
    type: MediaLibrary
  })
  expect(folder.columns.map(column => column.key)).toEqual([
    'preview',
    'dimensions',
    'size',
    'fileType'
  ])
})

test('compact field columns read the entry data, others are queried', () => {
  const columns = new Map(
    resolveOverview(config, rootParent('products')).columns.map(column => [
      column.key,
      column
    ])
  )
  expect(columnField(config, columns.get('brand')!, 'Product')?.[0]).toBe(
    'brand'
  )
  // Formatted columns receive the queried value
  expect(columnField(config, columns.get('price')!, 'Product')).toBeUndefined()
  // Entries of other types have no value
  expect(columnField(config, columns.get('brand')!, 'Brand')).toBeUndefined()
})

async function catalogue() {
  const db = new LocalDB(config)
  await db.sync()
  const brand = await db.create({
    type: Brand,
    workspace: 'main',
    root: 'brands',
    set: {title: 'Acme'}
  })
  const chairs = await db.create({
    type: Category,
    workspace: 'main',
    root: 'categories',
    set: {title: 'Chairs'}
  })
  const seating = await db.create({
    type: Category,
    workspace: 'main',
    root: 'categories',
    set: {title: 'Seating'}
  })
  const draft = await db.create({
    type: Category,
    workspace: 'main',
    root: 'categories',
    status: 'draft',
    set: {title: 'Draft category'}
  })
  const product = (title: string, price: number) =>
    db.create({
      type: Product,
      workspace: 'main',
      root: 'products',
      set: {
        title,
        price,
        brand: {_id: `b-${title}`, _type: 'entry' as const, _entry: brand._id},
        categories: [seating, draft, chairs].map((category, index) => ({
          _id: `${title}-${index}`,
          _index: `a${index}`,
          _type: 'entry' as const,
          _entry: category._id
        }))
      } as Record<string, unknown>
    })
  await product('Chair', 20)
  await product('Table', 5)
  await product('Lamp', 12)
  return {db, brand}
}

test('column values are queried per type, linked entries as selected', async () => {
  const {db} = await catalogue()
  const overview = resolveOverview(config, rootParent('products'))
  const rows = (await db.find({
    root: 'products',
    select: {
      id: Entry.id,
      type: Entry.type,
      title: Entry.title,
      path: Entry.path,
      locale: Entry.locale,
      workspace: Entry.workspace,
      root: Entry.root,
      parentId: Entry.parentId,
      data: Entry.data
    }
  })) as Array<Parameters<typeof loadColumnValues>[3][number]>
  const [chair] = await loadColumnValues(config, db, overview, rows)
  expect(chair.columns!.price).toBe(20)
  expect(chair.columns!.categories).toEqual([
    {entryId: expect.any(String), title: 'Chairs'},
    {entryId: expect.any(String), title: 'Seating'}
  ])
  // Compact field columns are read from the entry data
  expect(chair.columns!.brand).toBeUndefined()
})

test('explorers order by the column the editor sorts by', async () => {
  const {db} = await catalogue()
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'products'},
    {rootData: atom(getRoot(config.workspaces.main.products))}
  )
  const titles = async () =>
    (await store.get(explorer.itemsReady(null))).map(item => item.title)
  expect(await titles()).toEqual(['Chair', 'Table', 'Lamp'])
  store.set(explorer.sort, {column: 'price', direction: 'desc'})
  expect(await titles()).toEqual(['Chair', 'Lamp', 'Table'])
  const page = await store.get(explorer.pageReady)
  expect(page.sort).toEqual({
    requested: {column: 'price', direction: 'desc'},
    label: 'Price',
    column: {column: 'price', direction: 'desc'},
    manual: false
  })
  expect(page.query.orderBy).toEqual({desc: Product.price})
  store.set(explorer.sort, {column: 'brand', direction: 'asc'})
  expect(await titles()).toEqual(['Chair', 'Table', 'Lamp'])
  store.set(explorer.sort, undefined)
  expect((await store.get(explorer.pageReady)).sort.manual).toBe(true)
})

test('overview sorts live in the url of the page', () => {
  expect(formatOverviewSort({column: 'price', direction: 'desc'})).toBe(
    '-price'
  )
  expect(parseOverviewSort('price')).toEqual({
    column: 'price',
    direction: 'asc'
  })
  expect(parseOverviewSort('-')).toBeUndefined()
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  store.set(routeAtom, {workspace: 'main', root: 'products'})
  store.set(sortPageOverviewAtom, {column: 'price', direction: 'desc'})
  expect(store.get(routeAtom).sort).toBe('-price')
  expect(store.get(pageAtom).sort).toEqual({column: 'price', direction: 'desc'})
  // Returning to the overview restores its sort
  store.set(routeAtom, {workspace: 'main', root: 'brands'})
  expect(store.get(routeAtom).sort).toBeUndefined()
  store.set(routeAtom, {workspace: 'main', root: 'products'})
  expect(store.get(routeAtom).sort).toBe('-price')
  store.set(sortPageOverviewAtom, undefined)
  store.set(routeAtom, {workspace: 'main', root: 'brands'})
  store.set(routeAtom, {workspace: 'main', root: 'products'})
  expect(store.get(routeAtom).sort).toBeUndefined()
})

test('entry tables load their rows by query, sorted by a column', async () => {
  const {db, brand} = await catalogue()
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const scope = getScope(config)
  const overview = resolveOverview(config, rootParent('products'))
  const price = overview.columns.find(column => column.key === 'price')!
  const request = {
    query: {
      type: Product,
      filter: {
        brand: {has: {_entry: brand._id}}
      } as EntryTableRequest['query']['filter'],
      orderBy: overviewOrder(overview, {column: 'price', direction: 'asc'}),
      status: 'preferDraft' as const
    },
    columns: [{key: 'price', select: price.select, formatted: true}]
  }
  const key = entryTableKey(scope, request)
  const rows = await store.get(entryTableRowsAtom(key))
  expect(rows.map(row => [row.title, row.columns?.price])).toEqual([
    ['Table', 5],
    ['Lamp', 12],
    ['Chair', 20]
  ])
  // Equal requests share their rows
  expect(entryTableRowsAtom(entryTableKey(scope, request))).toBe(
    entryTableRowsAtom(key)
  )
})

test('updated and author columns only show when entries store audit data', () => {
  const row = {
    id: 'chair',
    type: 'Product',
    title: 'Chair',
    path: 'chair',
    locale: null,
    workspace: 'main',
    root: 'products',
    parentId: null
  }
  const keys = (rows: Parameters<typeof summarizeRows>[0]) =>
    resolveOverview(config, rootParent('products'), {
      children: summarizeRows(rows)
    }).columns.map(column => column.key)
  expect(keys([{...row, data: {}}])).not.toContain('updated')
  expect(keys([{...row, data: {}}])).not.toContain('author')
  const edited = {
    ...row,
    data: {metadata: {updatedAt: 1, updatedBy: {name: 'Ann', email: ''}}}
  }
  expect(keys([{...row, data: {}}, edited])).toContain('updated')
  expect(keys([edited])).toContain('author')
})

function group(
  type: string,
  status: OverviewChildren['status'] = 'published',
  audit = false
): OverviewChildren {
  return {type, status, updatedAt: audit, updatedBy: audit}
}

const Note = Config.document('Note', {
  fields: {summary: Field.text('Summary', {overview: true})}
})
const Page = Config.document('Page', {
  fields: {stock: Field.number('Stock', {overview: true})}
})
const open = Config.create({
  schema: {Note, Page, Product},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages'),
        notes: Config.root('Notes', {contains: ['Note', 'Page']})
      }
    })
  }
})
const openRoot = (root: 'pages' | 'notes'): OverviewParent => ({
  kind: 'root',
  data: getRoot(open.workspaces.main[root])
})

test('a parent without contains lists the columns of the types of its children', () => {
  const keys = (children: Array<OverviewChildren>) =>
    resolveOverview(open, openRoot('pages'), {children}).columns.map(
      column => column.key
    )
  // Only the overview: true fields of the types present, no type column
  expect(keys([group('Note')])).toEqual(['path', 'summary'])
  expect(keys([group('Note'), group('Page')])).toEqual([
    'type',
    'path',
    'summary',
    'stock'
  ])
  // Without a summary every type of the schema could be listed
  expect(
    resolveOverview(open, openRoot('pages')).columns.map(column => column.key)
  ).toContain('stock')
  expect(
    resolveOverview(open, openRoot('pages'), {children: []}).types
  ).toEqual([])
})

test('declared types follow the children that are present', () => {
  const overview = resolveOverview(open, openRoot('notes'), {
    children: [group('Page')]
  })
  expect(overview.types).toEqual(['Page'])
  expect(overview.columns.map(column => column.key)).toEqual(['path', 'stock'])
  expect(overview.columns[1].select).toEqual({all: Page.stock})
  // Without children there is nothing to tell apart
  const empty = resolveOverview(open, openRoot('notes'), {children: []})
  expect(empty.columns.map(column => column.key)).toEqual([
    'path',
    'summary',
    'stock'
  ])
})

test('the status column shows when the statuses of the children differ', () => {
  const keys = (children: Array<OverviewChildren>) =>
    resolveOverview(config, rootParent('products'), {children}).columns.map(
      column => column.key
    )
  expect(keys([group('Product')])).not.toContain('status')
  expect(keys([group('Product'), group('Product', 'draft')])).toContain(
    'status'
  )
})

test('audit columns show when any child stores audit metadata', () => {
  const keys = (children: Array<OverviewChildren>) =>
    resolveOverview(config, rootParent('products'), {children}).columns.map(
      column => column.key
    )
  expect(keys([group('Product')])).not.toContain('updated')
  expect(keys([group('Product'), group('Product', 'draft', true)])).toEqual(
    expect.arrayContaining(['updated', 'author'])
  )
  const byOnly = {...group('Product'), updatedBy: true}
  expect(keys([byOnly])).toEqual(expect.not.arrayContaining(['updated']))
  expect(keys([byOnly])).toContain('author')
})

test('builtins force columns on or off regardless of the children', () => {
  const overview = resolveOverviewOptions(
    config,
    {columns: {}, builtins: {type: true, status: true, author: false}},
    ['Product'],
    undefined,
    {children: [group('Product', 'published', true)]}
  )
  expect(overview.columns.map(column => column.key)).toEqual([
    'type',
    'status',
    'updated'
  ])
})

test('columns with position start come right after the title', () => {
  const overview = resolveOverviewOptions(
    config,
    {
      builtins: {status: true, updated: false, author: false},
      columns: {
        price: Config.column({header: 'Price', select: Product.price}),
        image: Config.column({
          header: 'Image',
          select: Product.brand,
          position: 'start'
        }),
        stock: Config.column({
          header: 'Stock',
          select: Product.stock,
          position: 'end'
        }),
        type: Config.column({
          header: 'Kind',
          select: Entry.type,
          position: 'start'
        })
      }
    },
    ['Product'],
    undefined
  )
  // A column replacing a built-in stays in the built-in's place
  expect(overview.columns.map(column => column.key)).toEqual([
    'image',
    'type',
    'status',
    'price',
    'stock'
  ])
})

async function mixedChildren() {
  const db = new LocalDB(open)
  await db.sync()
  await db.create({
    type: Note,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Note', metadata: {updatedAt: 5, updatedBy: {name: 'Ann'}}}
  } as never)
  await db.create({
    type: Note,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Plain note'}
  })
  await db.create({
    type: Page,
    workspace: 'main',
    root: 'pages',
    status: 'draft',
    set: {title: 'Draft page'}
  })
  return db
}

test('explorers resolve their columns from the children of the parent', async () => {
  const db = await mixedChildren()
  const store = createDashboardStore(open, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {rootData: atom(getRoot(open.workspaces.main.pages))}
  )
  const page = await store.get(explorer.pageReady)
  expect(page.overview.columns.map(column => column.key)).toEqual([
    'type',
    'status',
    'updated',
    'author',
    'path',
    'summary',
    'stock'
  ])
  expect(page.items).toHaveLength(3)
})

test('explorer columns follow the children as the content changes', async () => {
  const db = new LocalDB(open)
  await db.sync()
  await db.create({
    type: Note,
    workspace: 'main',
    root: 'pages',
    set: {title: 'A'}
  })
  await db.create({
    type: Note,
    workspace: 'main',
    root: 'pages',
    set: {title: 'B'}
  })
  const store = createDashboardStore(open, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {rootData: atom(getRoot(open.workspaces.main.pages))}
  )
  const keys = async () =>
    (await store.get(explorer.pageReady)).overview.columns.map(
      column => column.key
    )
  // One type, all published, no audit data: only the Note fields
  expect(await keys()).toEqual(['path', 'summary'])
  // Sorting keeps the columns
  store.set(explorer.sort, {column: 'title', direction: 'desc'})
  expect(await keys()).toEqual(['path', 'summary'])
  await db.create({
    type: Note,
    workspace: 'main',
    root: 'pages',
    status: 'draft',
    set: {title: 'C'}
  })
  await store.set(syncAtom)
  expect(await keys()).toEqual(['status', 'path', 'summary'])
})

test('search result columns follow the results like listed children', async () => {
  const db = await mixedChildren()
  const store = createDashboardStore(open, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {mode: 'search'}
  )
  const keys = async (search: string) => {
    store.set(explorer.search, search)
    return (await store.get(explorer.pageReady)).overview.columns.map(
      column => column.key
    )
  }
  // Only results with audit data show who edited them and when
  expect(await keys('plain')).toEqual(['path', 'summary'])
  expect(await keys('note')).toEqual(['updated', 'author', 'path', 'summary'])
  // The type and status columns show when the results differ in them
  expect(await keys('draft')).toEqual(['path', 'stock'])
  await db.create({
    type: Page,
    workspace: 'main',
    root: 'pages',
    status: 'draft',
    set: {title: 'Draft note'}
  })
  await store.set(syncAtom)
  expect(await keys('note')).toEqual([
    'type',
    'status',
    'updated',
    'author',
    'path',
    'summary',
    'stock'
  ])
})
