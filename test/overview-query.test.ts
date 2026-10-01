import {Entry} from '#/core/Entry.js'
import type {GraphQuery, Order} from '#/core/Graph.js'
import {
  MediaFile,
  MediaLibrary,
  mediaOverview
} from '#/core/media/MediaTypes.js'
import {Overview, type OverviewSortBy} from '#/core/Overview.js'
import {getScope} from '#/core/Scope.js'
import {LocalDB} from '#/database/LocalDB.js'
import {expect, setSystemTime, test} from 'bun:test'
import {BlogPost, Brand, Event, Person, Product, config} from './overview.js'

async function catalogue() {
  const db = new LocalDB(config)
  await db.sync()
  const brand = (title: string) =>
    db.create({type: Brand, workspace: 'main', root: 'brands', set: {title}})
  const zeta = await brand('Zeta')
  const acme = await brand('Acme')
  const product = (title: string, set: Record<string, unknown>) =>
    db.create({
      type: Product,
      workspace: 'main',
      root: 'products',
      set: {title, ...set}
    })
  await product('Chair', {
    price: 20,
    brand: {_id: 'b1', _type: 'entry', _entry: zeta._id}
  })
  await product('Table', {
    price: 5,
    brand: {_id: 'b2', _type: 'entry', _entry: acme._id}
  })
  await product('Lamp', {price: 12})
  return db
}

test('orders by the title of a linked entry, entries without a link last', async () => {
  const db = await catalogue()
  const byBrand = Overview.sortExpr(Product.brand.first({select: Entry.title}))
  const asc = await db.find({
    root: 'products',
    orderBy: {asc: byBrand},
    select: Entry.title
  })
  expect(asc).toEqual(['Table', 'Chair', 'Lamp'])
  const desc = await db.find({
    root: 'products',
    orderBy: {desc: byBrand},
    select: Entry.title
  })
  expect(desc).toEqual(['Chair', 'Table', 'Lamp'])
})

test('relation sort expressions survive serialization', async () => {
  const db = await catalogue()
  const scope = getScope(config)
  const query = scope.parse<GraphQuery>(
    scope.stringify({
      root: 'products',
      orderBy: {
        asc: Overview.sortExpr(Product.brand.first({select: Entry.title}))
      },
      select: Entry.title
    })
  )
  expect(await db.resolve(query)).toEqual(['Table', 'Chair', 'Lamp'])
})

test('orders mixed lists per type, types without a value last', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const person = (title: string) =>
    db.create({type: Person, workspace: 'main', root: 'people', set: {title}})
  const ann = await person('Ann')
  const bob = await person('Bob')
  await db.create({
    type: BlogPost,
    workspace: 'main',
    root: 'blog',
    set: {title: 'Post', author: {_id: 'a', _type: 'entry', _entry: bob._id}}
  })
  await db.create({
    type: Event,
    workspace: 'main',
    root: 'blog',
    set: {
      title: 'Meetup',
      organiser: {_id: 'o', _type: 'entry', _entry: ann._id}
    }
  })
  await db.create({
    type: Person,
    workspace: 'main',
    root: 'blog',
    set: {title: 'Stray'}
  })
  const byAuthor = Overview.sortExpr({
    BlogPost: BlogPost.author.first({select: Entry.title}),
    Event: Event.organiser.first({select: Entry.title})
  })
  for (const direction of ['asc', 'desc'] as const) {
    const titles = await db.find({
      root: 'blog',
      orderBy: direction === 'asc' ? {asc: byAuthor} : {desc: byAuthor},
      select: Entry.title
    })
    expect(titles).toEqual(
      direction === 'asc'
        ? ['Meetup', 'Post', 'Stray']
        : ['Post', 'Meetup', 'Stray']
    )
  }
})

test('plain fields order across types by name', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const create = (
    type: typeof BlogPost | typeof Event,
    title: string,
    publishDate: string
  ) =>
    db.create({
      type,
      workspace: 'main',
      root: 'blog',
      set: {title, publishDate}
    })
  await create(BlogPost, 'Spring post', '2026-03-01')
  await create(Event, 'Winter meetup', '2026-01-15')
  await create(BlogPost, 'Summer post', '2026-06-01')
  await create(Event, 'Autumn meetup', '2026-10-01')
  // BlogPost.publishDate also reads the publishDate field of events
  const titles = await db.find({
    root: 'blog',
    orderBy: {asc: Overview.sortExpr(BlogPost.publishDate)},
    select: Entry.title
  })
  expect(titles).toEqual([
    'Winter meetup',
    'Spring post',
    'Summer post',
    'Autumn meetup'
  ])
})

