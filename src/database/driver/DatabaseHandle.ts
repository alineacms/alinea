import type {Database} from 'rado'

/**
 * How a connection reads its data: a native file, a native in-memory overlay
 * of a file, or a copy in WASM memory.
 */
export type DatabaseDriver = 'native' | 'overlay' | 'wasm'

/** A SQLite connection, which may copy itself without copying its data. */
export interface DatabaseHandle {
  database: Database
  driver?: DatabaseDriver
  /**
   * An independent connection to the last committed state. The copy shares
   * every page with this one until either side writes it. Connections that
   * write a file in place cannot fork.
   */
  fork?(): Promise<DatabaseHandle>
}
