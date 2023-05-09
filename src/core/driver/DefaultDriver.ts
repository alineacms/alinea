import {Store} from 'alinea/backend/Store'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {Driver} from '../Driver.js'

export class DefaultDriver implements Driver {
  constructor(protected config: Config) {}

  async createStore(cwd: string): Promise<Store> {
    const {default: BetterSqlite3} = await import('better-sqlite3')
    const {connect} = await import('rado/driver/better-sqlite3')
    const cnx = connect(new BetterSqlite3(`${cwd}/.alinea/content.sqlite`))
    return cnx.toAsync()
  }

  async establishConnection(): Promise<Connection> {
    // const isBrowser = typeof window !== 'undefined'
    // if (isBrowser) return new Client(this.config)
    throw new Error('Method not implemented.')
  }
}