test('orders by a number of a linked entry, entries without a number last', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const product = (title: string, set: Record<string, unknown>) =>
    db.create({
      type: Product,
      workspace: 'main',
      root: 'products',
      set: {title, ...set}
    })
  const nine = await product('Nine', {price: 9})
  const ten = await product('Ten', {price: 10})
  const none = await product('None', {price: null})
  const linked = (title: string, target: string) =>
    product(title, {brand: {_id: title, _type: 'entry', _entry: target}})
  await linked('To none', none._id)
  await linked('To ten', ten._id)
  await linked('To nine', nine._id)
  const byPrice = Overview.sortExpr(
    Product.brand.first({select: Product.price})
  )
  const linkers = ['To none', 'To ten', 'To nine']
  const asc = await db.find({
    root: 'products',
    type: Product,
    filter: {title: {in: linkers}},
    orderBy: {asc: byPrice},
    select: Entry.title
  })
  expect(asc).toEqual(['To nine', 'To ten', 'To none'])
  const desc = await db.find({
    root: 'products',
    type: Product,
    filter: {title: {in: linkers}},
    orderBy: {desc: byPrice},
    select: Entry.title
  })
  expect(desc).toEqual(['To ten', 'To nine', 'To none'])
})

test('media lists folders first in their manual order, then files newest first', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const start = Date.UTC(2026, 0, 1)
  const ids: Array<string> = []
  // Created an hour apart, their ids start with letters of either case
  const create = async (
    hour: number,
    type: typeof MediaFile | typeof MediaLibrary,
    title: string
  ) => {
    setSystemTime(start + hour * 3_600_000)
    const entry = await db.create({
      type,
      workspace: 'main',
      root: 'media',
      set: {title}
    })
    ids.push(entry._id)
  }
  try {
    await create(0, MediaFile, 'Oldest file')
    await create(1, MediaLibrary, 'Older folder')
    await create(2, MediaFile, 'Older file')
    await create(3, MediaLibrary, 'Newer folder')
    await create(4, MediaFile, 'Newer file')
  } finally {
    setSystemTime()
  }
  const lowerCase = ids.map(id => id.toLowerCase())
  expect(lowerCase.toSorted()).not.toEqual(lowerCase)
  // Moved first, the newer folder's index sorts before the older folder's
  // only as stored: it starts with an upper case letter
  const [oldest, older, , newer] = ids
  const moved = await db.move({
    id: newer,
    target: oldest,
    dropPosition: 'before'
  })
  const olderIndex = await db.get({id: older, select: Entry.index})
  expect(moved.index < olderIndex).toBe(true)
  expect(moved.index.toLowerCase() > olderIndex.toLowerCase()).toBe(true)
  const {sort, sorts} = mediaOverview()
  const scope = getScope(config)
  const titles = (orderBy: Order | Array<Order>) =>
    db.resolve(
      scope.parse<GraphQuery>(
        scope.stringify({root: 'media', orderBy, select: Entry.title})
      )
    )
  expect(await titles(sort!)).toEqual([
    'Newer folder',
    'Older folder',
    'Newer file',
    'Older file',
    'Oldest file'
  ])
  // Oldest first keeps the folders first too
  const latest = sorts!.latest.by as Array<OverviewSortBy>
  expect(
    await titles(latest.map(by => ({asc: Overview.sortExpr(by)})))
  ).toEqual([
    'Older folder',
    'Newer folder',
    'Oldest file',
    'Older file',
    'Newer file'
  ])
})

test('the unused media filter lists the files no entry links to', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const media = {workspace: 'main', root: 'media'}
  await db.create({...media, type: MediaLibrary, set: {title: 'Folder'}})
  const file = (title: string) =>
    db.create({...media, type: MediaFile, set: {title}})
  const used = await file('Used')
  await file('Unused')
  const blog = await db.create({
    type: BlogPost,
    workspace: 'main',
    root: 'blog',
    set: {title: 'Post', cover: {_id: 'c1', _type: 'image', _entry: used._id}}
  })
  const unused = mediaOverview().filters!.usage.options.unused.filter
  const titles = () =>
    db.find({
      root: 'media',
      filter: unused,
      orderBy: {asc: Entry.title},
      select: Entry.title
    })
  // The folder stays to browse into
  expect(await titles()).toEqual(['Folder', 'Unused'])
  expect(
    await db.find({
      root: 'media',
      filter: {_referenced: true},
      select: Entry.title
    })
  ).toEqual(['Used'])
  // Removing the link frees the file
  await db.update({type: BlogPost, id: blog._id, set: {cover: undefined}})
  expect(await titles()).toEqual(['Folder', 'Unused', 'Used'])
})
