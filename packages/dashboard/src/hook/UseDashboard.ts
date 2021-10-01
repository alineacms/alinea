import {createContext, useContext} from 'react'
import {AppProps} from '../App'

const context = createContext<AppProps | undefined>(undefined)

export function useDashboard() {
  return useContext(context)!
}

export const AppProvider = context.Provider
