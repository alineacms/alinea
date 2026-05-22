import {suite} from '@alinea/suite'
import {ContentDB, type ContentShape, type FieldDirective} from './index.js'

const test = suite(import.meta)

interface Meta {
  _filePath: string
  type: string
  group: string
}

interface Derived {}

const shape: ContentShape<Meta, Derived> = {
  lookup: '_filePath',
  global: {},
  derive() {
    return {}
  },
  type(meta) {
    return meta.type
  },
  fields() {
    return {
      group: 'exact',
      score: 'range',
      featured: 'column',
      sha: 'column',
      type: 'column',
      title: 'payload',
      nested: 'payload',
      tags: 'payload'
    }
  },
  paths() {
    return []
  }
}

test('ContentDB exports, opens, reads fields, and reconstructs lookup fields', () => {
  const db = new ContentDB(shape)
  db.upsert(
    {_filePath: 'content/alpha.json', type: 'Article', group: 'news'},
    {
      title: 'Alpha',
      score: 10,
      featured: true,
      sha: '0123456789abcdef',
      nested: {inner: 'x'},
      tags: [{itemId: 'one'}, {itemId: 'two'}]
    }
  )
  db.upsert(
    {_filePath: 'content/beta.json', type: 'Article', group: 'news'},
    {
      title: 'Beta',
      score: 20,
      featured: false,
      sha: 'fedcba9876543210',
      nested: {inner: 'y'},
      tags: [{itemId: 'two'}]
    }
  )

  const opened = new ContentDB(shape, db.compile())
  const alpha = opened.get('content/alpha.json')!

  test.is(opened.read(alpha, '_filePath'), 'content/alpha.json')
  test.is(opened.read(alpha, 'title'), 'Alpha')
  test.is(opened.read(alpha, 'score'), 10)
  test.equal(opened.pick(alpha, ['_filePath', 'sha', 'nested']), {
    _filePath: 'content/alpha.json',
    sha: '0123456789abcdef',
    nested: {inner: 'x'}
  })
  test.equal(opened.hydrate(alpha), {
    title: 'Alpha',
    nested: {inner: 'x'},
    tags: [{itemId: 'one'}, {itemId: 'two'}],
    group: 'news',
    type: 'Article',
    score: 10,
    featured: true,
    sha: '0123456789abcdef',
    _filePath: 'content/alpha.json'
  })
})

test('ContentDB uses indexed equality, range, nested, and list filters after open', () => {
  const db = new ContentDB(shape)
  db.upsert(
    {_filePath: 'content/alpha.json', type: 'Article', group: 'news'},
    {
      title: 'Alpha',
      score: 10,
      featured: true,
      sha: '0123456789abcdef',
      nested: {inner: 'x'},
      tags: [{itemId: 'one'}, {itemId: 'two'}]
    }
  )
  db.upsert(
    {_filePath: 'content/beta.json', type: 'Article', group: 'news'},
    {
      title: 'Beta',
      score: 20,
      featured: false,
      sha: 'fedcba9876543210',
      nested: {inner: 'y'},
      tags: [{itemId: 'two'}]
    }
  )
  db.upsert(
    {_filePath: 'content/gamma.json', type: 'Article', group: 'docs'},
    {
      title: 'Gamma',
      score: 30,
      featured: true,
      sha: '0011223344556677',
      nested: {inner: 'x'},
      tags: [{itemId: 'three'}]
    }
  )

  const opened = new ContentDB(shape, db.compile())

  test.equal(
    Array.from(opened.findKeys({group: 'news'})).sort(),
    ['content/alpha.json', 'content/beta.json']
  )
  test.equal(
    Array.from(opened.findKeys({score: {gte: 20}} as any)).sort(),
    ['content/beta.json', 'content/gamma.json']
  )
  test.equal(
    Array.from(
      opened.findKeys({
        and: [
          {featured: true},
          {nested: {has: {inner: {is: 'x'}}}},
          {tags: {includes: {itemId: {is: 'one'}}}}
        ]
      } as any)
    ),
    ['content/alpha.json']
  )
})

test('ContentDB supports dictionary columns as an index alternative', () => {
  const dictionaryShape: ContentShape<Meta, Derived> = {
    ...shape,
    fields() {
      return {
        group: 'dictionary',
        score: 'range',
        type: 'column'
      }
    }
  }
  const db = new ContentDB(dictionaryShape)
  db.upsert(
    {_filePath: 'content/alpha.json', type: 'Article', group: 'news'},
    {score: 10}
  )
  db.upsert(
    {_filePath: 'content/beta.json', type: 'Article', group: 'docs'},
    {score: 20}
  )

  const opened = new ContentDB(dictionaryShape, db.compile())

  test.equal(Array.from(opened.findKeys({group: 'news'})), [
    'content/alpha.json'
  ])
  test.is(opened.read(opened.get('content/beta.json')!, 'group'), 'docs')
})

test('ContentDB stores global columns once across all types', () => {
  const globalShape: ContentShape<Meta, Derived> = {
    ...shape,
    global: {group: 'exact', type: 'dictionary'},
    fields(type): Readonly<Record<string, FieldDirective>> {
      if (type === 'Article') return {score: 'range', title: 'payload'}
      return {featured: 'column', title: 'payload'}
    }
  }
  const db = new ContentDB(globalShape)
  db.upsert(
    {_filePath: 'content/published.json', type: 'Article', group: 'shared-id'},
    {score: 10, title: 'Published'}
  )
  db.upsert(
    {_filePath: 'content/draft.json', type: 'Draft', group: 'shared-id'},
    {featured: true, title: 'Draft'}
  )

  const opened = new ContentDB(globalShape, db.compile())
  const draft = opened.get('content/draft.json')!

  test.equal(
    Array.from(opened.findKeys({group: 'shared-id'})).sort(),
    ['content/draft.json', 'content/published.json']
  )
  test.equal(Array.from(opened.findKeys({type: 'Draft'})), [
    'content/draft.json'
  ])
  test.is(opened.read(draft, 'group'), 'shared-id')
  test.equal(opened.hydrate(draft), {
    title: 'Draft',
    _filePath: 'content/draft.json',
    group: 'shared-id',
    type: 'Draft',
    featured: true
  })
})

test('ContentDB serialized exact indexes can return duplicate values', () => {
  const idShape: ContentShape<Meta, Derived> = {
    ...shape,
    fields() {
      return {
        group: 'exact',
        type: 'column',
        title: 'payload'
      }
    }
  }
  const db = new ContentDB(idShape)
  db.upsert(
    {_filePath: 'content/published.json', type: 'Page', group: 'shared-id'},
    {title: 'Published'}
  )
  db.upsert(
    {_filePath: 'content/draft.json', type: 'Draft', group: 'shared-id'},
    {title: 'Draft'}
  )

  const opened = new ContentDB(idShape, db.compile())

  test.equal(
    Array.from(opened.findKeys({group: 'shared-id'})).sort(),
    ['content/draft.json', 'content/published.json']
  )
  test.equal(Array.from(opened.findKeys({group: 'shared-id', type: 'Page'})), [
    'content/published.json'
  ])
})

test('ContentDB rejects fields configured as both index and dictionary', async () => {
  const invalidShape: ContentShape<Meta, Derived> = {
    ...shape,
    global: {group: 'exact'},
    fields() {
      return {group: 'dictionary'}
    }
  }
  const db = new ContentDB(invalidShape)
  db.upsert(
    {_filePath: 'content/alpha.json', type: 'Article', group: 'news'},
    {score: 10}
  )

  await test.throws(
    () => db.compile(),
    'declared in both global and fields(Article)'
  )
})
