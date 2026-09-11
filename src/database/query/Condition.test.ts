import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {table} from 'rado'
import * as column from 'rado/universal/columns'
import {compileFilter, jsonField} from './Condition.js'

const Documents = table('documents', {
  id: column.integer().primaryKey(),
  data: column.json<Record<string, unknown>>().notNull()
})

test('SQL JSON predicates preserve missing/null and primitive types', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {}},
    {id: 2, data: {value: null}},
    {id: 3, data: {value: false}},
    {id: 4, data: {value: 0}},
    {id: 5, data: {value: '0'}}
  ])
  async function matching(filter: unknown) {
    return db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)
  }
  expect(await matching({value: null})).toEqual([2])
  expect(await matching({value: false})).toEqual([3])
  expect(await matching({value: 0})).toEqual([4])
  expect(await matching({value: '0'})).toEqual([5])
  expect(await matching({value: {isNot: null}})).toEqual([1, 3, 4, 5])
  expect(await matching({value: {in: [null, 0]}})).toEqual([2, 4])
  expect(await matching({value: {notIn: [null, 0]}})).toEqual([1, 3, 5])
  expect(await matching({or: []})).toEqual([])
  expect(await matching({and: []})).toEqual([1, 2, 3, 4, 5])
})

test('nested predicates and literal prefixes compile to parameterized SQL', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {title: '100%_real', nested: {score: 8}}},
    {id: 2, data: {title: '100XXreal', nested: {score: 2}}},
    {id: 3, data: {title: "'; drop table documents; --", nested: {score: 9}}}
  ])
  const query = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
  expect(
    await query({
      and: [{title: {startsWith: '100%_'}}, {nested: {has: {score: {gte: 8}}}}]
    })
  ).toEqual([1])
  expect(await query({title: "'; drop table documents; --"})).toEqual([3])
  expect(await query({})).toEqual([1, 2, 3])
})

test('nested SQL includes uses independent array scopes and rejects scalar containers', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {items: [{url: '/one', children: [{title: 'match'}]}]}},
    {id: 2, data: {items: [{url: '/two', children: [{title: 'miss'}]}]}},
    {id: 3, data: {items: 'not json'}},
    {id: 4, data: {items: [null, 'plain', 1, false]}}
  ])
  const query = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)
  expect(
    await query({items: {includes: {children: {includes: {title: 'match'}}}}})
  ).toEqual([1])
  expect(await query({items: {includes: {url: {startsWith: '/t'}}}})).toEqual([
    2
  ])
  expect(await query({items: {includes: {}}})).toEqual([1, 2, 4])
  expect(await query({items: {includes: {url: null}}})).toEqual([])
})

test('SQL includes matches primitive array values without treating them as objects', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {tags: ['international', 'research']}},
    {id: 2, data: {tags: ['regional']}},
    {id: 3, data: {tags: ['1']}},
    {id: 4, data: {tags: [1, true, null]}},
    {id: 5, data: {tags: 'international'}},
    {id: 6, data: {tags: ['true']}}
  ])
  const matching = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)
  expect(await matching({tags: {includes: 'international'}})).toEqual([1])
  expect(await matching({tags: {includes: 1}})).toEqual([4])
  expect(await matching({tags: {includes: true}})).toEqual([4])
  expect(await matching({tags: {includes: null}})).toEqual([4])
})

test('SQL comparisons do not use SQLite ordering between JSON types', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {value: 10}},
    {id: 2, data: {value: 2}},
    {id: 3, data: {value: '10'}},
    {id: 4, data: {value: '2'}},
    {id: 5, data: {value: {nested: true}}},
    {id: 6, data: {value: [10]}},
    {id: 7, data: {value: true}}
  ])
  const matching = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)

  expect(await matching({value: {gt: 5}})).toEqual([1])
  expect(await matching({value: {gte: '2'}})).toEqual([4])
  expect(await matching({value: {lt: 5}})).toEqual([2])
})
