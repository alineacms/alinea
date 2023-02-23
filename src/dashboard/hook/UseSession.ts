import {Session} from 'alinea/core'
import {createContext, useContext} from 'react'

const context = createContext<Session | undefined>(undefined)

export function useSession() {
  return useContext(context)!
}

export const SessionProvider = context.Provider
