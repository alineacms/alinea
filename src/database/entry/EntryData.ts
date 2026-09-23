import {sql, type Database, type Sql} from 'rado'
import {EntryIndexTable, type EntryIndexTarget} from './EntryTable.js'

/** SQLite reads and writes JSONB from this version on. */
const jsonbVersion = [3, 45, 0]

async function sqliteVersion(db: Database): Promise<string> {
  const row = await db.get<{version: string}>(
    sql`select sqlite_version() as version`
  )
  if (!row) throw new Error('Could not read the SQLite version')
  return row.version
}

function readsJsonb(version: string): boolean {
  const parts = version.split('.').map(Number)
  for (const [index, least] of jsonbVersion.entries()) {
    const part = parts[index] ?? 0
    if (part !== least) return part > least
  }
  return true
}

/**
 * Whether this SQLite stores entry data as JSONB, which reads paths of large
 * documents without parsing them. Older versions store JSON text.
 */
export async function supportsJsonb(db: Database): Promise<boolean> {
  return readsJsonb(await sqliteVersion(db))
}

/** Whether the entry index holds rows stored as JSONB. */
export async function hasJsonbRows(db: Database): Promise<boolean> {
  const row = await db.get<{found: number}>(
    sql`select exists (
      select 1 from ${EntryIndexTable}
      where typeof(${EntryIndexTable.data}) = 'blob'
    ) as found`
  )
  return Boolean(row?.found)
}

/** Fail clearly when this SQLite cannot read the JSONB rows of a database. */
export async function assertReadableData(db: Database): Promise<void> {
  const version = await sqliteVersion(db)
  if (readsJsonb(version) || !(await hasJsonbRows(db))) return
  throw new Error(
    `Alinea's generated database stores JSONB, which requires SQLite ${jsonbVersion.join('.')} or newer (found ${version})`
  )
}

/** The data as JSON text, whether stored as text or JSONB. */
export function entryDataText(
  entry: Pick<EntryIndexTarget, 'data'>
): Sql<string> {
  return sql<string>`json(${entry.data})`
}
