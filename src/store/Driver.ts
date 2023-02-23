export interface Driver {
  transaction<T>(run: () => T): T
  exec(sql: String): void
  prepare(sql: String): Driver.PreparedStatement
  export(): Uint8Array
}

export namespace Driver {
  export type Options = {
    readonly?: boolean
    fileMustExist?: boolean
  }

  export type PreparedStatement = {
    run(params: Array<any>): {changes: number}
    all<T>(params: Array<any>): Array<T>
    get<T>(params: Array<any>): T
  }
}
