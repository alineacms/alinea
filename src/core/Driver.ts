import {Connection} from '../core.js'

export interface Driver {
  establishConnection(): Connection
}
