import {createContext, useContext} from 'react'
import {DashboardOptions} from '../Dashboard'
import {nav} from '../DashboardNav'

type DashboardContext = DashboardOptions & {
  nav: typeof nav
}

const context = createContext<DashboardContext | undefined>(undefined)

export function useDashboard() {
  return useContext(context)!
}

export const DashboardProvider = context.Provider
