import {createContext, useContext} from 'react'
import {AppProps} from '../App'

type DashboardContext = AppProps & {color: string}

const context = createContext<DashboardContext | undefined>(undefined)

export function useDashboard() {
  return useContext(context)!
}

export const DashboardProvider = context.Provider
