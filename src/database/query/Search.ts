import {sql, type Database, type HasSql, type Sql} from 'rado'
import {EntryIndexTable, type EntryIndexTarget} from '../entry/Schema.js'

export const EntrySearchName = 'alinea_entry_search'

export interface SearchQuery {
  target: Sql
  identity: Sql<boolean>
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
export async function createSearch(
  db: Database,
  name = EntrySearchName
): Promise<void> {
  await db.run(sql`create virtual table if not exists ${sql.identifier(name)} using fts5(
    versionId unindexed, title, body, tokenize='unicode61 remove_diacritics 2'
  )`)
}

/** Rebuild from resident entry text only when a search needs it. */
export async function rebuildSearch(
  db: Database,
  entry: EntryIndexTarget = EntryIndexTable,
  name = EntrySearchName
): Promise<void> {
  const search = sql.identifier(name)
  await db.run(sql`delete from ${search}`)
  await db.run(sql`insert into ${search}(versionId, title, body)
    select versionId, title,
      searchableText
    from ${entry}`)
}

export function searchTokens(input: string | Array<string> | undefined) {
  const text = Array.isArray(input) ? input.join(' ') : input
  if (!text) return undefined
  return text.match(/[\p{L}\p{N}\p{M}]+/gu) ?? []
}

export function searchQuery(
  input: string | Array<string> | undefined,
  entry: EntryIndexTarget = EntryIndexTable,
  name = EntrySearchName
): SearchQuery | undefined {
  const tokens = searchTokens(input)
  if (!tokens) return undefined
  // Quote individual tokens and bind the entire expression: user text cannot
  // inject FTS operators, column selectors, quotes or SQL syntax.
  const terms = tokens.map(term => `"${term}"*`).join(' AND ')
  const search = sql.identifier(name)
  const match = sql`${search} match ${terms}`
  const versionId = sql`${search}.${sql.identifier('versionId')}`
  return {
    target: search,
    identity: sql<boolean>`${versionId} = ${entry.versionId}`,
    condition: tokens.length ? sql<boolean>`${match}` : sql.value(false),
    rank: tokens.length ? sql<number>`bm25(${search}, 0, 20, 1)` : sql.value(0),
    snippet(start: HasSql, end: HasSql, cutOff: HasSql, limit: HasSql) {
      return tokens.length
        ? sql<string>`snippet(${search}, 2, ${start}, ${end}, ${cutOff}, ${limit})`
        : sql.value('')
    }
  }
}
