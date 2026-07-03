import {suite} from '@alinea/suite'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {DocDB, type DocDBOptions, scanLinks} from './DocDB.js'

const test = suite(import.meta)

const options: DocDBOptions = {
  extractLinks(data) {
    return scanLinks(data, value => {
      if (typeof value._entry === 'string') return value._entry
    })
  },
  searchableText(data) {
    return {
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.text === 'string' ? data.text : ''
    }
  },
  indexPaths: ['type', 'category']
}

function createDb() {
  return new DocDB(connect(new Database(':memory:')), options)
}

test('insert and get', () => {
  const db = createDb()
  db.insert([
    {id: 'a', data: {type: 'Page', title: 'Root A'}},
    {id: 'b', parent: 'a', data: {type: 'Page', title: 'Child B'}}
  ])
  const a = db.get('a')
  test.equal(a, {
    id: 'a',
    parent: null,
    variant: null,
    level: 0,
    data: {type: 'Page', title: 'Root A'}
  })
  const b = db.get('b')
  test.is(b!.parent, 'a')
  test.is(b!.level, 1)
  const many = db.getMany(['a', 'b', 'missing'])
  test.is(many.length, 2)
})

test('variants', () => {
  const db = createDb()
  db.insert([
    {id: 'a', variant: 'published', data: {title: 'Published'}},
    {id: 'a', variant: 'draft', data: {title: 'Draft'}}
  ])
  test.is(db.getMany(['a']).length, 2)
  test.is(db.get('a', 'draft')!.data.title, 'Draft')
  test.is(db.get('a', 'published')!.data.title, 'Published')
  db.remove([{id: 'a', variant: 'draft'}])
  test.is(db.getMany(['a']).length, 1)
})

test('replace on conflict', () => {
  const db = createDb()
  db.insert([{id: 'a', data: {title: 'Before', link: {_entry: 'x'}}}])
  db.insert([{id: 'a', data: {title: 'After'}}])
  test.is(db.getMany(['a']).length, 1)
  test.is(db.get('a')!.data.title, 'After')
  test.is(db.referencesTo('x').length, 0)
})

test('hierarchy', () => {
  const db = createDb()
  db.insert([
    // Out of order on purpose: children before parents
    {id: 'a-b-c', parent: 'a-b', data: {title: 'C'}},
    {id: 'a-b', parent: 'a', data: {title: 'B'}},
    {id: 'a', data: {title: 'A'}},
    {id: 'z', data: {title: 'Z'}}
  ])
  test.is(db.get('a-b-c')!.level, 2)
  const roots = db.query({parent: null})
  test.equal(
    roots.map(doc => doc.id),
    ['a', 'z']
  )
  const children = db.query({parent: 'a'})
  test.equal(
    children.map(doc => doc.id),
    ['a-b']
  )
  const descendants = db.query({descendantOf: 'a'})
  test.equal(descendants.map(doc => doc.id).sort(), ['a-b', 'a-b-c'])
  const level1 = db.query({descendantOf: 'a', level: 1})
  test.equal(
    level1.map(doc => doc.id),
    ['a-b']
  )
})

test('where conditions and order', () => {
  const db = createDb()
  db.insert([
    {id: '1', data: {type: 'Page', category: 'news', weight: 3}},
    {id: '2', data: {type: 'Page', category: 'sports', weight: 1}},
    {id: '3', data: {type: 'Author', category: 'news', weight: 2}}
  ])
  const pages = db.query({where: {path: 'type', eq: 'Page'}})
  test.is(pages.length, 2)
  const news = db.query({
    where: {
      and: [
        {path: 'type', eq: 'Page'},
        {path: 'category', eq: 'news'}
      ]
    }
  })
  test.equal(
    news.map(doc => doc.id),
    ['1']
  )
  const byWeight = db.query({orderBy: [{path: 'weight'}]})
  test.equal(
    byWeight.map(doc => doc.id),
    ['2', '3', '1']
  )
  const heavy = db.query({where: {path: 'weight', gte: 2}})
  test.is(heavy.length, 2)
  const paged = db.query({orderBy: [{path: 'weight'}], skip: 1, take: 1})
  test.equal(
    paged.map(doc => doc.id),
    ['3']
  )
  test.is(db.count({where: {path: 'type', eq: 'Page'}}), 2)
})

test('edges', () => {
  const db = createDb()
  db.insert([
    {id: 'target', data: {title: 'Target'}},
    {
      id: 'source',
      data: {
        title: 'Source',
        blocks: [{text: 'hello', link: {_entry: 'target'}}]
      }
    }
  ])
  const refs = db.referencesTo('target')
  test.is(refs.length, 1)
  test.is(refs[0].id, 'source')
  test.is(refs[0].path, 'blocks.0.link')
  const from = db.referencesFrom('source')
  test.is(from.length, 1)
  test.is(from[0].target, 'target')
  const linking = db.query({linksTo: 'target'})
  test.equal(
    linking.map(doc => doc.id),
    ['source']
  )
})

test('search', () => {
  const db = createDb()
  db.insert([
    {id: '1', data: {title: 'Chocolate chip cookies', text: 'A recipe'}},
    {id: '2', data: {title: 'Bread', text: 'Contains no chocolate at all'}},
    {id: '3', data: {title: 'Crème brûlée', text: 'Dessert'}}
  ])
  const results = db.query({search: 'chocolate'})
  test.is(results.length, 2)
  // Title match ranks before body match
  test.is(results[0].id, '1')
  const prefix = db.query({search: 'choc'})
  test.is(prefix.length, 2)
  const diacritics = db.query({search: 'creme brulee'})
  test.equal(
    diacritics.map(doc => doc.id),
    ['3']
  )
  db.remove([{id: '1'}])
  test.is(db.query({search: 'chocolate'}).length, 1)
})

test('boot from serialized image', () => {
  const source = new Database(':memory:')
  const db = new DocDB(connect(source), options)
  db.insert([
    {id: 'a', data: {type: 'Page', title: 'Hello world'}},
    {id: 'b', parent: 'a', data: {type: 'Page', title: 'Nested'}}
  ])
  const image = source.serialize()
  const restored = new DocDB(connect(Database.deserialize(image)), options)
  test.is(restored.get('b')!.data.title, 'Nested')
  test.equal(
    restored.query({search: 'hello'}).map(doc => doc.id),
    ['a']
  )
})
