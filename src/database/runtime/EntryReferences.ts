import type {Config} from '#/core/Config.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult,
  EntryReferenceTarget
} from '#/core/db/EntryReference.js'
import {Type} from '#/core/Type.js'
import {
  and,
  asc,
  count,
  eq,
  index,
  isNull,
  primaryKey,
  table,
  type Database
} from 'rado'
import * as column from 'rado/universal/columns'
import {EntryIndexTable, entryIndexRow} from '../entry/Schema.js'
import type {EntryReplacement} from './EntryRuntime.js'

/** Private checkpoint references, never a permission-filtered browser manifest. */
export const EntryReferenceTable = table(
  'alinea_entry_reference',
  {
    versionId: column.varchar(undefined, {length: 255}).notNull(),
    ordinal: column.integer().notNull(),
    targetId: column.varchar(undefined, {length: 128}).notNull(),
    filePath: column.text().notNull(),
    target: column.json<EntryReferenceTarget>().notNull()
  },
  row => ({
    primary: primaryKey(row.versionId, row.ordinal),
    byTarget: index().on(row.targetId)
  })
)

/** Called inside the same transaction as source/index/payload replacement. */
export async function replaceEntryReferences(
  config: Config,
  db: Database,
  replacement: EntryReplacement
): Promise<void> {
  const row = entryIndexRow(replacement.entry)
  const filePath = replacement.source?.filePath
  if (!replacement.data || !filePath)
    throw new Error('Reference indexing requires a complete entry payload')
  await db
    .delete(EntryReferenceTable)
    .where(eq(EntryReferenceTable.versionId, row.versionId))
  const type = config.schema[row.type]
  const targets = type ? Type.references(type, replacement.data) : []
  for (let offset = 0; offset < targets.length; offset += 100)
    await db.insert(EntryReferenceTable).values(
      targets.slice(offset, offset + 100).map((target, ordinal) => ({
        versionId: row.versionId,
        ordinal: offset + ordinal,
        targetId: target.targetId,
        filePath,
        target
      }))
    )
}

/** Complete trusted checkpoint lookup. Browser coverage/permissions need a
 * separate reference manifest before this can become a browser capability.
 */
export async function entryReferencesTo(
  db: Database,
  query: EntryReferenceQuery
): Promise<EntryReferenceResult> {
  const entry = EntryIndexTable
  const reference = EntryReferenceTable
  const status = query.status ?? 'published'
  const conditions = [
    eq(entry.visible, true),
    eq(reference.targetId, query.targetId)
  ]
  if (query.locale !== undefined)
    conditions.push(
      query.locale === null
        ? isNull(entry.locale)
        : eq(entry.locale, query.locale)
    )
  if (status === 'preferDraft') conditions.push(eq(entry.active, true))
  else if (status === 'preferPublished') conditions.push(eq(entry.main, true))
  else if (status !== 'all') conditions.push(eq(entry.status, status))
  const rows = await db
    .select({
      target: reference.target,
      sourceFilePath: reference.filePath,
      sourceId: entry.id,
      sourceType: entry.type,
      sourceLocale: entry.locale,
      sourceStatus: entry.status,
      sourceActive: entry.active,
      sourceMain: entry.main
    })
    .from(reference)
    .innerJoin(entry, eq(entry.versionId, reference.versionId))
    .where(and(...conditions))
    .orderBy(asc(entry.ordinal), asc(reference.ordinal))
  const scanned =
    (await db
      .select(count())
      .from(entry)
      .where(eq(entry.visible, true))
      .get()) ?? 0
  return {
    references: rows.map(({target, ...source}) => ({...target, ...source})),
    total: rows.length,
    scan: {scanned, total: scanned, complete: true}
  }
}
