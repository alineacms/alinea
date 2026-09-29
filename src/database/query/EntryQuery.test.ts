import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {root} from '#/core/Root.js'
import {type} from '#/core/Type.js'
import {workspace} from '#/core/Workspace.js'
import {date} from '#/field/date/DateField.js'
import {number} from '#/field/number/NumberField.js'
import {text} from '#/field/text/TextField.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {sql} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {
  EntryIndexTable,
  entryIndexRow,
  entryIndexTable,
  syncFieldIndexes,
  type IndexedEntry
} from '../entry/EntryTable.js'
import {compileEntryQuery} from './EntryQuery.js'
import {aliasesFromData} from '#/core/db/EntryAliases.js'
import * as Query from '#/query.js'

const Page = type('Page', {fields: {title: text('Title')}})
const config: Config = {schema: {Page}, workspaces: {}}

function entry(
  id: string,
  overrides: Partial<IndexedEntry> = {}
): IndexedEntry {
  return {
    id,
    locale: null,
    versionStatus: 'published',
    status: 'published',
    type: 'Page',
    title: id,
    workspace: 'main',
    root: 'pages',
    parentId: null,
    parents: [],
    level: 0,
    index: id,
    path: id,
    filePath: `pages/${id}.json`,
    fileHash: `file-${id}`,
    parentDir: 'pages',
    childrenDir: `pages/${id}`,
    url: `/${id}`,
    active: true,
    main: true,
    seeded: null,
    rowHash: `hash-${id}`,
    searchableText: '',
    data: {},
    ...overrides
  }
}

test('structural SQL queries use the complete entry table', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  await db
    .insert(EntryIndexTable)
    .values([
      entryIndexRow(entry('a', {filePath: 'pages/a.json'})),
      entryIndexRow(entry('b', {locale: 'EN'})),
      entryIndexRow(
        entry('c', {status: 'archived', versionStatus: 'published'})
      )
    ])
  const plan = compileEntryQuery(config, {
    type: Page,
    select: {id: Entry.id, title: Entry.title},
    take: 1
  })
  expect(await plan.rows.all(db)).toEqual([{id: 'a', title: 'a'}])
  expect(
    await compileEntryQuery(config, {select: Entry.filePath, id: 'a'}).rows.all(
      db
    )
  ).toEqual(['pages/a.json'])
  expect(
    await compileEntryQuery(config, {
      select: Entry.id,
      preferredLocale: 'EN'
    }).rows.all(db)
  ).toEqual(['a', 'b'])
  expect(
    await compileEntryQuery(config, {select: Entry.id, locale: 'EN'}).rows.all(
      db
    )
  ).toEqual(['b'])
  expect(
    await compileEntryQuery(config, {
      select: Entry.id,
      status: 'archived'
    }).rows.all(db)
  ).toEqual(['c'])
  const statement = plan.rows.toSQL(db)
  expect(statement.sql).not.toContain('alinea_entry_data')
  const explainStatement = sqlite.prepare(`explain query plan ${statement.sql}`)
  try {
    const explain = explainStatement.all(
      ...(statement.params as Array<string | number | null>)
    )
    expect(JSON.stringify(explain)).toContain('INDEX')
  } finally {
    explainStatement.finalize()
  }
})

test('locales match configured spellings in any case', async () => {
  const localized: Config = {
    schema: {Page},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        roots: {
          pages: root('Pages', {i18n: {locales: ['nl-BE', 'en-GB']}}),
          other: root('Other', {i18n: {locales: ['en-gb']}})
        }
      })
    }
  }
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  await db
    .insert(EntryIndexTable)
    .values([
      entryIndexRow(entry('a')),
      entryIndexRow(entry('b', {locale: 'nl-BE'})),
      entryIndexRow(entry('c', {locale: 'en-GB'})),
      entryIndexRow(entry('d', {locale: 'en-gb', root: 'other'}))
    ])
  function ids(query: GraphQuery) {
    return compileEntryQuery(localized, {select: Entry.id, ...query}).rows.all(
      db
    )
  }
  expect(await ids({locale: 'nl-be'})).toEqual(['b'])
  expect(await ids({locale: 'NL-BE'})).toEqual(['b'])
  expect(await ids({preferredLocale: 'nl-be'})).toEqual(['a', 'b'])
  expect(await ids({locale: 'EN-GB'})).toEqual(['c', 'd'])
  expect(await ids({locale: 'fr'})).toEqual([])
  expect(
    await compileEntryQuery(localized, {
      select: Entry.locale,
      locale: 'nl-be'
    }).rows.all(db)
  ).toEqual(['nl-BE'])
  const statement = compileEntryQuery(localized, {
    type: Page,
    locale: 'nl-be',
    select: Entry.id
  }).rows.toSQL(db)
  expect(statement.sql).not.toContain('nocase')
  const explainStatement = sqlite.prepare(`explain query plan ${statement.sql}`)
  try {
    const explain = explainStatement.all(
      ...(statement.params as Array<string | number | null>)
    )
    expect(JSON.stringify(explain)).toContain('by_type (type=? AND locale=?)')
  } finally {
    explainStatement.finalize()
  }
})

