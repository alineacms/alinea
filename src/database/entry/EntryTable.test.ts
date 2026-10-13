import {type} from '#/core/Type.js'
import {date} from '#/field/date/DateField.js'
import {number} from '#/field/number/NumberField.js'
import {text} from '#/field/text/TextField.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {getSql, sql, table} from 'rado'
import {connect as connectNative} from 'rado/driver/bun-sqlite'
import * as column from 'rado/universal/columns'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {jsonField} from '../query/Condition.js'
import {entryDataText} from './EntryData.js'
import {EntryIndexTable, syncFieldIndexes} from './EntryTable.js'

const Rows = table('rows', {
  text: column.text().notNull(),
  data: column.text().notNull()
})

const document = `{"title": "first", "nested": {"value": 1, "list": [1, 2]},
  "number": 1.50, "big": 12345678901234567890, "note": null}`

const paths: Array<Array<string>> = [
  ['title'],
  ['nested'],
  ['nested', 'value'],
  ['nested', 'list', '1'],
  ['number'],
  ['big'],
  ['note'],
  ['missing'],
  ['missing', 'deeper']
]

test('JSONB data reads paths as its JSON text does', async () => {
  const db = await wasmDatabase()
  await db.create(Rows)
  await db.run(
    sql`insert into ${Rows}(text, data) values (${document}, jsonb(${document}))`
  )
  for (const path of paths) {
    const binary = jsonField(Rows.data, path)
    const text = jsonField(Rows.text, path)
    const row = await db
      .select({
        binary: sql`${binary}`,
        text: sql`${text}`,
        binaryJson: sql`${getSql(binary).forSelection()}`,
        textJson: sql`${getSql(text).forSelection()}`
      })
      .from(Rows)
      .get()
    expect({path, binary: row?.binary, json: row?.binaryJson}).toEqual({
      path,
      binary: row?.text,
      json: row?.textJson
    })
  }
  const stored = await db
    .select({
      binary: entryDataText(Rows),
      text: entryDataText({data: Rows.text})
    })
    .from(Rows)
    .get()
  expect(JSON.parse(stored!.binary)).toEqual(JSON.parse(document))
  expect(JSON.parse(stored!.text)).toEqual(JSON.parse(document))
  await db.close()
})

test('field indexes follow the ordered fields and metadata of the config', async () => {
  const db = await wasmDatabase()
  await db.create(EntryIndexTable)
  const indexes = async () =>
    (
      await db.all<{name: string}>(
        sql`select name from sqlite_master
          where type = 'index' and name like 'alinea_entry_index_by_field_%'
          order by name`
      )
    ).map(row => row.name)
  const Article = type('Article', {
    fields: {title: text('Title'), date: date('Date'), rank: number('Rank')}
  })
  const Note = type('Note', {fields: {title: text('Title')}})
  await syncFieldIndexes(db, {schema: {Article, Note}, workspaces: {}})
  expect(await indexes()).toEqual([
    'alinea_entry_index_by_field_Article:date',
    'alinea_entry_index_by_field_Article:rank',
    'alinea_entry_index_by_field_metadata.createdAt',
    'alinea_entry_index_by_field_metadata.updatedAt'
  ])
  // Fields are indexed over the rows of their type
  const [{sql: definition}] = await db.all<{sql: string}>(
    sql`select sql from sqlite_master
      where name = 'alinea_entry_index_by_field_Article:date'`
  )
  expect(definition).toEndWith(`where "type" = 'Article'`)
  const Dated = type('Article', {fields: {date: date('Date')}})
  await syncFieldIndexes(db, {schema: {Dated}, workspaces: {}})
  expect(await indexes()).toEqual([
    'alinea_entry_index_by_field_Dated:date',
    'alinea_entry_index_by_field_metadata.createdAt',
    'alinea_entry_index_by_field_metadata.updatedAt'
  ])
  await db.close()
})

test('recent entries of a workspace are found by walking an index', async () => {
  // The WASM build omits EXPLAIN: plan the statements natively.
  using sqlite = new Database(':memory:')
  const db = connectNative(sqlite)
  await db.create(EntryIndexTable)
  await syncFieldIndexes(db, {schema: {}, workspaces: {}})
  const entry = EntryIndexTable
  const updatedAt = jsonField(entry.data, ['metadata', 'updatedAt'])
  // The order the query layer compiles for each, with its tie breakers
  const orders = {
    updated: sql`${updatedAt} desc, ${entry.index} desc, ${entry.filePath} desc`,
    id: sql`${entry.id} desc, ${entry.index} asc, ${entry.filePath} asc`
  }
  for (const [name, order] of Object.entries(orders)) {
    // Record the statement the query compiles to, then ask for its plan
    let compiled = ''
    const prepare = sqlite.prepare.bind(sqlite)
    sqlite.prepare = ((statement: string) => {
      compiled = statement
      return prepare(statement)
    }) as typeof sqlite.prepare
    await db.all(sql`select ${entry.id} from ${entry}
      where ${entry.visible} = 1 and ${entry.active} = 1
        and ${entry.workspace} = 'main'
      order by ${order} limit 3`)
    sqlite.prepare = prepare
    const explain = sqlite.prepare<{detail: string}, []>(
      `explain query plan ${compiled}`
    )
    const details = explain
      .all()
      .map(row => row.detail)
      .join(' / ')
    explain.finalize()
    expect(details).toContain(`alinea_entry_index_recent_${name}`)
    // Sorting would read every entry of the workspace first
    expect(details).not.toContain('TEMP B-TREE')
  }
})
