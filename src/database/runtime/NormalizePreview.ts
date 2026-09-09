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
import {and, asc, eq, inArray, or, sql, type Database} from 'rado'
import {
  EntryIndexTable,
  EntryDataTable,
  entryIndexRow,
  entrySource
} from '../entry/Schema.js'
import {SourceRecordTable} from './NormalizeSource.js'
import type {EntryReplacement} from './EntryRuntime.js'

/** Existing-identity preview normalization. The caller owns a consistent
 * trusted checkpoint read. Only ancestors and the edited identity's versions
 * are reconstructed. Existing data edits cannot alter physical parent paths or
 * inherited status, so descendant payloads are not needed either. Adding a new
 * authored version also reconstructs descendants whose visibility may change.
 */
export async function normalizeEntryPreview(
  config: Config,
  db: Database,
  preview: Entry
) {
  const filePath = sql<string>`json_extract(${EntryDataTable.source}, '$.filePath')`
  const fileHash = sql<string>`json_extract(${EntryDataTable.source}, '$.fileHash')`
  if (!preview.filePath.endsWith('.json'))
    throw new Error('Invalid preview source path')
  const [path] = entryInfo(basename(preview.filePath, '.json'))
  const childrenDir = join(dirname(preview.filePath), path)
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
  const target =
    found?.entry ??
    (
      await selectTarget()
        .where(
          and(
            eq(EntryIndexTable.id, preview.id),
            eq(
              sql<string>`json_extract(${EntryDataTable.source}, '$.childrenDir')`,
              childrenDir
            )
          )
        )
        .get()
    )?.entry
  if (!target)
    throw new Error('Preview source version is not in this checkpoint')
  if (!config.schema[preview.type])
    throw new Error(`Unknown preview type: ${preview.type}`)
  const related = inArray(EntryIndexTable.id, [target.id, ...target.parents])
  const descendants = sql<boolean>`${EntryIndexTable.id} in (
    with recursive affected(id) as (
      select ${target.id} union
      select child.id from alinea_entry_index as child join affected on child.parentId = affected.id
    ) select id from affected
  )`
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
  for (const entry of graph.filter({includeHiddenVersions: true})) {
    const before = previous.get(entry.filePath)
    if (!before?.entry && entry.filePath !== preview.filePath)
      throw new Error('Unexpected version in preview normalization')
    const ordinal =
      before?.entry?.ordinal ??
      Math.max(
        ...rows
          .filter(
            row =>
              row.entry?.id === entry.id &&
              row.entry.locale === (entry.locale?.toLowerCase() ?? null)
          )
          .map(row => row.entry!.ordinal)
      ) + 1
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
