import type {Router} from 'express'
import {IncomingHttpHeaders} from 'http'
import {ComponentType} from 'react'
import {Session} from './Session'

export namespace Auth {
  export interface Server {
    router(): Router
    authenticate(header: IncomingHttpHeaders): Promise<Session>
  }

  export type ViewProps = {setSession: (session: Session | undefined) => void}

  export type View = ComponentType<ViewProps>
}
