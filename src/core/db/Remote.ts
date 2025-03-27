import type {Connection} from '../Connection.js'
import type {User} from '../User.js'

export interface RequestContext {
  handlerUrl: URL
  apiKey: string
}

export interface AuthedContext extends RequestContext {
  user: User
  token: string
}

export interface Remote {
  connect(ctx: RequestContext): Connection
}
