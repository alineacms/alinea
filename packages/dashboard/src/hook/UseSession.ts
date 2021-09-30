import {Hub} from '@alinea/core/Hub'
import {Session} from '@alinea/core/Session'
import {createContext, useContext} from 'react'

type DashboardSession = Session & Hub

const context = createContext<DashboardSession | undefined>(undefined)

export function useSession() {
  return useContext(context)!
}

export const SessionProvider = context.Provider
