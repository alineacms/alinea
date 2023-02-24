import {createContext, useContext} from 'react'
import {DashboardOptions} from '../Dashboard.js'

type DashboardContext = DashboardOptions

const context = createContext<DashboardContext | undefined>(undefined)

export function useDashboard() {
  return useContext(context)!
}

export const DashboardProvider = context.Provider
