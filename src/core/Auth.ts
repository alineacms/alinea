import type {Handler} from 'alinea/backend/router/Router'
import type {ComponentType} from 'react'
import {Hub} from './Hub.js'
import {Session} from './Session.js'

export namespace Auth {
  export type Server = {
    handler: Handler<Request, Response | undefined>
    contextFor(request: Request): Promise<Hub.AuthContext>
  }
  export type ViewProps = {setSession: (session: Session | undefined) => void}
  export type View = ComponentType<ViewProps>

  export function anonymous(): Auth.Server {
    return {
      async contextFor() {
        return {}
      },
      handler() {
        return undefined
      }
    }
  }
}

export interface Auth<Options> {
  configure: (options: Options) => Auth.Server
  view: Auth.View
}
