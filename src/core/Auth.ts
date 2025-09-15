import type {ComponentType} from 'react'
import type {Session} from './Session.js'

export namespace Auth {
  export type ViewProps = {
    session: Session | undefined
    setSession: (session: Session | undefined) => void
  }
  export type View = ComponentType<ViewProps>
}
