import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {table} from 'rado'
import * as column from 'rado/universal/columns'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {compileFilter, jsonField} from './Condition.js'

const Documents = table('documents', {
  id: column.integer().primaryKey(),
  data: column.json<Record<string, unknown>>().notNull()
})

test('SQL JSON predicates compare typed field values directly', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {}},
    {id: 2, data: {nullable: null, enabled: false, count: 0, label: 'zero'}},
    {id: 3, data: {nullable: 'value', enabled: true, count: 1, label: 'one'}}
  ])
  async function matching(filter: unknown) {
    return db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)
  }
  expect(await matching({nullable: null})).toEqual([1, 2])
  expect(await matching({nullable: {isNot: null}})).toEqual([3])
  expect(await matching({enabled: false})).toEqual([2])
  expect(await matching({count: 0})).toEqual([2])
  expect(await matching({label: {in: ['zero', 'two']}})).toEqual([2])
  expect(await matching({label: {notIn: ['zero', 'two']}})).toEqual([3])
  expect(await matching({or: []})).toEqual([])
  expect(await matching({and: []})).toEqual([1, 2, 3])
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

test('nested SQL includes uses independent array scopes', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {items: [{url: '/one', children: [{title: 'match'}]}]}},
    {id: 2, data: {items: [{url: '/two', children: [{title: 'miss'}]}]}},
    {id: 3, data: {items: []}}
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
  expect(await query({items: {includes: {}}})).toEqual([1, 2])
})

test('SQL includes matches primitive array values', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {tags: ['international', 'research']}},
    {id: 2, data: {tags: ['regional']}},
    {id: 3, data: {tags: ['1']}},
    {id: 4, data: {tags: []}}
  ])
  const matching = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)
  expect(await matching({tags: {includes: 'international'}})).toEqual([1])
})

test('SQL comparisons use the declared field type', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {score: 10, title: 'alpha'}},
    {id: 2, data: {score: 2, title: 'beta'}},
    {id: 3, data: {score: 5, title: 'gamma'}}
  ])
  const matching = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)

  expect(await matching({score: {gt: 5}})).toEqual([1])
  expect(await matching({score: {lte: 5}})).toEqual([2, 3])
  expect(await matching({title: {gte: 'beta'}})).toEqual([2, 3])
})

test('SQL in conditions support large value sets', async () => {
  const db = await wasmDatabase()
  try {
    await db.create(Documents)
    await db.insert(Documents).values({id: 1, data: {label: 'match'}})
    const values = Array.from({length: 1500}, (_, index) => `value-${index}`)
    values.push('match')

    const result = await db
      .select(Documents.id)
      .from(Documents)
      .where(
        compileFilter({label: {in: values}}, name =>
          jsonField(Documents.data, [name])
        )
      )

    expect(result).toEqual([1])
  } finally {
    await db.close()
  }
})
