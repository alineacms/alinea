import type {Config} from '#/core/Config.js'
import type {FileStat} from '#/core/source/FSSource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {TaskQueue} from '#/core/util/Async.js'
import {eq, sql, type Database} from 'rado'
import {
  DatabaseMetadataTable,
  DatabaseStateTable,
  SourceFileTable
} from './DatabaseTables.js'
import {hasJsonbRows, supportsJsonb} from './entry/EntryData.js'
import {EntryIndexTable} from './entry/EntryTable.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {
  EntryLayer,
  type EntryDatabaseOptions,
  type EntrySyncResult
} from './EntryLayer.js'
import {createSearch, EntrySearchTable} from './query/Search.js'
import {EntrySyncer, EntrySyncRoot} from './sync/EntrySyncer.js'
import {sqliteBatchSize} from './sync/SyncQueries.js'
import {databaseVersion} from './Version.js'

const defaultConfigFingerprint = 'runtime'

/** A queryable entry database owning its SQLite connection. */
export class EntryDatabase extends EntryLayer {
  #db: Database
  #syncer: EntrySyncer

  constructor(
    config: Config,
    db: Database,
    options: EntryDatabaseOptions = {}
  ) {
    const syncer = new EntrySyncer(config, db)
    super(config, options, {
      db,
      queue: new TaskQueue(),
      syncer,
      target: EntrySyncRoot
    })
    this.#db = db
    this.#syncer = syncer
  }

  static async createSchema(
    db: Database,
    revision: string,
    configFingerprint = defaultConfigFingerprint
  ): Promise<void> {
    const tables = [
      EntryIndexTable,
      DatabaseStateTable,
      DatabaseMetadataTable,
      SourceFileTable
    ]
    const rows = await db.all<{name: string}>(sql`
      select name from sqlite_master
      where type = 'table' and name in (
        'alinea_database_state',
        'alinea_database_metadata',
        'alinea_source_file'
      )
    `)
    const present = new Set(rows.map(row => row.name))
    // Older layouts lack the version column: read whichever columns exist.
    const current = present.has('alinea_database_metadata')
      ? await db.get<{configFingerprint: string; version?: number}>(
          sql`select * from ${DatabaseMetadataTable} where id = 1`
        )
      : undefined
    // Rows stored as JSONB need a SQLite that reads it.
    const compatible =
      present.has('alinea_database_state') &&
      present.has('alinea_source_file') &&
      current?.version === databaseVersion &&
      current.configFingerprint === configFingerprint &&
      ((await supportsJsonb(db)) || !(await hasJsonbRows(db)))
    if (!compatible) {
      // The FTS5 virtual table is not part of the declared schema.
      await db.run(sql`drop table if exists ${EntrySearchTable}`)
      await db.drop(...tables)
      await db.create(...tables)
      await createSearch(db, EntrySearchTable)
      await db.insert(DatabaseMetadataTable).values({
        id: 1,
        version: databaseVersion,
        configFingerprint
      })
    }
    const existing = await db
      .select(DatabaseStateTable.id)
      .from(DatabaseStateTable)
      .where(eq(DatabaseStateTable.id, 1))
      .get()
    if (existing == null)
      await db.insert(DatabaseStateTable).values({
        id: 1,
        revision,
        tree: revision === ReadonlyTree.EMPTY.sha ? ReadonlyTree.EMPTY : null
      })
  }

  /**
   * Derive every entry again with another config, recording the fingerprint
   * so a later open recognizes the database as written by that config.
   */
  reindex(
    config: Config,
    configFingerprint = defaultConfigFingerprint
  ): Promise<EntrySyncResult> {
    return this.reindexEntries(config, async tx => {
      await tx
        .update(DatabaseMetadataTable)
        .set({configFingerprint})
        .where(eq(DatabaseMetadataTable.id, 1))
    })
  }

  /** File stats recorded by the last filesystem sync of this database. */
  async getSourceFileStats(): Promise<Map<string, FileStat>> {
    return this.withReadConnection(async () => {
      const rows = await this.#db
        .select({
          path: SourceFileTable.path,
          mtime: SourceFileTable.mtime,
          size: SourceFileTable.size
        })
        .from(SourceFileTable)
      return new Map(
        rows.map(row => [row.path, {mtimeMs: row.mtime, size: row.size}])
      )
    })
  }

  /** Replace the recorded file stats after syncing from a filesystem source. */
  async setSourceFileStats(
    stats: ReadonlyMap<string, FileStat>
  ): Promise<void> {
    const rows = Array.from(stats, ([path, stat]) => ({
      path,
      mtime: stat.mtimeMs,
      size: stat.size
    }))
    await this.withReadConnection(() =>
      this.#db.transaction(
        async tx => {
          await tx.delete(SourceFileTable)
          for (const batch of chunks(rows, sqliteBatchSize))
            await tx.insert(SourceFileTable).values(batch)
        },
        {async: true}
      )
    )
  }

  async compact(): Promise<void> {
    await this.withReadConnection(async () => {
      await this.#db.run(sql`pragma optimize`)
      // Rewriting the whole file only pays off when it has pages to reclaim.
      const free = await this.#db.get<{freelist_count: number}>(
        sql`pragma freelist_count`
      )
      if (free?.freelist_count) await this.#db.run(sql`vacuum`)
    })
  }

  protected async releaseLayer(): Promise<void> {
    await this.#syncer.close()
    await this.#db.close()
  }
}
