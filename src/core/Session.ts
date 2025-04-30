import type {Connection} from './Connection.js'
import type {User} from './User.js'

export interface Session {
  cnx: Connection
  user: User
  end?: () => Promise<void>
}
