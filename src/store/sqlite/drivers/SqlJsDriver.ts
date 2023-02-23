import type {Database} from 'sql.js'
import {Driver} from '../../Driver'

export class SqlJsDriver implements Driver {
  static transactionId = 0
  constructor(public db: Database) {}

  exec(sql: string) {
    this.db.exec(sql)
  }

  prepare(sql: string): Driver.PreparedStatement {
    return new PreparedStatement(this.db, this.db.prepare(sql))
  }

  transaction<T>(run: () => T): T {
    const id = `t${SqlJsDriver.transactionId++}`
    this.exec(`savepoint ${id}`)
    try {
      const res = run()
      this.exec(`release ${id}`)
      return res
    } catch (e) {
      this.exec(`rollback to ${id}`)
      throw e
    }
  }

  export() {
    return this.db.export()
  }
}

class PreparedStatement implements Driver.PreparedStatement {
  constructor(private db: Database, private stmt: any) {}

  all<T>(params: Array<any>): Array<T> {
    this.stmt.bind(params)
    const res = []
    while (this.stmt.step()) res.push(this.stmt.get()[0])
    return res
  }

  run(params: Array<any>): {changes: number} {
    this.stmt.run(params)
    return {changes: this.db.getRowsModified()}
  }

  get<T>(params: Array<any>): T {
    return this.all(params)[0] as T
  }
}
