import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {
  ftsBm25,
  ftsDocumentSizes,
  ftsSizes,
  ftsStatistics
} from './FtsStatistics.js'

test('FTS size decoding rejects truncated, oversized and wrong-shape records', () => {
  expect(ftsSizes(new Uint8Array([0, 127, 129, 0]), 3)).toEqual([0, 127, 128])
  expect(() => ftsSizes(new Uint8Array([128]), 1)).toThrow('Truncated')
  expect(() => ftsSizes(new Uint8Array(9).fill(255), 1)).toThrow('Invalid')
  expect(() => ftsSizes(new Uint8Array([0]), 2)).toThrow('Unexpected')
  expect(() => ftsBm25({documents: NaN, tokens: 1}, 1, [])).toThrow('Invalid')
})

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} FTS statistics reproduce native multi-phrase BM25 without reading document text`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await db.run(
        sql`create virtual table alinea_entry_search using fts5(title, body, tokenize='unicode61 remove_diacritics 2')`
      )
      expect(await ftsStatistics(db, 'main')).toEqual({documents: 0, tokens: 0})
      const docs = [
        ['alpha alpha', 'beta'],
        ['beta', 'alpha beta beta'],
        ['', ''],
        ['gamma', 'delta '.repeat(160)],
        ...Array.from({length: 16}, () => ['gamma', 'delta'])
      ]
      for (const [index, [title, body]] of docs.entries())
        await db.run(
          sql`insert into alinea_entry_search(rowid, title, body) values (${index + 1}, ${title}, ${body})`
        )
      const statistics = await ftsStatistics(db, 'main')
      expect(statistics).toEqual({documents: 20, tokens: 200})
      const sizes = await ftsDocumentSizes(db, 'main', [1, 2, 3, 4, 4, 999])
      expect([...sizes]).toEqual([
        [1, 3],
        [2, 4],
        [3, 0],
        [4, 161]
      ])
      const results = await db
        .select({
          id: sql<number>`rowid`,
          rank: sql<number>`bm25(alinea_entry_search, 20, 1)`
        })
        .from(sql`alinea_entry_search`)
        .where(sql`alinea_entry_search match ${'"alpha"* AND "beta"*'}`)
      expect(results).toHaveLength(2)
      for (const row of results) {
        const frequencies =
          row.id === 1
            ? [
                {documents: 2, title: 2, body: 0},
                {documents: 2, title: 0, body: 1}
              ]
            : [
                {documents: 2, title: 0, body: 1},
                {documents: 2, title: 1, body: 2}
              ]
        expect(
          ftsBm25(statistics, sizes.get(row.id)!, frequencies)
        ).toBeCloseTo(row.rank, 12)
      }
      const common = await db
        .select({rank: sql<number>`bm25(alinea_entry_search, 20, 1)`})
        .from(sql`alinea_entry_search`)
        .where(sql`rowid = 4 and alinea_entry_search match ${'gamma'}`)
        .get()
      expect(
        ftsBm25(statistics, 161, [{documents: 17, title: 1, body: 0}])
      ).toBeCloseTo(common!.rank, 15)
      await db.run(sql`delete from alinea_entry_search where rowid = 4`)
      expect(await ftsStatistics(db, 'main')).toEqual({
        documents: 19,
        tokens: 39
      })
      await db.run(sql`attach database ${':memory:'} as alinea_base`)
      await db.run(
        sql`create virtual table alinea_base.alinea_entry_search using fts5(title, body)`
      )
      await db.run(
        sql`insert into alinea_base.alinea_entry_search values (${'attached'}, ${'base words'})`
      )
      expect(await ftsStatistics(db, 'alinea_base')).toEqual({
        documents: 1,
        tokens: 3
      })
      expect([...(await ftsDocumentSizes(db, 'alinea_base', [1]))]).toEqual([
        [1, 3]
      ])
    } finally {
      await db.close()
    }
  })
}
