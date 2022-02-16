export interface Driver {
  transaction<T>(run: () => T): T
  exec(sql: String): void
  prepare(sql: String): Driver.PreparedStatement
}

export namespace Driver {
  export type Options = {
    readonly?: boolean
    fileMustExist?: boolean
  }

  export type PreparedStatement = {
    all<T>(params: Array<any>): Array<T>
    run<T>(params: Array<any>): {changes: number}
    get<T>(params: Array<any>): T
  }
}
