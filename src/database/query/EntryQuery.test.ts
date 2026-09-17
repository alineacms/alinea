import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {type} from '#/core/Type.js'
import {text} from '#/field/text/TextField.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {
  EntryIndexTable,
  entryIndexRow,
  type IndexedEntry
} from '../entry/Schema.js'
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
      preferredLocale: 'en'
    }).rows.all(db)
  ).toEqual(['a', 'b'])
  expect(
    await compileEntryQuery(config, {select: Entry.id, locale: 'en'}).rows.all(
      db
    )
  ).toEqual(['b'])
  expect(
    await compileEntryQuery(config, {
      select: Entry.locale,
      locale: 'en'
    }).rows.all(db)
  ).toEqual(['EN'])
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
  expect(() => compileEntryQuery(config, {groupBy: [Page.title]})).toThrow(
    'groupBy must be a single field'
  )
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
  expect(details).not.toContain('USE TEMP B-TREE FOR ORDER BY')
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
