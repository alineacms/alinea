import {createEntrySource} from '#test/EntryFixture.js'
import {afterAll, beforeAll, expect, expectTypeOf, test} from 'bun:test'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import type {EntryFilterFields} from '#/core/EntryFields.js'
import type {Filter, OpenFilter} from '#/core/Filter.js'
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

const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title'),
    brand: Field.entry('Brand'),
    rows: Field.list('Rows', {
      schema: {
        Row: Config.type('Row', {fields: {link: Field.entry('Link')}})
      }
    }),
    body: Field.richText('Body')
  }
})

const cms = createCMS({
  schema: {Brand, Product, Article},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content/main',
      roots: {
        brands: Config.root('Brands', {contains: ['Brand']}),
        products: Config.root('Products', {
          i18n: {locales: ['en', 'de']},
          contains: ['Product']
        }),
        articles: Config.root('Articles', {contains: ['Article']})
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

function article(id: string, data: Record<string, unknown>) {
  return {
    id,
    type: 'Article',
    index: id,
    root: 'articles',
    path: id,
    data: {title: id, ...data}
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
  }),
  article('direct', {brand: link('acme', 'l6')}),
  article('listed', {
    rows: [{_id: 'r1', _type: 'Row', _index: 'a0', link: link('zeta', 'l7')}]
  }),
  article('written', {
    body: [
      {
        _type: 'paragraph',
        content: [
          {
            _type: 'text',
            text: 'Zeta',
            marks: [{_type: 'link', _id: 'l8', _link: 'entry', _entry: 'zeta'}]
          }
        ]
      }
    ]
  }),
  article('plain', {})
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

test('filters on the entries an entry links to', async () => {
  const articles = (filter: Filter<EntryFilterFields>) =>
    db.find({type: Article, filter, select: Entry.id})
  expect(await articles({_references: {_id: 'acme'}})).toEqual(['direct'])
  expect(await articles({_references: {_id: 'zeta'}})).toEqual([
    'listed',
    'written'
  ])
  expect(await articles({_references: true})).toEqual([
    'direct',
    'listed',
    'written'
  ])
  expect(await articles({_references: false})).toEqual(['plain'])
  expect(
    await articles({_references: {_id: {in: ['acme', 'zeta']}, _type: 'Brand'}})
  ).toEqual(['direct', 'listed', 'written'])
  expect(
    await db.find({
      type: Product,
      locale: 'en',
      filter: {_references: {_id: 'acme'}},
      select: Entry.id
    })
  ).toEqual(['p1', 'p3'])
})

test('filters on the entries an entry links to through one field', async () => {
  const through = (field: typeof Product.brand | typeof Product.related) =>
    db.find({
      type: Product,
      locale: 'en',
      filter: {_references: Query.references({field, filter: {_id: 'acme'}})},
      select: Entry.id
    })
  expect(await through(Product.brand)).toEqual(['p1'])
  expect(await through(Product.related)).toEqual(['p3'])
})

test('selects the entries an entry links to', async () => {
  const p3 = await db.get({
    type: Product,
    id: 'p3',
    locale: 'en',
    select: {
      all: Query.references({select: Entry.id}),
      related: Query.references({field: Product.related, select: Entry.id}),
      brands: Query.references({type: Brand, count: true})
    }
  })
  expectTypeOf(p3).toEqualTypeOf<{
    all: Array<string>
    related: Array<string>
    brands: number
  }>()
  expect(p3).toEqual({all: ['acme', 'zeta'], related: ['acme'], brands: 2})
})

test('filters on the entries linking to an entry by their fields', async () => {
  expect(
    await db.find({
      type: Brand,
      filter: {_referenced: {_type: 'Article'}},
      select: Entry.id
    })
  ).toEqual(['acme', 'zeta'])
  const filter: OpenFilter<EntryFilterFields> = {_references: {_id: 'acme'}}
  expect(await db.find({type: Article, filter, select: Entry.id})).toEqual([
    'direct'
  ])
})
