import type {Config} from '#/core/Config.js'
import type {
  EntryReference,
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {getScope} from '#/core/Scope.js'
import {Type} from '#/core/Type.js'
import {and, asc, eq, inArray, type Database} from 'rado'
import {entryDataText} from '../entry/EntryData.js'
import {
  EntryIndexTable,
  EntryReferenceTable,
  storedEntryData
} from '../entry/EntryTable.js'
import {localeCondition, statusCondition} from './EntryQuery.js'

/** Read the versions indexed as referencing the target and walk their data. */
export async function queryEntryReferences(
  config: Config,
  db: Database,
  query: EntryReferenceQuery
): Promise<EntryReferenceResult> {
  const entry = EntryIndexTable
  const indexed = EntryReferenceTable
  const conditions = [
    eq(entry.visible, true),
    statusCondition(entry, query.status),
    inArray(
      entry.rowid,
      db
        .select(indexed.source)
        .from(indexed)
        .where(eq(indexed.targetId, query.targetId))
    )
  ]
  if (query.locale !== undefined)
    conditions.push(localeCondition(getScope(config), entry, query.locale))
  const rows = await db
    .select({
      id: entry.id,
      filePath: entry.filePath,
      type: entry.type,
      locale: entry.locale,
      status: entry.status,
      active: entry.active,
      main: entry.main,
      path: entry.path,
      data: entryDataText(entry)
    })
    .from(entry)
    .where(and(...conditions))
    .orderBy(asc(entry.versionId))
  const references: Array<EntryReference> = []
  for (const row of rows) {
    const type = config.schema[row.type]
    if (!type) continue
    // The index finds the rows, the walk finds the fields holding the target.
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
  return {references, total: references.length}
}
