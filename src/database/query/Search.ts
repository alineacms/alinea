import {getTable, sql, table, type Database, type HasSql, type Sql} from 'rado'
import * as column from 'rado/universal/columns'
import type {EntryIndexTarget} from '../entry/EntryTable.js'

/**
 * The FTS5 index of the entry table. Sync writes a row for every entry version
 * under the rowid of its entry row; the body is the version's searchable text.
 */
const EntrySearchColumns = {
  rowid: column.integer().primaryKey(),
  title: column.text().notNull(),
  body: column.text().notNull()
}

export const EntrySearchTable = table('alinea_entry_search', EntrySearchColumns)

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

export async function createSearch(db: Database): Promise<void> {
  const target = sql.identifier(getTable(EntrySearchTable).name)
  await db.run(sql`create virtual table if not exists ${target} using fts5(
    title, body, tokenize='unicode61 remove_diacritics 2'
  )`)
}

/** The searchable text of an entry row, read from its search row. */
export function searchableText(entry: EntryIndexTarget): Sql<string> {
  const search = EntrySearchTable
  return sql<string>`(select ${search.body} from ${search}
    where ${search.rowid} = ${entry.rowid})`
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
  const search = sql.identifier(getTable(EntrySearchTable).name)
  const match = sql`${search} match ${terms}`
  const relevance = sql<number>`bm25(${search}, 20, 1)`
  const titlePrefix = tokens.length
    ? sql<number>`case
        when instr(lower(trim(${entry.title})), ${tokens[0]!.toLowerCase()}) = 1
        then -1000000 else 0 end`
    : sql.value(0)
  return {
    target: search,
    identity: sql<boolean>`${search}.rowid = ${entry.rowid}`,
    condition: tokens.length ? sql<boolean>`${match}` : sql.value(false),
    rank: tokens.length
      ? sql<number>`${titlePrefix} + ${relevance}`
      : sql.value(0),
    snippet(start: HasSql, end: HasSql, cutOff: HasSql, limit: HasSql) {
      return tokens.length
        ? sql<string>`snippet(${search}, 1, ${start}, ${end}, ${cutOff}, ${limit})`
        : sql.value('')
    }
  }
}

/** The edit distance allowed per character of a term. */
const fuzzyFactor = 0.1
const maxFuzzyDistance = 6
const maxAlternatives = 10
const maxNumberMatches = 50
const vocabulary = 'alinea_entry_search_vocab'

/** The edits a token may be away from an indexed term: none below five
 * characters, one up to fourteen, then one more per ten. */
export function fuzzyDistance(token: string): number {
  return Math.min(maxFuzzyDistance, Math.round(token.length * fuzzyFactor))
}

/** The digits of a number without its leading zeros, undefined for tokens
 * that are not a number or are all zeros. */
function significantDigits(token: string): string | undefined {
  if (!/^[0-9]+$/.test(token)) return undefined
  return token.replace(/^0+/, '') || undefined
}

/** Whether a token needs the vocabulary: a number matches indexed terms
 * with leading zeros or letters in front, a longer token close spellings. */
export function expandsToken(token: string): boolean {
  return fuzzyDistance(token) > 0 || significantDigits(token) !== undefined
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
 * The terms of the search index, loaded once per database revision. Query tokens
 * expand to indexed terms within a small edit distance, so a typo still
 * finds the entry.
 */
export class SearchVocabulary {
  #loaded: string | undefined
  #byLength = new Map<number, Array<VocabularyTerm>>()
  #numbered: Array<VocabularyTerm> = []

  async load(db: Database, revision: string): Promise<void> {
    if (this.#loaded === revision) return
    // Module arguments cannot be bound.
    await db.run(
      sql.unsafe(
        `create virtual table if not exists temp.${vocabulary}
         using fts5vocab('main', '${getTable(EntrySearchTable).name}', 'row')`
      )
    )
    const rows = await db.all<{term: string; cnt: number}>(
      sql`select term, cnt from temp.${sql.identifier(vocabulary)}`
    )
    const byLength = new Map<number, Array<VocabularyTerm>>()
    const numbered: Array<VocabularyTerm> = []
    for (const row of rows) {
      const term = {term: row.term, count: row.cnt}
      const terms = byLength.get(row.term.length) ?? []
      terms.push(term)
      byLength.set(row.term.length, terms)
      if (/[0-9]/.test(row.term)) numbered.push(term)
    }
    this.#byLength = byLength
    this.#numbered = numbered
    this.#loaded = revision
  }

  /** Indexed terms close to a token, most frequent first; prefixes of the
   * token are left to the prefix match. */
  alternatives(token: string): Array<string> {
    const query = normalizeToken(token)
    return [...this.#numberMatches(query), ...this.#closeSpellings(query)]
  }

  /** Indexed terms containing a number that starts with the digits of a
   * number token, ignoring leading zeros: 98 finds 098 and img098. */
  #numberMatches(query: string): Array<string> {
    const digits = significantDigits(query)
    if (!digits) return []
    const matches = this.#numbered.filter(
      candidate =>
        !candidate.term.startsWith(query) &&
        candidate.term
          .match(/[0-9]+/g)!
          .some(run => run.replace(/^0+/, '').startsWith(digits))
    )
    matches.sort((a, b) => b.count - a.count)
    return matches.slice(0, maxNumberMatches).map(match => match.term)
  }

  #closeSpellings(query: string): Array<string> {
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
