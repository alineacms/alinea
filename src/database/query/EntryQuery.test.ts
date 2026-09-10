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
  entrySource,
  type IndexedEntry
} from '../entry/Schema.js'
import {compileEntryQuery} from './EntryQuery.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {aliasesFromData} from '#/core/db/EntryAliases.js'

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
    url: `/${id}`,
    active: true,
    main: true,
    seeded: null,
    rowHash: `hash-${id}`,
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
      entryIndexRow(entry('a')),
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
      select: Entry.id,
      status: 'archived'
    }).rows.all(db)
  ).toEqual(['c'])
  const statement = plan.rows.toSQL(db)
  expect(statement.sql).not.toContain('alinea_entry_data')
  const explain = sqlite
    .prepare(`explain query plan ${statement.sql}`)
    .all(...(statement.params as Array<string | number | null>))
  expect(JSON.stringify(explain)).toContain('INDEX')
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
    await db.insert(EntryIndexTable).values(entryIndexRow(entry(id), {title}))
  }
  const projection = compileEntryQuery(config, {select: Page.title, take: 1})
  expect(await projection.rows.all(db)).toEqual(['Alpha'])
  const filtered = compileEntryQuery(config, {
    filter: {title: {isNot: 'Alpha'}},
    orderBy: {desc: Page.title},
    select: {id: Entry.id, fields: {title: Page.title}},
    take: 1
  } as GraphQuery)
  expect(await filtered.rows.all(db)).toEqual([
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

test('SQL compilation agrees with the existing resolver on the real demo corpus', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const index = new EntryIndex(cms.config)
  await index.syncWith(new FSSource('test/fixtures/demo'))
  const resolver = new EntryResolver(cms.config, index)
  let ordinal = 0
  for (const entry of index.filter({})) {
    const row = entryIndexRow(
      {...entry, versionStatus: entry.status, ordinal: ordinal++},
      entry.data,
      entrySource(entry)
    )
    await db.insert(EntryIndexTable).values(row)
  }
  const cases: Array<GraphQuery<unknown, typeof DemoRecipe>> = [
    {select: Entry.id},
    {select: Entry},
    {id: 'oi4qtV9YaXNRIUDT2s61Y', select: Entry.id},
    {type: DemoRecipe, select: DemoRecipe.title},
    {location: cms.workspaces.demo.media, select: Entry.id},
    {location: cms.workspaces.demo, select: Entry.id, skip: 2, take: 3},
    {locale: 'en', select: Entry.id},
    {type: DemoRecipe, select: {id: Entry.id, title: DemoRecipe.title}},
    {
      type: DemoRecipe,
      filter: {title: {startsWith: 'Chocolate'}},
      select: Entry.id
    },
    {status: 'archived', select: Entry.id},
    {groupBy: Entry.type, select: Entry.id},
    {groupBy: DemoRecipe.title, type: DemoRecipe, select: Entry.id},
    {select: Entry.id, skip: 1},
    {select: Entry.id, take: 0},
    {groupBy: Entry.type, select: Entry.id, skip: 1, take: 0},
    {filter: {_id: {notIn: ['oi4qtV9YaXNRIUDT2s61Y']}}, select: Entry.id}
  ]
  for (const query of cases) {
    const expected = await resolver.resolve(query)
    const plan = compileEntryQuery(cms.config, query)
    expect(await plan.rows.all(db)).toEqual(expected)
  }
})

test('SQL grouping preserves primitive types and picks representatives before sorting', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const values = [undefined, null, false, 0, '0', 0, null, {}, {}, [], []]
  for (const [index, value] of values.entries()) {
    const id = String(index).padStart(2, '0')
    await db
      .insert(EntryIndexTable)
      .values(
        entryIndexRow(
          entry(id, {ordinal: index}),
          value === undefined ? {} : {title: value}
        )
      )
  }
  const plan = compileEntryQuery(config, {
    groupBy: Page.title,
    select: Entry.id,
    orderBy: {desc: Entry.id},
    skip: 1,
    take: 8
  })
  expect(await plan.rows.all(db)).toEqual([
    '09',
    '08',
    '07',
    '04',
    '03',
    '02',
    '01',
    '00'
  ])
  expect(() => compileEntryQuery(config, {groupBy: [Page.title]})).toThrow(
    'groupBy must be a single field'
  )
})

test('SQL alias projections combine both locations and alias filters ignore non-URL rows', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable)
  const data = [
    {},
    {aliases: []},
    {metadata: {aliases: [{url: '/old'}, null]}},
    {
      aliases: ['legacy', {url: ' /spaced '}, false],
      metadata: {aliases: [{url: '/nested'}, {url: 12}]}
    },
    {aliases: null, metadata: {aliases: 'not an array'}}
  ]
  for (const [index, payload] of data.entries()) {
    await db
      .insert(EntryIndexTable)
      .values(entryIndexRow(entry(String(index)), payload))
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
