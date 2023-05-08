import {Connection} from './Connection.js'
import {User} from './User.js'

export interface Session<T = any> {
  cnx: Connection
  user: User
  end: () => Promise<void>
}
