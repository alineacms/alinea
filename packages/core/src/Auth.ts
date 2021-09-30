import type {Router} from 'express'
import {IncomingHttpHeaders} from 'http'
import {ComponentType} from 'react'
import {Hub} from './Hub'
import {Session} from './Session'

export namespace Auth {
  export interface Server {
    router(): Router
    authenticate(header: IncomingHttpHeaders): Promise<Session>
  }

  export type ViewProps = {setToken: (token: string) => void}

  export type Hook = () => {
    session?: Session & Hub
    view: ComponentType<ViewProps>
  }
}
