import {Store} from 'alinea/backend/Store'
import {Connection} from './Connection.js'

export interface Driver {
  createStore(cwd: string): Promise<Store>
  establishConnection(): Promise<Connection>
}
