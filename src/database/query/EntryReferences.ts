import type {Config} from '#/core/Config.js'
import type {
  EntryReference,
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {Type} from '#/core/Type.js'
import {and, asc, eq, gt, isNull, sql, type Database} from 'rado'
import {storedEntryData, type EntryIndexTarget} from '../entry/Schema.js'

/** Scan references in bounded pages on the caller's active transaction. */
export async function queryEntryReferences(
  config: Config,
  db: Database,
  entry: EntryIndexTarget,
  query: EntryReferenceQuery
): Promise<EntryReferenceResult> {
  const status = query.status ?? 'published'
  const conditions = [eq(entry.visible, true)]
  if (query.locale !== undefined)
    conditions.push(
      query.locale === null
        ? isNull(entry.locale)
        : eq(sql`${entry.locale} collate nocase`, query.locale)
    )
  if (status === 'preferDraft') conditions.push(eq(entry.active, true))
  else if (status === 'preferPublished') conditions.push(eq(entry.main, true))
  else if (status !== 'all') conditions.push(eq(entry.status, status))

  const references: Array<EntryReference> = []
  const pageSize = 500
  let cursor = ''
  let scanned = 0
  while (true) {
    const rows = await db
      .select({
        versionId: entry.versionId,
        id: entry.id,
        filePath: entry.filePath,
        type: entry.type,
        locale: entry.locale,
        status: entry.status,
        active: entry.active,
        main: entry.main,
        path: entry.path,
        data: entry.data
      })
      .from(entry)
      .where(and(...conditions, gt(entry.versionId, cursor)))
      .orderBy(asc(entry.versionId))
      .limit(pageSize)
      .all()
    if (!rows.length) break
    for (const row of rows) {
      scanned += 1
      const type = config.schema[row.type]
      if (!type) continue
      for (const target of Type.references(
        type,
        storedEntryData(row.data, row.path)
      )) {
        if (target.targetId !== query.targetId) continue
        references.push({
          ...target,
          sourceId: row.id,
          sourceFilePath: row.filePath,
          sourceType: row.type,
          sourceLocale: row.locale,
          sourceStatus: row.status,
          sourceActive: row.active,
          sourceMain: row.main
        })
      }
    }
    cursor = rows.at(-1)!.versionId
    if (rows.length < pageSize) break
  }
  return {
    references,
    total: references.length,
    scan: {scanned, total: scanned, complete: true}
  }
}