test('content conditions and projections query the data column', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  for (const [id, title] of [
    ['a', 'Alpha'],
    ['b', 'Beta'],
    ['c', 'Gamma']
  ]) {
    await db
      .insert(EntryIndexTable)
      .values(entryIndexRow(entry(id, {data: {title}})))
  }
  const projection = compileEntryQuery(config, {select: Page.title, take: 1})
  const projectionRows = (await projection.rows.all(db)) as Array<{
    value: unknown
  }>
  expect(projectionRows.map(row => row.value)).toEqual(['Alpha'])
  const filtered = compileEntryQuery(config, {
    filter: {title: {isNot: 'Alpha'}},
    orderBy: {desc: Page.title},
    select: {id: Entry.id, fields: {title: Page.title}},
    take: 1
  } as GraphQuery)
  const filteredRows = (await filtered.rows.all(db)) as Array<{value: unknown}>
  expect(filteredRows.map(row => row.value)).toEqual([
    {id: 'c', fields: {title: 'Gamma'}}
  ])
})

test('physical identity preserves source status, and pagination is validated', () => {
  const archived = entryIndexRow(entry('a', {status: 'archived'}))
  expect(archived.versionStatus).toBe('published')
  expect(archived.versionId).toBe('["a",null,"published"]')
  expect(entryIndexRow(entry('a', {locale: 'EN'})).versionId).toBe(
    entryIndexRow(entry('a', {locale: 'en'})).versionId
  )
  expect(() => compileEntryQuery(config, {skip: -1, select: Entry.id})).toThrow(
    'skip'
  )
  expect(() =>
    compileEntryQuery(config, {take: 1.5, select: Entry.id})
  ).toThrow('take')
})

test('SQL grouping picks representatives before sorting', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const values = ['same', 'same', 'other', 'third']
  for (const [index, value] of values.entries()) {
    const id = String(index).padStart(2, '0')
    await db.insert(EntryIndexTable).values(
      entryIndexRow(
        entry(id, {
          data: {title: value}
        })
      )
    )
  }
  const plan = compileEntryQuery(config, {
    groupBy: Page.title,
    select: Entry.id,
    orderBy: {desc: Entry.id},
    skip: 1,
    take: 2
  })
  expect(await plan.rows.all(db)).toEqual(['02', '00'])
  expect(() =>
    compileEntryQuery(config, {
      // @ts-expect-error groupBy takes a single field
      groupBy: [Page.title]
    })
  ).toThrow('groupBy must be a single field')
})

test('SQL alias projections use metadata aliases and ignore non-URL rows', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const data = [
    {},
    {metadata: {aliases: []}},
    {metadata: {aliases: [{url: '/old'}]}},
    {
      metadata: {
        aliases: [{url: ' /spaced '}, {url: '/nested'}]
      }
    },
    {metadata: {}}
  ]
  for (const [index, payload] of data.entries()) {
    await db
      .insert(EntryIndexTable)
      .values(entryIndexRow(entry(String(index), {data: payload})))
  }
  expect(
    await compileEntryQuery(config, {select: Entry.aliases}).rows.all(db)
  ).toEqual(data.map(aliasesFromData))
  for (const [alias, expected] of [
    ['/old', ['2']],
    ['/nested', ['3']],
    ['/spaced', []],
    [' /spaced ', ['3']],
    ['', []]
  ] as const)
    expect(
      await compileEntryQuery(config, {alias, select: Entry.id}).rows.all(db)
    ).toEqual([...expected])
  expect(
    await compileEntryQuery(config, {
      alias: {isNot: '/old'},
      select: Entry.id
    }).rows.all(db)
  ).toEqual(['3'])
  expect(
    await compileEntryQuery(config, {
      alias: {startsWith: '/n'},
      select: Entry.id
    }).rows.all(db)
  ).toEqual(['3'])
})

