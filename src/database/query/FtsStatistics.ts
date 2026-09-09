import {inArray, sql, type Database} from 'rado'

export interface FtsStatistics {
  documents: number
  tokens: number
}

export interface FtsPhraseFrequency {
  documents: number
  title: number
  body: number
}

export type FtsSchema = 'main' | 'alinea_base'

/** Read-only use of SQLite's documented FTS5 size records. Never alter shadow
 * tables. See https://sqlite.org/fts5.html#the_fts_index_idx_and_data_tables and
 * https://sqlite.org/fts5.html#document_sizes_table_docsize_table .
 */
export function ftsSizes(bytes: Uint8Array, expected: number): Array<number> {
  const values: Array<number> = []
  let offset = 0
  while (offset < bytes.length) {
    let value = 0n
    let complete = false
    for (let index = 0; index < 9; index++) {
      if (offset === bytes.length) throw new Error('Truncated FTS size record')
      const byte = bytes[offset++]
      value =
        index === 8
          ? value * 256n + BigInt(byte)
          : value * 128n + BigInt(byte & 127)
      if (index === 8 || byte < 128) {
        complete = true
        break
      }
    }
    if (!complete || value > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('Invalid FTS size value')
    values.push(Number(value))
  }
  if (values.length !== expected) throw new Error('Unexpected FTS size record')
  return values
}

export async function ftsStatistics(
  db: Database,
  schema: FtsSchema
): Promise<FtsStatistics> {
  const row = await db
    .select({bytes: sql<Uint8Array>`block`})
    .from(sql`${sql.identifier(schema)}.alinea_entry_search_data`)
    .where(sql`id = 1`)
    .get()
  if (!row) throw new Error('Missing FTS corpus statistics')
  // A newly created empty FTS5 index has an empty averages record.
  const [documents, title, body] = row.bytes.length
    ? ftsSizes(row.bytes, 3)
    : [0, 0, 0]
  const tokens = title + body
  if (!Number.isSafeInteger(tokens)) throw new Error('Invalid FTS token total')
  return {documents, tokens}
}

export async function ftsDocumentSizes(
  db: Database,
  schema: FtsSchema,
  rowids: ReadonlyArray<number>
): Promise<Map<number, number>> {
  const ids = [...new Set(rowids)]
  const sizes = new Map<number, number>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const rows = await db
      .select({id: sql<number>`id`, bytes: sql<Uint8Array>`sz`})
      .from(sql`${sql.identifier(schema)}.alinea_entry_search_docsize`)
      .where(inArray(sql<number>`id`, ids.slice(offset, offset + 100)))
    for (const row of rows) {
      const [title, body] = ftsSizes(row.bytes, 2)
      const size = title + body
      if (!Number.isSafeInteger(size))
        throw new Error('Invalid FTS document size')
      sizes.set(row.id, size)
    }
  }
  return sizes
}

/** Same constants, title/body weights and IDF floor as our SQLite bm25 query. */
export function ftsBm25(
  statistics: FtsStatistics,
  documentTokens: number,
  phrases: ReadonlyArray<FtsPhraseFrequency>
): number {
  if (
    ![statistics.documents, statistics.tokens, documentTokens].every(
      value => Number.isSafeInteger(value) && value >= 0
    )
  )
    throw new Error('Invalid FTS statistics')
  if (statistics.documents <= 0 || statistics.tokens <= 0)
    throw new Error('BM25 requires a nonempty token corpus')
  const average = statistics.tokens / statistics.documents
  const lengthPenalty = 1.2 * (0.25 + (0.75 * documentTokens) / average)
  let score = 0
  for (const phrase of phrases) {
    if (
      ![phrase.documents, phrase.title, phrase.body].every(
        value => Number.isSafeInteger(value) && value >= 0
      ) ||
      phrase.documents < 1 ||
      phrase.documents > statistics.documents
    )
      throw new Error('Invalid FTS phrase document count')
    const computed = Math.log(
      (statistics.documents - phrase.documents + 0.5) / (phrase.documents + 0.5)
    )
    const idf = computed <= 0 ? 1e-6 : computed
    const frequency = phrase.title * 20 + phrase.body
    score -= idf * ((frequency * 2.2) / (frequency + lengthPenalty))
  }
  return score
}
