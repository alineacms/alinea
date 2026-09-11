import type {DatabaseSync} from 'node:sqlite'
import {connect} from 'rado/driver/node-sqlite'

export interface NodeDatabaseOptions {
  /** Enable the durable, concurrent-write policy for a mutable database file. */
  mutable?: boolean
}

/** Flush WAL contents before closing and distributing a complete database file. */
export function checkpointNodeDatabase(sqlite: DatabaseSync): void {
  sqlite.exec('pragma wal_checkpoint(truncate)')
}

/** Normalize Node's absent get() result to the current Rado driver contract. */
export function nodeDatabase(
  sqlite: DatabaseSync,
  options: NodeDatabaseOptions = {}
) {
  if (options.mutable)
    sqlite.exec(`
      pragma journal_mode = wal;
      pragma synchronous = normal;
      pragma busy_timeout = 5000;
    `)
  return connect({
    close: sqlite.close.bind(sqlite),
    exec: sqlite.exec.bind(sqlite),
    prepare(query) {
      const statement = sqlite.prepare(query)
      return {
        all: statement.all.bind(statement),
        run(...params: Parameters<typeof statement.run>) {
          const result = statement.run(...params)
          return {...result, changes: Number(result.changes)}
        },
        setReturnArrays: statement.setReturnArrays.bind(statement),
        get(...params: Parameters<typeof statement.get>) {
          return statement.get(...params) ?? null
        }
      }
    }
  })
}
