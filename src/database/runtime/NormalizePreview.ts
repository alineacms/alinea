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
import {basename} from '#/core/util/Paths.js'
import {and, eq, inArray, sql, type Database} from 'rado'
import {
  EntryIndexTable,
  EntryDataTable,
  entryIndexRow,
  entrySource
} from '../entry/Schema.js'
import {SourceRecordTable} from './NormalizeSource.js'
import type {EntryReplacement} from './EntryRuntime.js'

/** Existing-entry data preview normalization. The caller owns a consistent
 * trusted checkpoint read. Only ancestors and the edited identity's versions
 * are reconstructed. Existing data edits cannot alter physical parent paths or
 * inherited status, so descendant payloads are not needed either.
 */
export async function normalizeEntryPreview(
  config: Config,
  db: Database,
  preview: Entry
) {
  const filePath = sql<string>`json_extract(${EntryDataTable.source}, '$.filePath')`
  const fileHash = sql<string>`json_extract(${EntryDataTable.source}, '$.fileHash')`
  const found = await db
    .select({entry: EntryIndexTable})
    .from(EntryIndexTable)
    .innerJoin(
      EntryDataTable,
      eq(EntryDataTable.versionId, EntryIndexTable.versionId)
    )
    .where(
      and(eq(EntryIndexTable.id, preview.id), eq(filePath, preview.filePath))
    )
    .get()
  const target = found?.entry
  if (!target)
    throw new Error('Preview source version is not in this checkpoint')
  if (target.type !== preview.type || target.index !== preview.index)
    throw new Error(
      `Structural preview changes require their dedicated normalization stage (${target.type}/${target.index} → ${preview.type}/${preview.index})`
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
    .where(inArray(EntryIndexTable.id, [target.id, ...target.parents]))
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
    if (!before?.entry)
      throw new Error('Unexpected version in preview normalization')
    const source = entrySource(entry)
    const [, versionStatus] = entryInfo(basename(entry.filePath, '.json'))
    const indexed = {
      ...entry,
      versionStatus,
      ordinal: before.entry.ordinal,
      visible: visible.has(entry.filePath)
    }
    const payloadId = await hashBlob(
      new TextEncoder().encode(JSON.stringify({data: entry.data, source}))
    )
    if (
      payloadId === before.payloadId &&
      JSON.stringify(entryIndexRow(indexed)) === JSON.stringify(before.entry)
    )
      continue
    entries.push({entry: indexed, payloadId, data: entry.data, source})
  }
  return {entries, scanned: rows.length}
}
