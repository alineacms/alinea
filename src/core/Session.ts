import type {BrowserConnection} from './Connection.js'
import type {User} from './User.js'

export interface Session {
  cnx: BrowserConnection
  user: User
}
