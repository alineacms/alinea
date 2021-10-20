import {createContext, useContext} from 'react'
import {DashboardOptions} from '../Dashboard'

type DashboardContext = DashboardOptions<any> & {color: string}

const context = createContext<DashboardContext | undefined>(undefined)

export function useDashboard() {
  return useContext(context)!
}

export const DashboardProvider = context.Provider
