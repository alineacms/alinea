import {asc, sql, type Database} from 'rado'
import {
  ftsBm25,
  ftsDocumentSizes,
  ftsStatistics,
  type FtsSchema
} from './FtsStatistics.js'

export interface FtsMatch {
  schema: FtsSchema
  rowid: number
  rank: number
}

interface PhraseHit {
  schema: FtsSchema
  rowid: number
  title: number
  body: number
}

function prefixEnd(prefix: string): string | undefined {
  const points = Array.from(prefix)
  while (points.length) {
    const last = points.pop()!.codePointAt(0)!
    if (last < 0x10ffff)
      return (
        points.join('') +
        String.fromCodePoint(last === 0xd7ff ? 0xe000 : last + 1)
      )
  }
}

/** Complete AND-prefix matches over two immutable FTS indexes. The caller
 * serializes access to the request-local connection. Vocabulary term ranges
 * read postings, not document text; only matched document sizes are fetched.
 * Requires TEMP virtual tables (currently native SQLite, not our WASM build).
 */
export async function mergedFtsMatches(
  db: Database,
  tokens: ReadonlyArray<string>,
  excludedBaseRowids: ReadonlyArray<number>
): Promise<Array<FtsMatch>> {
  if (!tokens.length) return []
  await db.run(
    sql`create virtual table if not exists temp.alinea_search_tokenizer using fts5(text, tokenize='unicode61 remove_diacritics 2')`
  )
  await db.run(
    sql`create virtual table if not exists temp.alinea_search_tokens using fts5vocab(temp, alinea_search_tokenizer, instance)`
  )
  for (const schema of ['main', 'alinea_base'] as const)
    await db.run(
      sql`create virtual table if not exists temp.${sql.identifier(`alinea_vocab_${schema}`)} using fts5vocab(${sql.identifier(schema)}, alinea_entry_search, instance)`
    )
  const base = await ftsStatistics(db, 'alinea_base')
  const overlay = await ftsStatistics(db, 'main')
  const excluded = await ftsDocumentSizes(db, 'alinea_base', excludedBaseRowids)
  const statistics = {
    documents: base.documents + overlay.documents - excluded.size,
    tokens:
      base.tokens +
      overlay.tokens -
      [...excluded.values()].reduce((sum, size) => sum + size, 0)
  }
  const phrases: Array<Map<string, PhraseHit>> = []
  for (const token of tokens) {
    await db.run(sql`delete from temp.alinea_search_tokenizer`)
    await db.run(
      sql`insert into temp.alinea_search_tokenizer values (${token})`
    )
    const components = await db
      .select({term: sql<string>`term`})
      .from(sql`temp.alinea_search_tokens`)
      .orderBy(asc(sql`offset`))
    if (!components.length) return []
    const phrase = new Map<string, PhraseHit>()
    for (const schema of ['main', 'alinea_base'] as const) {
      let starts: Map<string, Set<number>> | undefined
      for (const [index, {term}] of components.entries()) {
        const prefix = index === components.length - 1
        const end = prefixEnd(term)
        const rows = await db
          .select({
            rowid: sql<number>`doc`,
            col: sql<string>`col`,
            offset: sql<number>`offset`
          })
          .from(sql`temp.${sql.identifier(`alinea_vocab_${schema}`)}`)
          .where(
            prefix
              ? end
                ? sql`term >= ${term} and term < ${end}`
                : sql`term >= ${term}`
              : sql`term = ${term}`
          )
        const positions = new Map<string, Set<number>>()
        for (const row of rows) {
          if (schema === 'alinea_base' && excluded.has(row.rowid)) continue
          if (row.col !== 'title' && row.col !== 'body')
            throw new Error('Unexpected FTS column')
          const key = `${row.rowid}:${row.col}`
          const offset = row.offset - index
          if (offset < 0 || (starts && !starts.get(key)?.has(offset))) continue
          const set = positions.get(key) ?? new Set<number>()
          set.add(offset)
          positions.set(key, set)
        }
        starts = positions
        if (!starts.size) break
      }
      for (const [key, positions] of starts ?? []) {
        const [id, col] = key.split(':')
        const rowid = Number(id)
        const identity = `${schema}:${rowid}`
        const hit = phrase.get(identity) ?? {schema, rowid, title: 0, body: 0}
        if (col === 'title') hit.title = positions.size
        else hit.body = positions.size
        phrase.set(identity, hit)
      }
    }
    if (!phrase.size) return []
    phrases.push(phrase)
  }
  const matching = [...phrases[0]].filter(([key]) =>
    phrases.every(phrase => phrase.has(key))
  )
  const sizes = new Map<string, number>()
  for (const schema of ['main', 'alinea_base'] as const) {
    const ids = matching.flatMap(([, hit]) =>
      hit.schema === schema ? [hit.rowid] : []
    )
    for (const [id, size] of await ftsDocumentSizes(db, schema, ids))
      sizes.set(`${schema}:${id}`, size)
  }
  return matching.map(([key, hit]) => {
    const size = sizes.get(key)
    if (size === undefined) throw new Error('Missing FTS document size')
    return {
      schema: hit.schema,
      rowid: hit.rowid,
      rank: ftsBm25(
        statistics,
        size,
        phrases.map(phrase => ({...phrase.get(key)!, documents: phrase.size}))
      )
    }
  })
}
