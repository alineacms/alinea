import {createEntrySource} from '#test/EntryFixture.js'
import {afterAll, beforeAll, expect, expectTypeOf, test} from 'bun:test'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field, Query} from '#/index.js'

const Brand = Config.document('Brand', {
  fields: {title: Field.text('Title')}
})

const Product = Config.document('Product', {
  fields: {
    title: Field.text('Title'),
    active: Field.check('Active'),
    brand: Field.entry('Brand'),
    related: Field.entry.multiple('Related')
  }
})

const cms = createCMS({
  schema: {Brand, Product},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content/main',
      roots: {
        brands: Config.root('Brands', {contains: ['Brand']}),
        products: Config.root('Products', {
          i18n: {locales: ['en', 'de']},
          contains: ['Product']
        })
      }
    })
  }
})

const link = (entry: string, id: string) => ({
  _id: id,
  _type: 'entry',
  _entry: entry
})

function product(id: string, locale: string, data: Record<string, unknown>) {
  return {
    id,
    type: 'Product',
    index: id,
    root: 'products',
    locale,
    path: id,
    data: {title: `${id} ${locale}`, ...data}
  }
}

const entries = [
  {id: 'acme', type: 'Brand', index: 'a1', root: 'brands', path: 'acme'},
  {id: 'zeta', type: 'Brand', index: 'a2', root: 'brands', path: 'zeta'},
  {id: 'idle', type: 'Brand', index: 'a3', root: 'brands', path: 'idle'},
  product('p1', 'en', {active: true, brand: link('acme', 'l1')}),
  product('p1', 'de', {active: true, brand: link('acme', 'l2')}),
  product('p2', 'en', {active: false, brand: link('zeta', 'l3')}),
  product('p3', 'en', {
    active: false,
    brand: link('zeta', 'l4'),
    related: [link('acme', 'l5')]
  })
]

const db = new LocalDB(cms.config)

beforeAll(async () => {
  await db.syncWith(await createEntrySource(cms.config, entries))
})

afterAll(async () => {
  await db.close()
})

test('selects the entries linking to an entry', async () => {
  const acme = await db.get({
    type: Brand,
    id: 'acme',
    select: {
      title: Entry.title,
      products: Query.referencedBy({
        type: Product,
        locale: 'en',
        select: {id: Entry.id, active: Product.active}
      })
    }
  })
  expectTypeOf(acme.products).toEqualTypeOf<
    Array<{id: string; active: boolean}>
  >()
  expect(acme.products).toEqual([
    {id: 'p1', active: true},
    {id: 'p3', active: false}
  ])
})

test('follows a single link field', async () => {
  const titles = await db.get({
    type: Brand,
    id: 'acme',
    select: Query.referencedBy({
      type: Product,
      field: Product.brand,
      select: Entry.title
    })
  })
  expect(titles).toEqual(['p1 de', 'p1 en'])
  const related = await db.get({
    type: Brand,
    id: 'acme',
    select: Query.referencedBy({field: Product.related, select: Entry.id})
  })
  expect(related).toEqual(['p3'])
})

test('counts references', async () => {
  const counts = await db.find({
    type: Brand,
    select: {
      id: Entry.id,
      products: Query.referencedBy({type: Product, locale: 'en', count: true})
    }
  })
  expectTypeOf(counts).toEqualTypeOf<Array<{id: string; products: number}>>()
  expect(counts).toEqual([
    {id: 'acme', products: 2},
    {id: 'zeta', products: 2},
    {id: 'idle', products: 0}
  ])
})

test('filters on the entries linking to an entry', async () => {
  const active = Query.referencedBy({type: Product, filter: {active: true}})
  expect(
    await db.find({
      type: Brand,
      filter: {_referenced: active},
      select: Entry.id
    })
  ).toEqual(['acme'])
  expect(
    await db.find({type: Brand, filter: {_referenced: true}, select: Entry.id})
  ).toEqual(['acme', 'zeta'])
  expect(
    await db.find({
      type: Brand,
      filter: {or: [{_referenced: active}, {_referenced: false}]},
      select: Entry.id
    })
  ).toEqual(['acme', 'idle'])
  const marked = await db.find({
    type: Brand,
    select: {
      id: Entry.id,
      active: Query.referencedBy({
        type: Product,
        filter: {active: true},
        first: true,
        select: Entry.id
      })
    }
  })
  expect(marked.map(brand => [brand.id, Boolean(brand.active)])).toEqual([
    ['acme', true],
    ['zeta', false],
    ['idle', false]
  ])
})

test('references share the locale of a localized entry', async () => {
  const p1 = await db.get({
    type: Product,
    id: 'p1',
    locale: 'de',
    select: {
      brand: Product.brand.first({select: Entry.id}),
      linking: Query.referencedBy({select: Entry.id})
    }
  })
  expect(p1).toEqual({brand: 'acme', linking: []})
})