/** Stores data as text whatever the driver supports. */
const Reference = entryIndexTable('alinea_reference_index')

const drivers = [
  {
    name: 'text',
    async open() {
      const sqlite = new Database(':memory:')
      return {db: connect(sqlite), close: () => sqlite.close()}
    }
  },
  {
    name: 'jsonb',
    async open() {
      const db = await wasmDatabase()
      return {db, close: () => db.close()}
    }
  }
]

/**
 * The indexed table stores data in the driver's format, the reference table
 * always as text, so comparing them also compares JSONB reads with text.
 */
async function referenceDatabase(
  driver: (typeof drivers)[number],
  entries: Array<IndexedEntry>
) {
  const {db, close} = await driver.open()
  await db.create(EntryIndexTable, Reference)
  for (const input of entries) {
    const row = entryIndexRow(input)
    await db.insert(EntryIndexTable).values({
      ...row,
      data: driver.name === 'jsonb' ? sql<string>`jsonb(${row.data})` : row.data
    })
    await db.insert(Reference).values(row)
  }
  async function compare(query: GraphQuery) {
    const indexed = await compileEntryQuery(config, query).rows.all(db)
    const reference = await compileEntryQuery(config, query, {
      entry: Reference
    }).rows.all(db)
    expect({query, result: indexed}).toEqual({query, result: reference})
    return indexed
  }
  return {db, close, compare}
}

for (const driver of drivers)
  test(`structured alias conditions parse each url (${driver.name})`, async () => {
    const {close, compare} = await referenceDatabase(driver, [
      entry('object', {data: {metadata: {aliases: [{url: {x: 1}}]}}}),
      entry('list', {
        data: {metadata: {aliases: [{url: [1, 2]}, {url: {x: 3}}]}}
      })
    ])
    const structured: Array<[unknown, Array<string>]> = [
      [{has: {x: 1}}, ['object']],
      [{has: {x: {gt: 2}}}, ['list']],
      [{includes: 2}, ['list']]
    ]
    for (const [alias, expected] of structured)
      expect(await compare({alias, select: Entry.id} as GraphQuery)).toEqual(
        expected
      )
    await close()
  })

for (const driver of drivers)
  test(`data fields answer filters and ordering as text data does (${driver.name})`, async () => {
    const long = (value: number) => String(value).padStart(300, '0')
    const {db, close, compare} = await referenceDatabase(
      driver,
      Array.from({length: 6}, (_, index) =>
        entry(String(index), {
          data: {
            title: index % 2 ? long(index) : `short ${index}`,
            rank: index % 3,
            body: long(5 - index),
            tags:
              index % 2 ? ['a', 'b'] : Array.from({length: 60}, () => 'tag'),
            nested: {small: index, large: long(index), list: [index]},
            metadata: {
              createdAt: 10 - index,
              aliases: [{url: long(index)}]
            }
          }
        })
      )
    )
    const queries: Array<Record<string, unknown>> = [
      {filter: {title: {startsWith: '0'}}},
      {filter: {title: {startsWith: 'short'}}},
      {filter: {body: {gt: long(2)}}},
      {filter: {tags: {includes: 'tag'}}},
      {filter: {tags: {includes: 'b'}}},
      {filter: {nested: {has: {small: {gte: 3}}}}},
      {filter: {nested: {has: {large: long(4)}}}},
      {filter: {nested: {has: {list: {includes: 2}}}}},
      {filter: {rank: 1}},
      {orderBy: {desc: Page.title}},
      {orderBy: [{asc: Entry.createdAt}]},
      {filter: {_createdAt: {lt: 8}}, orderBy: {asc: Entry.createdAt}},
      {alias: long(3)}
    ]
    expect(
      await db
        .select(sql<string>`typeof(${EntryIndexTable.data})`)
        .from(EntryIndexTable)
        .limit(1)
    ).toEqual([driver.name === 'jsonb' ? 'blob' : 'text'])
    for (const query of queries)
      await compare({...query, select: Entry.id} as GraphQuery)
    await compare({
      select: {
        id: Entry.id,
        createdAt: Entry.createdAt,
        aliases: Entry.aliases,
        path: Entry.path,
        title: Page.title,
        data: Entry.data
      }
    })
    await close()
  })

