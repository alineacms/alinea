import type {Config} from 'alinea/core/Config'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {
  createContext,
  type FunctionComponent,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useContext,
  useMemo
} from 'react'
import type {AppProps} from './App.js'

interface AppContext {
  config: Config
  db: LocalDB
}

const appContext = createContext<AppContext | undefined>(undefined)

export function AppProvider({config, children}: PropsWithChildren<AppProps>) {
  const db = useMemo(() => new LocalDB(config), [config])
  const ctx = useMemo(() => ({config, db}), [config, db])
  return <appContext.Provider value={ctx}>{children}</appContext.Provider>
}

export function useApp() {
  return useContext(appContext)!
}
