import '#test/react.js'
import {Entry} from '#/core/Entry.js'
import {getRoot} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {Product, config} from '#test/overview.js'
import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {createExplorerAtoms} from './explorer.js'
import {
  type OverviewParent,
  overviewFilter,
  overviewOrder,
  pickedFilters,
  resolveOverview,
  sortedColumn
} from './overview.js'
import {userPolicyReadyAtom} from './user.js'

function rootParent(root: 'products' | 'media'): OverviewParent {
  return {kind: 'root', data: getRoot(config.workspaces.main[root])}
}

test('without declared sorts the title and sortable columns sort', () => {
  const products = resolveOverview(config, rootParent('products'))
  expect(products.sorts.map(sort => sort.key)).toEqual([
    'title',
    'articleNumber',
    'status',
    'updated',
    'author',
    'brand',
    'price'
  ])
  expect(products.filters).toEqual([])
  expect(overviewOrder(products, {column: 'price', direction: 'desc'})).toEqual(
    {desc: Product.price}
  )
})

test('the media library declares its sorts and filters', () => {
  const media = resolveOverview(config, rootParent('media'))
  expect(media.sorts.map(sort => [sort.key, sort.label])).toEqual([
    ['title', 'Title A–Z'],
    ['titleDesc', 'Title Z–A'],
    ['size', 'Size'],
    ['dimensions', 'Dimensions'],
    ['fileType', 'File type']
  ])
  expect(media.filters.map(filter => filter.key)).toEqual(['show', 'fileType'])
  expect(
    overviewOrder(media, {column: 'titleDesc', direction: 'desc'})
  ).toEqual({desc: Entry.title})
  expect(
    overviewOrder(media, {column: 'dimensions', direction: 'desc'})
  ).toEqual([{desc: MediaFile.width}, {desc: MediaFile.height}])
  // Declared orders mark the column that orders by the same value
  expect(sortedColumn(media, {column: 'titleDesc', direction: 'desc'})).toEqual(
    {column: 'title', direction: 'desc'}
  )
  expect(sortedColumn(media, {column: 'size', direction: 'asc'})).toEqual({
    column: 'size',
    direction: 'asc'
  })
  // Unknown orders fall back to the default order
  expect(overviewOrder(media, {column: 'nope', direction: 'asc'})).toBe(
    undefined
  )
})

test('options of a filter match any, filters match all', () => {
  const media = resolveOverview(config, rootParent('media'))
  const [show, fileType] = media.filters
  const option = (key: string) =>
    [...show.options, ...fileType.options].find(option => option.key === key)!
      .filter
  const selection = {
    fileType: ['pdf', 'document', 'unknown'],
    show: ['files', 'folders'],
    other: ['x']
  }
  // Unknown keys drop, filters of one option keep the first
  expect(pickedFilters(media, selection)).toEqual({
    show: ['files'],
    fileType: ['pdf', 'document']
  })
  expect(overviewFilter(media, selection)).toEqual({
    and: [option('files'), {or: [option('pdf'), option('document')]}]
  })
  expect(overviewFilter(media, {fileType: ['pdf']})).toEqual(option('pdf'))
  expect(overviewFilter(media, {})).toBeUndefined()
})

test('a sort option marked default orders the children', () => {
  const Folder = Config.document('Folder', {
    contains: ['Folder'],
    fields: {},
    overview: {
      sorts: {
        title: {label: 'Title', by: Entry.title},
        newest: {
          label: 'Newest',
          by: Entry.createdAt,
          direction: 'desc',
          default: true
        }
      }
    }
  })
  expect(Type.childrenOrder(Folder)).toEqual([{desc: Entry.createdAt}])
})

async function mediaLibrary() {
  const db = new LocalDB(config)
  await db.sync()
  const folder = await db.create({
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Folder'}
  })
  const file = (
    id: string,
    title: string,
    extension: string,
    size: number
  ) => ({
    op: 'create' as const,
    id,
    type: 'MediaFile',
    locale: null,
    workspace: 'main',
    root: 'media',
    data: {title, path: id, location: `${id}${extension}`, extension, size}
  })
  await db.mutate([
    file('annual', 'Annual report', '.pdf', 300),
    file('scan', 'Scanned letter', '.PDF', 100),
    file('photo', 'Photo', '.jpg', 200),
    file('notes', 'Meeting notes', '.docx', 50)
  ])
  return {db, folder}
}

test('explorers filter media by file type, keeping folders', async () => {
  const {db} = await mediaLibrary()
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'media'},
    {rootData: atom(getRoot(config.workspaces.main.media))}
  )
  const titles = async () =>
    (await store.get(explorer.itemsReady(null))).map(item => item.title)
  const media = await store.get(explorer.overview)
  const fileType = media.filters.find(filter => filter.key === 'fileType')!
  const show = media.filters.find(filter => filter.key === 'show')!

  store.set(explorer.toggleFilter, fileType, 'pdf')
  store.set(explorer.sort, {column: 'titleDesc', direction: 'desc'})
  // Extensions match in either case, folders stay to browse into
  expect(await titles()).toEqual(['Scanned letter', 'Folder', 'Annual report'])
  const page = await store.get(explorer.pageReady)
  expect(page.filters).toEqual({fileType: ['pdf']})
  expect(page.sort.label).toBe('Title Z–A')
  expect(page.sort.manual).toBe(false)
  expect(page.query.filter).toEqual(fileType.options[1].filter)

  // Several options of a filter match any of them
  store.set(explorer.toggleFilter, fileType, 'document')
  expect(await titles()).toEqual([
    'Scanned letter',
    'Meeting notes',
    'Folder',
    'Annual report'
  ])

  // Filters match all, options of a single choice filter replace each other
  store.set(explorer.toggleFilter, show, 'folders')
  store.set(explorer.toggleFilter, show, 'files')
  expect(store.get(explorer.requestedFilters)).toEqual({
    fileType: ['pdf', 'document'],
    show: ['files']
  })
  expect(await titles()).toEqual([
    'Scanned letter',
    'Meeting notes',
    'Annual report'
  ])

  // The filters combine with the search terms
  store.set(explorer.search, 'report')
  expect(await titles()).toEqual(['Annual report'])

  store.set(explorer.search, '')
  store.set(explorer.clearFilters)
  store.set(explorer.sort, {column: 'size', direction: 'desc'})
  expect(await titles()).toEqual([
    'Annual report',
    'Photo',
    'Scanned letter',
    'Meeting notes',
    'Folder'
  ])
  expect((await store.get(explorer.pageReady)).filters).toEqual({})
})
