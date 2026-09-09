import type {Config} from '#/core/Config.js'
import type {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {
  EntryGraph,
  VersionParser,
  type EntryVersionData
} from '#/core/db/EntryIndex.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {entryInfo} from '#/core/util/EntryFilenames.js'
import {basename, dirname, join} from '#/core/util/Paths.js'
import {asc, eq, inArray, max, or, sql, type Database} from 'rado'
import {
  EntryIndexTable,
  EntryDataTable,
  entryOrdinalStep,
  entryIndexRow,
  entrySource
} from '../entry/Schema.js'
import {SourceRecordTable} from './NormalizeSource.js'
import type {EntryReplacement} from './EntryRuntime.js'

/** Request-local preview normalization. The caller owns a consistent
 * trusted checkpoint read. Only ancestors and the edited identity's versions
 * are reconstructed. Existing data edits cannot alter physical parent paths or
 * inherited status, so descendant payloads are not needed either. Adding a new
 * authored version also reconstructs descendants whose visibility may change.
 * A new identity includes its physical subtree, adopting previously orphaned
 * descendants without loading unrelated payloads.
 */
export async function normalizeEntryPreview(
  config: Config,
  db: Database,
  preview: Entry
) {
  const filePath = sql<string>`json_extract(${EntryDataTable.source}, '$.filePath')`
  const fileHash = sql<string>`json_extract(${EntryDataTable.source}, '$.fileHash')`
  if (
    !preview.filePath.endsWith('.json') ||
    preview.filePath.includes('\\') ||
    preview.filePath.includes('\0') ||
    preview.filePath
      .split('/')
      .some(part => !part || part === '.' || part === '..')
  )
    throw new Error('Invalid preview source path')
  const [path] = entryInfo(basename(preview.filePath, '.json'))
  if (!path) throw new Error('Invalid preview source path')
  const childrenDir = join(dirname(preview.filePath), path)
  const storedDir = sql<string>`json_extract(${EntryDataTable.source}, '$.childrenDir')`
  const selectTarget = () =>
    db
      .select({entry: EntryIndexTable})
      .from(EntryIndexTable)
      .innerJoin(
        EntryDataTable,
        eq(EntryDataTable.versionId, EntryIndexTable.versionId)
      )
  const found = await selectTarget().where(eq(filePath, preview.filePath)).get()
  if (found?.entry && found.entry.id !== preview.id)
    throw new Error('Preview source path belongs to another entry')
  const isNew = !found?.entry
  const owner = (await selectTarget().where(eq(storedDir, childrenDir)).get())
    ?.entry
  if (owner && owner.id !== preview.id)
    throw new Error('Preview source directory belongs to another entry')
  const target =
    found?.entry ??
    owner ??
    (await selectTarget().where(eq(EntryIndexTable.id, preview.id)).get())
      ?.entry
  if (!config.schema[preview.type])
    throw new Error(`Unknown preview type: ${preview.type}`)
  const parent = isNew
    ? (
        await selectTarget()
          .where(eq(storedDir, dirname(preview.filePath)))
          .get()
      )?.entry
    : undefined
  const related = inArray(EntryIndexTable.id, [
    ...new Set([
      ...(target ? [target.id, ...target.parents] : []),
      ...(parent ? [parent.id, ...parent.parents] : [])
    ])
  ])
  const prefix = `${childrenDir}/`
  const descendants = or(
    target
      ? sql<boolean>`${EntryIndexTable.id} in (
    with recursive affected(id) as (
      select ${target.id} union
      select child.id from alinea_entry_index as child join affected on child.parentId = affected.id
    ) select id from affected
  )`
      : sql.value(false),
    sql<boolean>`${EntryIndexTable.id} in (
    select indexed.id from alinea_entry_index as indexed
    join alinea_entry_data as data on data.versionId = indexed.versionId
    where substr(json_extract(data.source, '$.childrenDir'), 1, ${prefix.length}) = ${prefix}
  )`
  )
  const rows = await db
    .select({
      entry: EntryIndexTable,
      filePath,
      record: SourceRecordTable.record,
      payloadId: EntryDataTable.payloadId
    })
    .from(EntryIndexTable)
    .leftJoin(
      EntryDataTable,
      eq(EntryDataTable.versionId, EntryIndexTable.versionId)
    )
    .leftJoin(SourceRecordTable, eq(SourceRecordTable.sha, fileHash))
    .where(isNew ? or(related, descendants) : related)
    .orderBy(asc(EntryIndexTable.ordinal))
  const versions = new Map<string, EntryVersionData>()
  const previous = new Map(rows.map(row => [row.filePath, row]))
  for (const row of rows) {
    if (!row.record || !row.filePath)
      throw new Error(`Missing preview source record: ${row.filePath}`)
    versions.set(row.filePath, row.record)
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify(createRecord(preview, preview.status), null, 2)
  )
  versions.set(
    preview.filePath,
    new VersionParser().parse(preview.fileHash, bytes)
  )
  const graph = EntryGraph.fromParsed(config, versions)
  const visible = new Set(Array.from(graph.filter({}), entry => entry.filePath))
  const entries: Array<EntryReplacement> = []
  const newOrdinal = !target
    ? ((await db
        .select(max(EntryIndexTable.ordinal))
        .from(EntryIndexTable)
        .get()) ?? -entryOrdinalStep) + entryOrdinalStep
    : undefined
  for (const entry of graph.filter({includeHiddenVersions: true})) {
    const before = previous.get(entry.filePath)
    if (!before?.entry && entry.filePath !== preview.filePath)
      throw new Error('Unexpected version in preview normalization')
    let ordinal = before?.entry?.ordinal ?? newOrdinal
    if (ordinal === undefined) {
      const identityRows = rows.filter(row => row.entry?.id === entry.id)
      const localeRows = identityRows.filter(
        row => row.entry?.locale === (entry.locale?.toLowerCase() ?? null)
      )
      ordinal =
        Math.max(
          ...(localeRows.length ? localeRows : identityRows).map(
            row => row.entry!.ordinal
          )
        ) + 1
    }
    if (!Number.isSafeInteger(ordinal))
      throw new Error('Missing preview ordering slot')
    const source = entrySource(entry)
    const [, versionStatus] = entryInfo(basename(entry.filePath, '.json'))
    const indexed = {
      ...entry,
      versionStatus,
      ordinal,
      visible: visible.has(entry.filePath)
    }
    const payloadId = await hashBlob(
      new TextEncoder().encode(JSON.stringify({data: entry.data, source}))
    )
    if (
      payloadId === before?.payloadId &&
      JSON.stringify(entryIndexRow(indexed)) === JSON.stringify(before?.entry)
    )
      continue
    entries.push({entry: indexed, payloadId, data: entry.data, source})
  }
  return {entries, scanned: rows.length}
}
