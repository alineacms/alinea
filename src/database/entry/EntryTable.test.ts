import {expect, test} from 'bun:test'
import {getSql, sql, table} from 'rado'
import * as column from 'rado/universal/columns'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {jsonField} from '../query/Condition.js'
import {entryDataText} from './EntryData.js'

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
