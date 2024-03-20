import type {Route} from 'alinea/backend/router/Router'
import type {ComponentType} from 'react'
import {Connection} from './Connection.js'
import {Session} from './Session.js'
import {localUser} from './User.js'

export namespace Auth {
  export type Server = {
    router?: Route<Request, Response | undefined>
    contextFor(request: Request): Promise<Connection.AuthContext>
  }
  export type ViewProps = {setSession: (session: Session | undefined) => void}
  export type View = ComponentType<ViewProps>

  export function anonymous(): Auth.Server {
    return {
      async contextFor() {
        return {user: localUser}
      }
    }
  }
}

export interface Auth<Options> {
  configure: (options: Options) => Auth.Server
  view: Auth.View
}
