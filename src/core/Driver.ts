import {Connection} from './Connection.js'

export interface Driver {
  establishConnection(): Connection
}
