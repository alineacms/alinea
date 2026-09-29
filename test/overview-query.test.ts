import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Overview} from '#/core/Overview.js'
import {getScope} from '#/core/Scope.js'
import {LocalDB} from '#/database/LocalDB.js'
import {expect, test} from 'bun:test'
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
  const db = await catalogue()
  const titles = await db.find({
    root: 'products',
    orderBy: {asc: Overview.sortExpr(Product.price)},
    select: Entry.title
  })
  expect(titles).toEqual(['Table', 'Lamp', 'Chair'])
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
