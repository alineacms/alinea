import {chunks} from '#/core/util/Arrays.js'
import {sql, type Database, type HasSql, type Sql} from 'rado'
import type {EntryIndexTarget} from '../entry/EntryTable.js'

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
  name = EntrySearchName,
  temporary = false
): Promise<void> {
  const search = temporary
    ? sql`temp.${sql.identifier(name)}`
    : sql.identifier(name)
  await db.run(sql`create virtual table if not exists ${search} using fts5(
    versionId unindexed, title, body, tokenize='unicode61 remove_diacritics 2'
  )`)
}

/** Rebuild from resident entry text only when a search needs it. */
export async function rebuildSearch(
  db: Database,
  entry: EntryIndexTarget,
  name: string
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

export interface SearchQueryOptions {
  /** Indexed spellings a token may also match, besides its prefix. */
  alternatives?(token: string): ReadonlyArray<string>
}

export function searchQuery(
  input: string | Array<string> | undefined,
  entry: EntryIndexTarget,
  name: string,
  options: SearchQueryOptions = {}
): SearchQuery | undefined {
  const tokens = searchTokens(input)
  if (!tokens) return undefined
  // Quote individual tokens and bind the entire expression: user text cannot
  // inject FTS operators, column selectors, quotes or SQL syntax.
  const terms = tokens
    .map(token => {
      const spellings = [
        `"${token}"*`,
        ...(options.alternatives?.(token) ?? []).map(
          term => `"${term.replaceAll('"', '')}"`
        )
      ]
      return spellings.length > 1
        ? `(${spellings.join(' OR ')})`
        : spellings[0]!
    })
    .join(' AND ')
  const search = sql.identifier(name)
  const match = sql`${search} match ${terms}`
  const versionId = sql`${search}.${sql.identifier('versionId')}`
  const relevance = sql<number>`bm25(${search}, 0, 20, 1)`
  const titlePrefix = tokens.length
    ? sql<number>`case
        when instr(lower(trim(${entry.title})), ${tokens[0]!.toLowerCase()}) = 1
        then -1000000 else 0 end`
    : sql.value(0)
  return {
    target: search,
    identity: sql<boolean>`${versionId} = ${entry.versionId}`,
    condition: tokens.length ? sql<boolean>`${match}` : sql.value(false),
    rank: tokens.length
      ? sql<number>`${titlePrefix} + ${relevance}`
      : sql.value(0),
    snippet(start: HasSql, end: HasSql, cutOff: HasSql, limit: HasSql) {
      return tokens.length
        ? sql<string>`snippet(${search}, 2, ${start}, ${end}, ${cutOff}, ${limit})`
        : sql.value('')
    }
  }
}

const updateBatchSize = 500

/** Refresh the rows of changed entries and drop rows of removed entries. */
export async function updateSearch(
  db: Database,
  entry: EntryIndexTarget,
  name: string,
  changedEntryIds: ReadonlyArray<string>
): Promise<void> {
  const search = sql.identifier(name)
  for (const ids of chunks(changedEntryIds, updateBatchSize)) {
    const list = sql.join(
      ids.map(id => sql.value(id)),
      sql`, `
    )
    await db.run(sql`delete from ${search}
      where versionId in (select versionId from ${entry} where id in (${list}))`)
  }
  await db.run(sql`delete from ${search}
    where versionId not in (select versionId from ${entry})`)
  for (const ids of chunks(changedEntryIds, updateBatchSize)) {
    const list = sql.join(
      ids.map(id => sql.value(id)),
      sql`, `
    )
    await db.run(sql`insert into ${search}(versionId, title, body)
      select versionId, title, searchableText
      from ${entry} where id in (${list})`)
  }
}

/** The edit distance allowed per character of a term. */
const fuzzyFactor = 0.1
const maxFuzzyDistance = 6
const maxAlternatives = 10
const objectNamePattern = /^[a-z][a-z0-9_]*$/i

/** The edits a token may be away from an indexed term: none below five
 * characters, one up to fourteen, then one more per ten. */
export function fuzzyDistance(token: string): number {
  return Math.min(maxFuzzyDistance, Math.round(token.length * fuzzyFactor))
}

export function vocabularyName(searchName: string): string {
  return `${searchName}_vocab`
}

export async function dropVocabulary(
  db: Database,
  searchName: string
): Promise<void> {
  await db.run(
    sql`drop table if exists temp.${sql.identifier(vocabularyName(searchName))}`
  )
}

interface VocabularyTerm {
  term: string
  count: number
}

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
}

/** Whether two terms are within a bounded Levenshtein distance. */
function withinDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let previous = Array.from({length: b.length + 1}, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + cost
      )
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > max) return false
    previous = current
  }
  return previous[b.length]! <= max
}

/**
 * The terms of one FTS5 table, loaded once per index revision. Query tokens
 * expand to indexed terms within a small edit distance, so a typo still
 * finds the entry.
 */
export class SearchVocabulary {
  #revision: string | undefined
  #byLength = new Map<number, Array<VocabularyTerm>>()

  async load(
    db: Database,
    searchName: string,
    schema: 'main' | 'temp',
    revision: string
  ): Promise<void> {
    if (this.#revision === revision) return
    if (!objectNamePattern.test(searchName))
      throw new Error(`Invalid search table name ${JSON.stringify(searchName)}`)
    const vocab = sql.identifier(vocabularyName(searchName))
    // Module arguments cannot be bound, and the names are validated above.
    await db.run(
      sql.unsafe(
        `create virtual table if not exists temp."${vocabularyName(searchName)}"
         using fts5vocab('${schema}', '${searchName}', 'row')`
      )
    )
    const rows = await db.all<{term: string; cnt: number}>(
      sql`select term, cnt from temp.${vocab}`
    )
    const byLength = new Map<number, Array<VocabularyTerm>>()
    for (const row of rows) {
      const terms = byLength.get(row.term.length) ?? []
      terms.push({term: row.term, count: row.cnt})
      byLength.set(row.term.length, terms)
    }
    this.#byLength = byLength
    this.#revision = revision
  }

  /** Indexed terms close to a token, most frequent first; prefixes of the
   * token are left to the prefix match. */
  alternatives(token: string): Array<string> {
    const query = normalizeToken(token)
    const distance = fuzzyDistance(query)
    if (!distance) return []
    const matches: Array<VocabularyTerm> = []
    for (
      let length = query.length - distance;
      length <= query.length + distance;
      length++
    ) {
      for (const candidate of this.#byLength.get(length) ?? []) {
        if (candidate.term.startsWith(query)) continue
        if (withinDistance(query, candidate.term, distance))
          matches.push(candidate)
      }
    }
    matches.sort((a, b) => b.count - a.count)
    return matches.slice(0, maxAlternatives).map(match => match.term)
  }
}
