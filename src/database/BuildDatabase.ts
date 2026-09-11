import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {rm, stat} from 'node:fs/promises'
import {sql} from 'rado'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryIndexTable} from './entry/Schema.js'
import {runtimeDatabase} from './driver/RuntimeDatabase.js'
import {EntrySearchName, rebuildSearch} from './query/Search.js'

/** Build a compact, immutable-ready SQLite file from a source. */
export async function buildEntryDatabase(
  config: Config,
  source: RemoteSource,
  filePath: string
): Promise<number> {
  await rm(filePath, {force: true})
  const db = await runtimeDatabase({path: filePath})
  try {
    await db.run(sql`pragma journal_mode = memory`)
    await db.run(sql`pragma synchronous = off`)
    await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
    const database = new EntryDatabase(config, db)
    await database.syncWith(source)
    await rebuildSearch(db, EntryIndexTable, EntrySearchName)
    await db.run(sql`pragma optimize`)
    await db.run(sql`vacuum`)
  } finally {
    await db.close()
  }
  return (await stat(filePath)).size
}
