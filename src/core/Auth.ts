import type {Handler} from 'alinea/backend/router/Router'
import type {ComponentType} from 'react'
import {Hub} from './Hub'
import {Session} from './Session'

export namespace Auth {
  export type Server = {
    handler: Handler<Request, Response | undefined>
    contextFor(request: Request): Promise<Hub.AuthContext>
  }
  export type ViewProps = {setSession: (session: Session | undefined) => void}
  export type View = ComponentType<ViewProps>
}

export interface Auth<Options> {
  configure: (options: Options) => Auth.Server
  view: Auth.View
}
