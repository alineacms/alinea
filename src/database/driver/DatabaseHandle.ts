import type {Database} from 'rado'

/** A SQLite connection, which may copy itself without copying its data. */
export interface DatabaseHandle {
  database: Database
  /**
   * An independent connection to the last committed state. The copy shares
   * every page with this one until either side writes it. Connections that
   * write a file in place cannot fork.
   */
  fork?(): Promise<DatabaseHandle>
}
