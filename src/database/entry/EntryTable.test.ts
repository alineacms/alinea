import {type} from '#/core/Type.js'
import {date} from '#/field/date/DateField.js'
import {number} from '#/field/number/NumberField.js'
import {text} from '#/field/text/TextField.js'
import {expect, test} from 'bun:test'
import {getSql, sql, table} from 'rado'
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

test('field indexes follow the ordered fields of the config', async () => {
  const db = await wasmDatabase()
  await db.create(EntryIndexTable)
  const indexes = async () =>
    (
      await db.all<{name: string}>(
        sql`select name from sqlite_master
          where type = 'index' and sql like '%->>%' order by name`
      )
    ).map(row => row.name)
  const Article = type('Article', {
    fields: {title: text('Title'), date: date('Date'), rank: number('Rank')}
  })
  await syncFieldIndexes(db, {schema: {Article}, workspaces: {}})
  expect(await indexes()).toEqual([
    'alinea_entry_index_by_field_date',
    'alinea_entry_index_by_field_rank'
  ])
  const Dated = type('Article', {fields: {date: date('Date')}})
  await syncFieldIndexes(db, {schema: {Dated}, workspaces: {}})
  expect(await indexes()).toEqual(['alinea_entry_index_by_field_date'])
  await db.close()
})
