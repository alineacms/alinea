import type {Database, Statement} from 'better-sqlite3'
import {Driver} from '../../Driver'

export class BetterSqlite3Driver implements Driver {
  constructor(public db: Database) {}

  exec(sql: string) {
    this.db.exec(sql)
  }

  prepare(sql: string): Driver.PreparedStatement {
    return new PreparedStatement(this.db.prepare(sql))
  }

  transaction<T>(run: () => T): T {
    return this.db.transaction(run).call({})
  }

  export() {
    return (this.db as any).serialize()
  }
}

class PreparedStatement implements Driver.PreparedStatement {
  constructor(private stmt: Statement) {}

  all<T>(params: Array<any>): Array<T> {
    return this.stmt.pluck(true).all(...params)
  }

  run(params: Array<any>): {changes: number} {
    return this.stmt.run(...params)
  }

  get<T>(params: Array<any>): T {
    return this.stmt.pluck(true).get(...params)
  }
}