test('page locations use the physical source root and remain index-only', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  await db.insert(EntryIndexTable).values([
    entryIndexRow(entry('parent', {path: 'different-slug'})),
    entryIndexRow({
      ...entry('child', {level: 1, parentId: 'parent', parents: ['parent']}),
      parentDir: 'pages/physical'
    }),
    entryIndexRow({
      ...entry('grand', {
        level: 2,
        parentId: 'child',
        parents: ['parent', 'child']
      }),
      parentDir: 'pages/physical/child'
    })
  ])
  const query = (location: Array<string>) =>
    compileEntryQuery(config, {location, select: Entry.id}).rows.all(db)
  expect(await query(['main', 'pages', 'physical'])).toEqual(['child', 'grand'])
  expect(await query(['main', 'pages', 'different-slug'])).toEqual([])
  expect(await query(['main', 'pages', ''])).toEqual([])
  expect(await query(['', 'pages'])).toEqual([])
  expect(await query(['ignored', 'four', 'part', 'location'])).toEqual([
    'child',
    'grand',
    'parent'
  ])
})

test('unique ordering avoids correlated stable-order queries', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const statement = compileEntryQuery(config, {
    orderBy: {asc: Entry.filePath, caseSensitive: true},
    take: 10,
    select: Entry.id
  }).rows.toSQL(db)
  expect(statement.sql).not.toContain('select min(')
  const explain = sqlite
    .prepare(`explain query plan ${statement.sql}`)
    .all(...(statement.params as Array<string | number | null>))
  const details = JSON.stringify(explain)
  expect(details).toContain('alinea_entry_index_by_file_path')
  expect(details).not.toContain('CORRELATED SCALAR SUBQUERY')
  expect(details).not.toContain('TEMP B-TREE')
})

test('all relations compile into the containing SQL query', () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  const statement = compileEntryQuery(config, {
    select: {
      id: Entry.id,
      siblings: Query.siblings({select: Entry.id}),
      children: Query.children({
        depth: 2,
        orderBy: {desc: Page.title},
        skip: 1,
        take: 2,
        select: Entry.id
      }),
      count: Query.children({count: true}),
      next: Query.next({select: Entry.id})
    }
  }).rows.toSQL(db)
  expect(statement.sql).toContain('json_group_array')
  expect(statement.sql).toContain('with recursive')
  expect(statement.sql).toContain('alinea_relation_count_1')
})

test('embedded sibling relations use the parent index', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const statement = compileEntryQuery(config, {
    take: 100,
    select: {
      id: Entry.id,
      siblings: Query.siblings({select: Entry.id})
    }
  }).rows.toSQL(db)
  const explain = sqlite
    .prepare(`explain query plan ${statement.sql}`)
    .all(...(statement.params as Array<string | number | null>))
  expect(JSON.stringify(explain)).toContain('alinea_entry_index_by_parent')
})

const Dated = type('Dated', {
  fields: {date: date('Date'), rank: number('Rank')}
})
const dated: Config = {schema: {Dated}, workspaces: {}}

async function datedDatabase(sqlite: Database) {
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const values: Array<
    [string, string | undefined, number | null, number | undefined]
  > = [
    ['a', '2024-01-02', 2, 200],
    ['b', undefined, null, undefined],
    ['c', '2024-03-01', 10, 300],
    ['d', '2023-12-31', 1, 100]
  ]
  await db.insert(EntryIndexTable).values(
    values.map(([id, date, rank, createdAt]) =>
      entryIndexRow(
        entry(id, {
          type: 'Dated',
          data: {date, rank, metadata: {createdAt}}
        })
      )
    )
  )
  return db
}

