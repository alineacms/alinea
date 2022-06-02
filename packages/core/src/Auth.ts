import type {Handler} from '@alinea/backend/router/Router'
import {ComponentType} from 'react'
import {Session} from './Session'

export namespace Auth {
  export interface Server {
    fetch: Handler<Request, Response>
  }

  export type ViewProps = {setSession: (session: Session | undefined) => void}

  export type View = ComponentType<ViewProps>
}
