import type {DatabaseSync} from 'node:sqlite'
import {connect} from 'rado/driver/node-sqlite'

/** Normalize Node's absent get() result to the current Rado driver contract. */
export function nodeDatabase(sqlite: DatabaseSync) {
  return connect({
    close: sqlite.close.bind(sqlite),
    exec: sqlite.exec.bind(sqlite),
    prepare(query) {
      const statement = sqlite.prepare(query)
      return {
        all: statement.all.bind(statement),
        run: statement.run.bind(statement),
        setReturnArrays: statement.setReturnArrays.bind(statement),
        get(...params: Parameters<typeof statement.get>) {
          return statement.get(...params) ?? null
        }
      }
    }
  })
}
