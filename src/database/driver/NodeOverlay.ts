import type {Config} from '#/core/Config.js'
import {Graph, type AnyQueryResult, type GraphQuery} from '#/core/Graph.js'
import {randomUUID} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {pathToFileURL} from 'node:url'
import {eq, sql, type Database, type HasSql} from 'rado'
import {entryIndexRow, EntryIndexTable} from '../entry/Schema.js'
import {searchQuery, searchTokens, type SearchQuery} from '../query/Search.js'
import {openCheckpoint, type CheckpointIdentity} from '../runtime/Checkpoint.js'
import {EntryRuntime, type EntryReplacement} from '../runtime/EntryRuntime.js'
import {SqlSource} from '../source/SqlSource.js'
import {nodeDatabase} from './NodeDatabase.js'

/** Request-local replacement rows over an attached immutable checkpoint. Normal
 * queries copy no base rows. A search lazily builds one ordinary temporary FTS5
 * index from the effective view instead of maintaining a second ranking engine.
 */
export class NodeOverlay extends Graph {
  #sqlite: DatabaseSync
  #runtime: EntryRuntime
  #closed = false
  #readers = 0

  private constructor(sqlite: DatabaseSync, runtime: EntryRuntime) {
    super()
    this.#sqlite = sqlite
    this.#runtime = runtime
  }

  get config(): Config {
    return this.#runtime.config
  }

  static async open(
    config: Config,
    file: string,
    identity: CheckpointIdentity,
    entries: ReadonlyArray<EntryReplacement>,
    removedVersionIds: ReadonlyArray<string> = []
  ): Promise<NodeOverlay> {
    const sqlite = new DatabaseSync(':memory:')
    try {
      const db = nodeDatabase(sqlite)
      const uri = pathToFileURL(file)
      uri.searchParams.set('mode', 'ro')
      uri.searchParams.set('immutable', '1')
      await db.run(sql`attach database ${uri.href} as alinea_base`)
      const {descriptor} = await openCheckpoint(config, db, identity)
      const tree = await new SqlSource(db, identity.namespace).getSqlTree()
      for (const entry of entries)
        if (!entry.data || !entry.payloadId || !entry.source)
          throw new Error('Overlay replacements require complete payloads')
      const removed = new Set(removedVersionIds)
      if (entries.some(row => removed.has(entryIndexRow(row.entry).versionId)))
        throw new Error('Overlay cannot replace and remove the same version')
      await EntryRuntime.createSchema(db, descriptor.sourceSha)
      await db.run(
        sql`create table alinea_overlay_mask (versionId text primary key)`
      )
      const mask = [
        ...new Set([
          ...removedVersionIds,
          ...entries.map(row => entryIndexRow(row.entry).versionId)
        ])
      ]
      for (const versionId of mask)
        await db.run(sql`insert into alinea_overlay_mask values (${versionId})`)
      const runtime = new EntryRuntime(config, db, {
        search: previewSearch(db),
        async includedAtBuild(path) {
          return Boolean(await tree.get(path))
        }
      })
      await runtime.apply({
        fromRevision: descriptor.sourceSha,
        toRevision: `overlay:${randomUUID()}`,
        entries
      })
      // TEMP names shadow main and attached tables for all nested queries.
      for (const name of [
        'alinea_entry_index',
        'alinea_entry_data',
        'alinea_entry_payload'
      ]) {
        const table = sql.identifier(name)
        await db.run(sql`create temp view ${table} as
          select * from main.${table}
          union all select * from alinea_base.${table} as base
          where not exists (select 1 from main.alinea_overlay_mask as mask where mask.versionId = base.versionId)`)
      }
      return new NodeOverlay(sqlite, runtime)
    } catch (error) {
      sqlite.close()
      throw error
    }
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (this.#closed) throw new Error('SQLite overlay is closed')
    this.#readers++
    try {
      return await this.#runtime.resolve(query)
    } finally {
      if (--this.#readers === 0 && this.#closed) this.#sqlite.close()
    }
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    if (!this.#readers) this.#sqlite.close()
  }
}

function previewSearch(db: Database) {
  let ready: Promise<void> | undefined
  return async function prepare(
    input: string | Array<string> | undefined
  ): Promise<SearchQuery | undefined> {
    const tokens = searchTokens(input)
    if (!tokens?.length) return searchQuery(input)
    ready ??= createPreviewSearch(db)
    await ready
    const terms = tokens.map(term => `"${term}"*`).join(' AND ')
    const match = sql`alinea_preview_search match ${terms}`
    const identity = eq(
      sql`alinea_preview_search.versionId`,
      EntryIndexTable.versionId
    )
    return {
      needsPayloads: false,
      condition: sql`exists (
        select 1 from alinea_preview_search where ${identity} and ${match}
      )`,
      rank: sql`(
        select bm25(alinea_preview_search, 0, 20, 1)
        from alinea_preview_search where ${identity} and ${match}
      )`,
      snippet(start: HasSql, end: HasSql, cutOff: HasSql, limit: HasSql) {
        return sql`(
          select snippet(alinea_preview_search, 2, ${start}, ${end}, ${cutOff}, ${limit})
          from alinea_preview_search where ${identity} and ${match}
        )`
      }
    }
  }
}

async function createPreviewSearch(db: Database): Promise<void> {
  await db.run(sql`create virtual table temp.alinea_preview_search using fts5(
    versionId unindexed, title, body, tokenize='unicode61 remove_diacritics 2'
  )`)
  await db.run(sql`insert into temp.alinea_preview_search(versionId, title, body)
    select entry.versionId, entry.title,
      coalesce(json_extract(data.source, '$.searchableText'), '')
    from alinea_entry_index as entry
    inner join alinea_entry_data as data on data.versionId = entry.versionId`)
}
