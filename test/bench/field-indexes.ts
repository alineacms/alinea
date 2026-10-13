/**
 * Measures the size of the field indexes of a generated site: 1,400 entries
 * of 14 types, 16 date and number fields that each live on one or two types.
 * Compares indexes over every row with partial indexes per type, and checks
 * that queries ordering and filtering on such a field read their index.
 *
 *   bun test/bench/field-indexes.ts
 */
import {Database} from 'bun:sqlite'
import {sql} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Type, type FieldsDefinition} from '#/core/Type.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryIndexTable, isOrderedField} from '#/database/entry/EntryTable.js'
import {compileEntryQuery} from '#/database/query/EntryQuery.js'
import {jsonField} from '#/database/query/Condition.js'
import {NumberField} from '#/field/number/NumberField.js'
import {Config, Field} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'

const entryCount = 1_400
const typeCount = 14
const fieldNames = Array.from({length: 16}, (_, i) => `value${i}`)

// Each field lives on one type, every fourth also on the next type.
const types = Object.fromEntries(
  Array.from({length: typeCount}, (_, t) => {
    const fields: FieldsDefinition = {
      intro: Field.text('Intro', {searchable: true})
    }
    fieldNames.forEach((name, i) => {
      const owner = i % typeCount
      const shared = i % 4 === 0 && (owner + 1) % typeCount === t
      if (owner !== t && !shared) return
      fields[name] = i % 2 ? Field.number(name) : Field.date(name)
    })
    return [`Type${t}`, Config.document(`Type${t}`, {fields})]
  })
)
const config = Config.create({
  schema: types,
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

const entries = Array.from({length: entryCount}, (_, i) => {
  const typeName = `Type${i % typeCount}`
  const data: Record<string, unknown> = {
    title: `Entry ${i}`,
    intro: 'Lorem ipsum dolor sit amet. '.repeat(40)
  }
  for (const [name, field] of Object.entries(Type.fields(types[typeName])))
    if (isOrderedField(field))
      data[name] =
        field instanceof NumberField
          ? i
          : `2026-01-${String((i % 28) + 1).padStart(2, '0')}`
  return {
    id: `entry-${i}`,
    type: typeName,
    index: `a${String(i).padStart(4, '0')}`,
    path: `entry-${i}`,
    data
  }
})

const sqlite = new Database(':memory:')
const db = connect(sqlite)
await EntryDatabase.createSchema(db, config, 'empty')
const database = new EntryDatabase(config, db)
await database.syncWith(await createEntrySource(config, entries))

interface Size {
  total: number
  indexes: number
  count: number
}

function sizes(): Size {
  sqlite.run('vacuum')
  const pages = sqlite
    .query<{name: string; size: number}, []>(
      'select name, sum(pgsize) as size from dbstat group by name'
    )
    .all()
  const fieldIndexes = pages.filter(page =>
    page.name.startsWith('alinea_entry_index_by_field_')
  )
  return {
    total: pages.reduce((sum, page) => sum + page.size, 0),
    indexes: fieldIndexes.reduce((sum, page) => sum + page.size, 0),
    count: fieldIndexes.length
  }
}

/** Drop the indexes of the fields, the metadata keeps its own */
function dropFieldIndexes() {
  for (const {name} of sqlite
    .query<{name: string}, []>(
      `select name from sqlite_master where type = 'index'
       and name like 'alinea_entry_index_by_field_%'
       and name not like '%metadata.%'`
    )
    .all())
    sqlite.run(`drop index "${name}"`)
}

/** Create the field indexes over every row, or per type that has the field */
async function createIndexes(partial: boolean) {
  dropFieldIndexes()
  for (const name of fieldNames) {
    const owners = Object.entries(types)
      .filter(([, type]) => name in Type.fields(type))
      .map(([typeName]) => typeName)
    const value = jsonField(sql.identifier('data'), [name])
    for (const owner of partial ? owners : [undefined]) {
      const index = `alinea_entry_index_by_field_${owner ? `${owner}:` : ''}${name}`
      await db.run(sql`create index ${sql.identifier(index)}
        on ${EntryIndexTable}(${sql.identifier('type')}, ${value},
          ${sql.identifier('index')}, ${sql.identifier('filePath')})
        ${owner ? sql`where ${sql.identifier('type')} = ${sql.inline(owner)}` : sql``}`)
    }
  }
  sqlite.run('analyze')
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
function report(label: string, size: Size) {
  console.log(
    `${label.padEnd(26)} ${String(size.count).padStart(3)} indexes` +
      `  ${mb(size.indexes).padStart(9)} of ${mb(size.total).padStart(9)}` +
      `  (${((size.indexes / size.total) * 100).toFixed(1)}%)`
  )
}

function plan(query: GraphQuery): string {
  const statement = compileEntryQuery(config, query).rows.toSQL(db)
  const explain = sqlite.prepare(`explain query plan ${statement.sql}`)
  try {
    const params = statement.params as Array<string | number | null>
    return explain
      .all(...params)
      .map(row => (row as {detail: string}).detail)
      .join(' | ')
  } finally {
    explain.finalize()
  }
}

const Type1 = types.Type1!
const filtered = {
  type: Type1,
  filter: {value1: {gt: 1000}},
  select: Entry.id
}
const queries: Record<string, GraphQuery> = {
  'order by a number field': {
    type: Type1,
    orderBy: {desc: Type1.value1},
    take: 10,
    select: Entry.id
  },
  // Filters on fields of the type are typed for that type only
  'filter on a number field': filtered as GraphQuery
}

console.log(
  `${entryCount} entries, ${typeCount} types, ${fieldNames.length} fields\n`
)
report('synced (syncFieldIndexes)', sizes())
for (const name of Object.keys(queries))
  console.log(`  ${name}: ${plan(queries[name])}`)
for (const partial of [false, true]) {
  await createIndexes(partial)
  report(partial ? 'partial, per type' : 'over every row', sizes())
  for (const name of Object.keys(queries))
    console.log(`  ${name}: ${plan(queries[name])}`)
}
await database.close()
