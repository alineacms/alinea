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

test('SQL filters match JSON field values', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(Documents)
  await db.insert(Documents).values([
    {id: 1, data: {}},
    {id: 2, data: {nullable: null, enabled: false, count: 0, label: 'zero'}},
    {id: 3, data: {nullable: 'value', enabled: true, count: 1, label: 'one'}},
    {id: 4, data: {title: '100%_real', nested: {score: 8}}},
    {id: 5, data: {title: '100XXreal', nested: {score: 2}}},
    {id: 6, data: {title: "'; drop table documents; --"}},
    {id: 7, data: {items: [{url: '/one', children: [{title: 'match'}]}]}},
    {id: 8, data: {items: [{url: '/two', children: [{title: 'miss'}]}]}},
    {id: 9, data: {items: [], tags: ['international', 'research']}},
    {id: 10, data: {tags: ['regional']}}
  ])
  const matching = (filter: unknown) =>
    db
      .select(Documents.id)
      .from(Documents)
      .where(compileFilter(filter, name => jsonField(Documents.data, [name])))
      .orderBy(Documents.id)
  const all = Array.from({length: 10}, (_, index) => index + 1)
  const cases: Array<[filter: unknown, ids: Array<number>]> = [
    [{}, all],
    [{and: []}, all],
    // A missing field matches null too
    [{nullable: null}, all.filter(id => id !== 3)],
    [{count: 0}, [2]],
    [{enabled: false}, [2]],
    [{nullable: {isNot: null}}, [3]],
    [{label: {in: ['zero', 'two']}}, [2]],
    [{label: {notIn: ['zero', 'two']}}, [3]],
    [{or: []}, []],
    [{title: {startsWith: '100%_'}}, [4]],
    [
      {and: [{title: {startsWith: '100'}}, {nested: {has: {score: {gte: 8}}}}]},
      [4]
    ],
    [{title: "'; drop table documents; --"}, [6]],
    [{items: {includes: {children: {includes: {title: 'match'}}}}}, [7]],
    [{items: {includes: {url: {startsWith: '/t'}}}}, [8]],
    [{items: {includes: {}}}, [7, 8]],
    [{tags: {includes: 'international'}}, [9]]
  ]
  for (const [filter, ids] of cases)
    expect({filter, ids: await matching(filter)}).toEqual({filter, ids})
})
