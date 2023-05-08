import {Connection} from './Connection.js'
import {User} from './User.js'

export interface Session<T = any> {
  cnx: Connection<T>
  user: User
  end: () => Promise<void>
}
