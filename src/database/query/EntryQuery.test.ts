import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {type} from '#/core/Type.js'
import {text} from '#/field/text/TextField.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {
  EntryDataTable,
  EntryIndexTable,
  entryIndexRow,
  type IndexedEntry
} from '../entry/Schema.js'
import {compileEntryQuery} from './EntryQuery.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'

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

test('structural SQL queries do not require or join payload tables', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  // Deliberately omit the data table: an index-only query must still execute.
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
  expect(plan.membershipData).toBe(false)
  expect(plan.projectionData).toBe(false)
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

test('content conditions and projections compile with distinct dependencies', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await db.create(EntryIndexTable, EntryDataTable)
  for (const [id, title] of [
    ['a', 'Alpha'],
    ['b', 'Beta'],
    ['c', 'Gamma']
  ]) {
    const row = entryIndexRow(entry(id))
    await db.insert(EntryIndexTable).values(row)
    await db
      .insert(EntryDataTable)
      .values({versionId: row.versionId, payloadId: id, data: {title}})
  }
  const projection = compileEntryQuery(config, {select: Page.title, take: 1})
  expect(projection.membershipData).toBe(false)
  expect(projection.projectionData).toBe(true)
  expect(await projection.rows.all(db)).toEqual(['Alpha'])
  const filtered = compileEntryQuery(config, {
    filter: {title: {isNot: 'Alpha'}},
    orderBy: {desc: Page.title},
    select: {id: Entry.id, fields: {title: Page.title}},
    take: 1
  } as GraphQuery)
  expect(filtered.membershipData).toBe(true)
  expect(await filtered.rows.all(db)).toEqual([
    {id: 'c', fields: {title: 'Gamma'}}
  ])
  expect(await filtered.candidates.all(db)).toHaveLength(3)
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
  await db.create(EntryIndexTable, EntryDataTable)
  const index = new EntryIndex(cms.config)
  await index.syncWith(new FSSource('test/fixtures/demo'))
  const resolver = new EntryResolver(cms.config, index)
  let ordinal = 0
  for (const entry of index.filter({})) {
    const row = entryIndexRow({
      ...entry,
      versionStatus: entry.status,
      ordinal: ordinal++
    })
    await db.insert(EntryIndexTable).values(row)
    await db.insert(EntryDataTable).values({
      versionId: row.versionId,
      payloadId: entry.fileHash,
      data: entry.data
    })
  }
  const cases: Array<GraphQuery<unknown, typeof DemoRecipe>> = [
    {select: Entry.id},
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
    {filter: {_id: {notIn: ['oi4qtV9YaXNRIUDT2s61Y']}}, select: Entry.id}
  ]
  for (const query of cases) {
    const expected = await resolver.resolve(query)
    const plan = compileEntryQuery(cms.config, query)
    expect(await plan.rows.all(db)).toEqual(expected)
  }
})
