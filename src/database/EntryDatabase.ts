import type {Config} from '#/core/Config.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {eq, sql, type Database} from 'rado'
import {DatabaseMetadataTable, DatabaseStateTable} from './DatabaseTables.js'
import {EntryIndexTable} from './entry/EntryTable.js'
import {EntryLayer, type EntryDatabaseOptions} from './EntryLayer.js'
import {createSearch, EntrySearchName} from './query/Search.js'
import {EntrySyncer, EntrySyncRoot} from './sync/EntrySyncer.js'

export type {
  EntryApplyOptions,
  EntryApplyResult,
  EntryChangeListener,
  EntryDatabaseOptions,
  EntryDatabaseOverlay,
  EntryLayerContext,
  EntryLayerState,
  EntrySyncResult,
  QueryObserver
} from './EntryLayer.js'
export {EntryLayer, EntryOverlay} from './EntryLayer.js'

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
      context: {nextOverlayId: 1, queue: Promise.resolve(), syncer},
      target: EntrySyncRoot,
      searchName: EntrySearchName,
      searchDirty: !options.searchReady,
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
    const schema = await db.get<{name: string}>(sql`
      select name from sqlite_master
      where type = 'table' and name = 'alinea_database_state'
    `)
    const metadata = await db.get<{name: string}>(sql`
      select name from sqlite_master
      where type = 'table' and name = 'alinea_database_metadata'
    `)
    const current = metadata
      ? await db
          .select({
            configFingerprint: DatabaseMetadataTable.configFingerprint
          })
          .from(DatabaseMetadataTable)
          .where(eq(DatabaseMetadataTable.id, 1))
          .get()
      : undefined
    const compatible =
      schema != null && current?.configFingerprint === configFingerprint
    if (!compatible) {
      await db.run(sql`drop table if exists ${sql.identifier(EntrySearchName)}`)
      await db.run(
        sql`drop table if exists ${sql.identifier('alinea_entry_index')}`
      )
      await db.run(
        sql`drop table if exists ${sql.identifier('alinea_database_state')}`
      )
      await db.run(
        sql`drop table if exists ${sql.identifier('alinea_database_metadata')}`
      )
      await db.create(
        EntryIndexTable,
        DatabaseStateTable,
        DatabaseMetadataTable
      )
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
