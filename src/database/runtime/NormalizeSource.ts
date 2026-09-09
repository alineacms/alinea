import type {Config} from '#/core/Config.js'
import {
  EntryGraph,
  VersionParser,
  type EntryVersionData
} from '#/core/db/EntryIndex.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {entryInfo} from '#/core/util/EntryFilenames.js'
import {basename} from '#/core/util/Paths.js'
import {inArray, table, type Database} from 'rado'
import * as column from 'rado/universal/columns'
import {entrySource} from '../entry/Schema.js'
import type {SqlSource} from '../source/SqlSource.js'
import type {EntryReplacement} from './EntryRuntime.js'

/** Trusted parsed authored versions, including versions hidden by inheritance.
 * Configuration/schema identity is validated at the checkpoint boundary.
 */
export const SourceRecordTable = table('alinea_source_record', {
  sha: column.varchar(undefined, {length: 40}).primaryKey(),
  record: column.json<EntryVersionData>().notNull()
})

/** Transient normalizer: reuse parsed records, never make the JS graph authoritative. */
export async function normalizeSource(
  config: Config,
  db: Database,
  source: SqlSource
) {
  const tree = await source.getTree()
  const files = [...tree].filter(([, node]) => node.type !== 'tree')
  const shas = [...new Set(files.map(([, node]) => node.sha))]
  const parser = new VersionParser()
  let parsed = 0
  for (let offset = 0; offset < shas.length; offset += 100) {
    const batch = shas.slice(offset, offset + 100)
    for (const row of await db
      .select()
      .from(SourceRecordTable)
      .where(inArray(SourceRecordTable.sha, batch)))
      parser.set(row.sha, row.record)
    const missing = batch.filter(sha => !parser.has(sha))
    if (!missing.length) continue
    for await (const [sha, bytes] of source.getBlobs(missing)) {
      const record = parser.parse(sha, bytes)
      await db.insert(SourceRecordTable).values({sha, record})
      parsed++
    }
  }
  const versions = new Map<string, EntryVersionData>()
  for (const [path, node] of files) {
    const record = parser.get(node.sha)
    if (!record) throw new Error(`Missing parsed source record: ${path}`)
    versions.set(path, record)
  }
  const graph = EntryGraph.fromParsed(config, versions)
  const entries: Array<EntryReplacement> = []
  const visible = new Set(Array.from(graph.filter({}), entry => entry.filePath))
  for (const entry of graph.filter({includeHiddenVersions: true})) {
    const source = entrySource(entry)
    const [, versionStatus] = entryInfo(basename(entry.filePath, '.json'))
    const payloadId = await hashBlob(
      new TextEncoder().encode(JSON.stringify({data: entry.data, source}))
    )
    entries.push({
      entry: {
        ...entry,
        versionStatus,
        ordinal: entries.length,
        visible: visible.has(entry.filePath)
      },
      payloadId,
      data: entry.data,
      source
    })
  }
  return {entries, parsed, revision: tree.sha}
}
