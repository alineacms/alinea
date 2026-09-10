import type {Config} from '#/core/Config.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult,
  EntryReferenceTarget
} from '#/core/db/EntryReference.js'
import {Type} from '#/core/Type.js'
import {Permission} from '#/core/Role.js'
import type {AuthorizedEntry} from '../handler/Policy.js'
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

/** Trusted checkpoint lookup, optionally restricted to a freshly compiled view.
 * Browser callers must bind that view and this query to the same read lease.
 */
export async function entryReferencesTo(
  db: Database,
  query: EntryReferenceQuery,
  authorized?: ReadonlyArray<AuthorizedEntry>
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
      versionId: entry.versionId,
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
    .orderBy(asc(entry.index), asc(entry.ordinal), asc(reference.ordinal))
  const readable =
    authorized &&
    new Map(
      authorized
        .filter(row => Boolean(row.permissions & Permission.Read))
        .map(row => [entryIndexRow(row.entry).versionId, row])
    )
  const permitted = rows.filter(row => {
    if (!readable) return true
    const source = readable.get(row.versionId)
    if (!source) return false
    // A dotted field name can overlap a nested field path. Fail closed when the
    // serialized path cannot identify one unambiguous top-level field.
    const fields = Object.keys(source.fields).filter(
      field =>
        row.target.fieldPath === field ||
        row.target.fieldPath.startsWith(`${field}.`)
    )
    return (
      fields.length === 1 && Boolean(source.fields[fields[0]] & Permission.Read)
    )
  })
  const scanned = readable
    ? readable.size
    : ((await db
        .select(count())
        .from(entry)
        .where(eq(entry.visible, true))
        .get()) ?? 0)
  return {
    references: permitted.map(({target, versionId: _, ...source}) => ({
      ...target,
      ...source
    })),
    total: permitted.length,
    scan: {scanned, total: scanned, complete: true}
  }
}
