import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {mergedFtsMatches} from './MergedFts.js'

interface Document {
  id: number
  title: string
  body: string
}

for (const driver of ['native', 'wasm'] as const) {
  // @alinea/sqlite-wasm 0.1.18 cannot create TEMP virtual tables (reports
  // "out of memory"). Keep this gate pending, not a claimed browser capability.
  const verify = driver === 'wasm' ? test.skip : test
  verify(
    `${driver} merged FTS matches and ranks equal a fully rebuilt oracle after replacements and deletions`,
    async () => {
      const db =
        driver === 'native'
          ? connect(new Database(':memory:'))
          : await wasmDatabase()
      try {
        await db.run(sql`attach database ${''} as alinea_base`)
        await db.run(sql`attach database ${''} as oracle`)
        for (const schema of ['main', 'alinea_base', 'oracle'])
          await db.run(
            sql`create virtual table ${sql.identifier(schema)}.alinea_entry_search using fts5(title, body, tokenize='unicode61 remove_diacritics 2')`
          )
        const base: Array<Document> = [
          {id: 1, title: 'alpha beta', body: 'removed replacement'},
          {id: 2, title: 'alpha beta alpha', body: 'alpha beta'},
          {id: 3, title: 'gamma', body: 'alpha alphabet'},
          {id: 4, title: 'café', body: 'élève'},
          {id: 5, title: 'red bluebird', body: 'red blue red bluebird'},
          {id: 6, title: 'deleted alpha', body: 'alpha '.repeat(150)},
          ...Array.from({length: 12}, (_, index) => ({
            id: index + 10,
            title: 'filler',
            body: 'irrelevant text'
          }))
        ]
        const overlay: Array<Document> = [
          {id: 1, title: 'gamma beta', body: 'replacement'},
          {id: 7, title: 'rare alpha', body: 'alpha beta'},
          {id: 8, title: 'CAFÉ', body: 'red blueberry'}
        ]
        const excluded = [1, 6, 6, 999]
        for (const [schema, docs] of [
          ['alinea_base', base],
          ['main', overlay]
        ] as const)
          for (const doc of docs) {
            await db.run(
              sql`insert into ${sql.identifier(schema)}.alinea_entry_search(rowid, title, body) values (${doc.id}, ${doc.title}, ${doc.body})`
            )
            if (schema === 'alinea_base' && excluded.includes(doc.id)) continue
            const oracleId = doc.id * 2 + (schema === 'main' ? 1 : 0)
            await db.run(
              sql`insert into oracle.alinea_entry_search(rowid, title, body) values (${oracleId}, ${doc.title}, ${doc.body})`
            )
          }
        for (const tokens of [
          ['alpha'],
          ['alpha', 'beta'],
          ['al', 'alpha'],
          ['CAFÉ'],
          ['red blue'],
          ['unmatched'],
          ['gamma', 'gamma'],
          ['\u0301']
        ]) {
          const query = tokens
            .map(token => `"${token.replaceAll('"', '""')}"*`)
            .join(' AND ')
          const expected = await db
            .select({
              id: sql<number>`rowid`,
              rank: sql<number>`bm25(alinea_entry_search, 20, 1)`
            })
            .from(sql`oracle.alinea_entry_search`)
            .where(sql`alinea_entry_search match ${query}`)
          const actual = await mergedFtsMatches(db, tokens, excluded)
          const scores = new Map(
            actual.map(hit => [
              hit.rowid * 2 + (hit.schema === 'main' ? 1 : 0),
              hit.rank
            ])
          )
          expect([...scores.keys()].sort((a, b) => a - b)).toEqual(
            expected.map(row => row.id).sort((a, b) => a - b)
          )
          for (const row of expected)
            expect(scores.get(row.id)).toBeCloseTo(row.rank, 12)
        }
      } finally {
        await db.close()
      }
    }
  )
}
