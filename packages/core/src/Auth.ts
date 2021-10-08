import type {Router} from 'express'
import {ComponentType} from 'react'
import {Session} from './Session'

export namespace Auth {
  export interface Server {
    router(): Router
  }

  export type ViewProps = {setSession: (session: Session | undefined) => void}

  export type View = ComponentType<ViewProps>
}
