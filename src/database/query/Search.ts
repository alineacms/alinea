import {sql, type Database, type HasSql, type Sql} from 'rado'
import {EntryIndexTable} from '../entry/Schema.js'

export interface SearchQuery {
  needsPayloads: boolean
  condition: Sql<boolean>
  rank: Sql<number>
  snippet(
    start: HasSql,
    end: HasSql,
    cutOff: HasSql,
    limit: HasSql
  ): Sql<string>
}

/** Create the local standard FTS5 index. It is populated lazily so a cold
 * database does not tokenize every payload before its first search query. */
export async function createSearch(db: Database): Promise<void> {
  if (db.dialect.runtime !== 'sqlite') return
  await db.run(sql`create virtual table alinea_entry_search using fts5(
    title, body, tokenize='unicode61 remove_diacritics 2'
  )`)
}

/** Rebuild from resident payload text only when a search needs it. */
export async function rebuildSearch(db: Database): Promise<void> {
  if (db.dialect.runtime !== 'sqlite') return
  await db.run(sql`delete from alinea_entry_search`)
  await db.run(sql`insert into alinea_entry_search(rowid, title, body)
    select data.rowid, entry.title,
      coalesce(json_extract(data.source, '$.searchableText'), '')
    from alinea_entry_data data
    inner join alinea_entry_index entry
      on entry.versionId = data.versionId`)
}

export function searchTokens(input: string | Array<string> | undefined) {
  const text = Array.isArray(input) ? input.join(' ') : input
  if (!text) return undefined
  return text.match(/[\p{L}\p{N}\p{M}]+/gu) ?? []
}

export function searchQuery(
  input: string | Array<string> | undefined
): SearchQuery | undefined {
  const tokens = searchTokens(input)
  if (!tokens) return undefined
  // Quote individual tokens and bind the entire expression: user text cannot
  // inject FTS operators, column selectors, quotes or SQL syntax.
  const terms = tokens.map(term => `"${term}"*`).join(' AND ')
  const match = sql`alinea_entry_search match ${terms}`
  const identity = sql`rowid = (
    select rowid from alinea_entry_data where versionId = ${EntryIndexTable.versionId}
  )`
  return {
    needsPayloads: tokens.length > 0,
    condition: tokens.length
      ? sql.universal<boolean>({
          sqlite: sql`exists (
          select 1 from alinea_entry_search where ${identity} and ${match}
        )`
        })
      : sql.value(false),
    rank: tokens.length
      ? sql.universal<number>({
          sqlite: sql`(
          select bm25(alinea_entry_search, 20, 1)
          from alinea_entry_search where ${identity} and ${match}
        )`
        })
      : sql.value(0),
    snippet(start: HasSql, end: HasSql, cutOff: HasSql, limit: HasSql) {
      return tokens.length
        ? sql.universal<string>({
            sqlite: sql`(
            select snippet(alinea_entry_search, 1, ${start}, ${end}, ${cutOff}, ${limit})
            from alinea_entry_search where ${identity} and ${match}
          )`
          })
        : sql.value('')
    }
  }
}
