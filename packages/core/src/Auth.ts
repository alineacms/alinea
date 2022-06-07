import type {Handler} from '@alinea/backend/router/Router'
import type {ComponentType} from 'react'
import {Session} from './Session'

export namespace Auth {
  export type Server = {
    // userFor: (request: Request) => User | undefined
    handler: Handler<Request, Response>
  }
  export type ViewProps = {setSession: (session: Session | undefined) => void}
  export type View = ComponentType<ViewProps>
}

export interface Auth<Options> {
  configure: (options: Options) => Auth.Server
  view: Auth.View
}
