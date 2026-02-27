import type {Config} from 'alinea/core/Config'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {createContext, type PropsWithChildren, useContext, useMemo} from 'react'
import type {AppProps} from './App.js'

interface AppContext {
  config: Config
  db: LocalDB
}

const appContext = createContext<AppContext | undefined>(undefined)

export function AppProvider({config, children}: PropsWithChildren<AppProps>) {
  const db = useMemo(() => new LocalDB(config), [])
  const ctx = useMemo(() => ({config, db}), [config, db])
  return <appContext.Provider value={ctx}>{children}</appContext.Provider>
}

export function useApp() {
  const ctx = useContext(appContext)
  if (!ctx) throw new Error('App context is missing')
  return ctx
}
