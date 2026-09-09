import {and, eq, exists, inArray, sql, table, when, type Database} from 'rado'
import * as column from 'rado/universal/columns'
import {EntryIndexTable} from '../entry/Schema.js'
import {mergedFtsMatches} from './MergedFts.js'
import {searchQuery, searchTokens, type SearchQuery} from './Search.js'

const Matches = table('alinea_overlay_search', {
  queryId: column.integer().notNull(),
  versionId: column.text().notNull(),
  origin: column.text().notNull(),
  documentId: column.integer().notNull(),
  rank: column.number().notNull()
})

/** Search plans live as long as one immutable request-local overlay. Prepare
 * under EntryRuntime's queue; cached rows never change while queries use them.
 */
export function overlaySearch(db: Database) {
  const plans = new Map<string, SearchQuery>()
  let ready = false
  let nextId = 0
  return async function prepare(input: string | Array<string> | undefined) {
    const tokens = searchTokens(input)
    if (!tokens?.length) return searchQuery(input)
    const key = JSON.stringify(tokens)
    const cached = plans.get(key)
    if (cached) return cached
    if (!ready) {
      await db.create(Matches)
      await db.run(sql`create unique index alinea_overlay_search_identity
        on alinea_overlay_search(queryId, versionId)`)
      ready = true
    }
    const excluded = await db
      .select(sql<number>`base.rowid`)
      .from(sql`alinea_base.alinea_entry_data as base`)
      .innerJoin(
        sql`main.alinea_overlay_mask as mask`,
        sql`mask.versionId = base.versionId`
      )
    const hits = await mergedFtsMatches(db, tokens, excluded)
    const queryId = nextId++
    for (const origin of ['main', 'alinea_base'] as const) {
      const scores = new Map(
        hits
          .filter(hit => hit.schema === origin)
          .map(hit => [hit.rowid, hit.rank])
      )
      const ids = [...scores.keys()]
      for (let offset = 0; offset < ids.length; offset += 100) {
        const rows = await db
          .select({
            versionId: sql<string>`versionId`,
            documentId: sql<number>`rowid`
          })
          .from(sql`${sql.identifier(origin)}.alinea_entry_data`)
          .where(inArray(sql`rowid`, ids.slice(offset, offset + 100)))
        if (rows.length !== Math.min(100, ids.length - offset))
          throw new Error('Overlay search document has no payload identity')
        await db.insert(Matches).values(
          rows.map(row => ({
            ...row,
            queryId,
            origin,
            rank: scores.get(row.documentId)!
          }))
        )
      }
    }
    const identity = and(
      eq(Matches.queryId, queryId),
      eq(Matches.versionId, EntryIndexTable.versionId)
    )
    const terms = tokens.map(term => `"${term}"*`).join(' AND ')
    const plan: SearchQuery = {
      needsPayloads: false,
      condition: exists(db.select(sql.value(1)).from(Matches).where(identity)),
      rank: sql`(${db.select(Matches.rank).from(Matches).where(identity)})`,
      snippet(start, end, cutOff, limit) {
        const from = (schema: string) => sql<string>`(
          select snippet(alinea_entry_search, 1, ${start}, ${end}, ${cutOff}, ${limit})
          from ${sql.identifier(schema)}.alinea_entry_search
          where rowid = ${Matches.documentId} and alinea_entry_search match ${terms}
        )`
        const value = when(
          [eq(Matches.origin, 'main'), from('main')],
          from('alinea_base')
        )
        return sql`(${db.select(value).from(Matches).where(identity)})`
      }
    }
    plans.set(key, plan)
    return plan
  }
}
