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
import {EntryIndexTable} from './entry/EntryTable.js'
import {EntryLayer, type EntryDatabaseOptions} from './EntryLayer.js'
import {createSearch, EntrySearchName} from './query/Search.js'
import {EntrySyncer, EntrySyncRoot} from './sync/EntrySyncer.js'
import {sqliteBatchSize} from './sync/SyncQueries.js'

const defaultConfigFingerprint = 'runtime'

/** A queryable entry database owning its SQLite connections. */
export class EntryDatabase extends EntryLayer {
  #db: Database
  #syncDb: Database
  #contextSyncer: EntrySyncer
  #ownedSyncer?: EntrySyncer

  constructor(
    config: Config,
    db: Database,
    options: EntryDatabaseOptions = {}
  ) {
    const syncDb = options.syncDatabase ?? db
    const syncer = new EntrySyncer(config, db)
    const ownedSyncer =
      syncDb === db ? undefined : new EntrySyncer(config, syncDb)
    super(config, options, {
      db,
      syncDb,
      syncer: ownedSyncer ?? syncer,
      context: {nextOverlayId: 1, queue: new TaskQueue(), syncer},
      target: EntrySyncRoot,
      searchName: EntrySearchName,
      searchDirty: options.searchReady ? false : 'unknown',
      transactional: false
    })
    this.#db = db
    this.#syncDb = syncDb
    this.#contextSyncer = syncer
    this.#ownedSyncer = ownedSyncer
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
    const current = present.has('alinea_database_metadata')
      ? await db
          .select({
            configFingerprint: DatabaseMetadataTable.configFingerprint
          })
          .from(DatabaseMetadataTable)
          .where(eq(DatabaseMetadataTable.id, 1))
          .get()
      : undefined
    const compatible =
      present.has('alinea_database_state') &&
      present.has('alinea_source_file') &&
      current?.configFingerprint === configFingerprint
    if (!compatible) {
      // The FTS5 virtual table is not part of the declared schema.
      await db.run(sql`drop table if exists ${sql.identifier(EntrySearchName)}`)
      await db.drop(...tables)
      await db.create(...tables)
      await createSearch(db)
      await db.insert(DatabaseMetadataTable).values({
        id: 1,
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
    await this.prepareSearch()
    await this.withReadConnection(async () => {
      await this.#db.run(sql`pragma optimize`)
      await this.#db.run(sql`vacuum`)
    })
  }

  protected async releaseLayer(): Promise<void> {
    await this.#contextSyncer.close()
    if (this.#ownedSyncer) await this.#ownedSyncer.close()
    if (this.#syncDb !== this.#db) await this.#syncDb.close()
    await this.#db.close()
  }
}
