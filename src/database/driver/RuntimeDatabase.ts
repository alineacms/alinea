import type {Database, DatabaseOptions} from 'rado'

export interface RuntimeDatabaseOptions extends DatabaseOptions {
  path?: string
  data?: Uint8Array
  readonly?: boolean
}

/** Select a native Node/Bun driver for files and WASM for byte buffers. */
export async function runtimeDatabase(
  options: RuntimeDatabaseOptions = {}
): Promise<Database> {
  if (options.path) {
    if (typeof Bun !== 'undefined') {
      const [{Database: BunDatabase}, {connect}] = await Promise.all([
        import('bun:sqlite'),
        import('rado/driver/bun-sqlite')
      ])
      return connect(
        new BunDatabase(options.path, {
          create: !options.readonly,
          readonly: options.readonly
        }),
        options
      )
    }
    const [{DatabaseSync}, {connect}] = await Promise.all([
      import('node:sqlite'),
      import('rado/driver/node-sqlite')
    ])
    const sqlite = new DatabaseSync(options.path, {
      readOnly: options.readonly
    })
    return connect(sqlite as unknown as Parameters<typeof connect>[0], options)
  }
  const {wasmDatabase} = await import('./WasmDatabase.js')
  return wasmDatabase(options.data)
}