test('date and number fields order by value with nulls last', async () => {
  using sqlite = new Database(':memory:')
  const db = await datedDatabase(sqlite)
  const ids = (query: GraphQuery) =>
    compileEntryQuery(dated, {...query, select: Entry.id}).rows.all(db)
  expect(await ids({orderBy: {desc: Dated.date}})).toEqual(['c', 'a', 'd', 'b'])
  expect(await ids({orderBy: {asc: Dated.date}})).toEqual(['d', 'a', 'c', 'b'])
  expect(await ids({orderBy: {desc: Dated.rank}})).toEqual(['c', 'a', 'd', 'b'])
  expect(await ids({orderBy: {asc: Dated.rank}})).toEqual(['d', 'a', 'c', 'b'])
  expect(await ids({orderBy: {desc: Entry.createdAt}})).toEqual([
    'c',
    'a',
    'd',
    'b'
  ])
  expect(await ids({orderBy: {asc: Entry.createdAt}})).toEqual([
    'd',
    'a',
    'c',
    'b'
  ])
})

test('ordering by a date field walks its field index', async () => {
  using sqlite = new Database(':memory:')
  const db = await datedDatabase(sqlite)
  await syncFieldIndexes(db, dated)
  const statement = compileEntryQuery(dated, {
    type: Dated,
    orderBy: {desc: Dated.date},
    take: 2,
    select: Entry.id
  }).rows.toSQL(db)
  const explain = sqlite
    .prepare(`explain query plan ${statement.sql}`)
    .all(...(statement.params as Array<string | number | null>))
  const details = JSON.stringify(explain)
  expect(details).toContain('alinea_entry_index_by_field_date')
  expect(details).not.toContain('TEMP B-TREE')
})

test('ordering by creation time walks its metadata index', async () => {
  using sqlite = new Database(':memory:')
  const db = await datedDatabase(sqlite)
  await syncFieldIndexes(db, dated)
  const statement = compileEntryQuery(dated, {
    type: Dated,
    orderBy: {desc: Entry.createdAt},
    take: 2,
    select: Entry.id
  }).rows.toSQL(db)
  const explain = sqlite
    .prepare(`explain query plan ${statement.sql}`)
    .all(...(statement.params as Array<string | number | null>))
  const details = JSON.stringify(explain)
  expect(details).toContain('alinea_entry_index_by_field_metadata.createdAt')
  expect(details).not.toContain('TEMP B-TREE')
})

test('long value lists bind one parameter, which the WASM build prepares', async () => {
  const db = await wasmDatabase()
  await db.create(EntryIndexTable)
  await db
    .insert(EntryIndexTable)
    .values([
      entryIndexRow(entry('parent')),
      entryIndexRow(
        entry('child', {level: 1, parentId: 'parent', parents: ['parent']})
      )
    ])
  // A listing of ten thousand entries asks which of them have children
  const ids = Array.from({length: 20_000}, (_, i) => `entry-${i}`)
  const plan = compileEntryQuery(config, {
    parentId: {in: [...ids, 'parent']},
    groupBy: Entry.parentId,
    select: Entry.parentId
  })
  expect(plan.rows.toSQL(db).sql.length).toBeLessThan(5_000)
  expect(await plan.rows.all(db)).toEqual(['parent'])
  expect(
    await compileEntryQuery(config, {
      id: {notIn: [...ids, 'parent']},
      select: Entry.id
    }).rows.all(db)
  ).toEqual(['child'])
  db.close()
})

test('path lookups and counts read an index', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  function details(query: GraphQuery) {
    const statement = compileEntryQuery(config, query).rows.toSQL(db)
    const explain = sqlite
      .prepare(`explain query plan ${statement.sql}`)
      .all(...(statement.params as Array<string | number | null>))
    return JSON.stringify(explain)
  }
  expect(details({first: true, type: Page, path: 'slug'})).toContain(
    'alinea_entry_index_by_path (path=? AND type=?)'
  )
  expect(details({first: true, parentId: null, path: 'slug'})).toContain(
    'alinea_entry_index_by_path (path=?)'
  )
  // Counts read only the index and leave the matches unsorted
  const count = details({count: true, type: Page})
  expect(count).toContain('COVERING INDEX alinea_entry_index_by_type')
  expect(count).not.toContain('TEMP B-TREE')
})
