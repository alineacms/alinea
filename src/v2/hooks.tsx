import type {Config} from 'alinea/core/Config'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo
} from 'react'
import type {AppProps} from './App.js'
import {type RouteState, useRouteState} from './routing/state'

interface AppContext {
  config: Config
  db: LocalDB
  route: RouteState
  navigate: (next: RouteState, replace?: boolean) => void
  isNavigating: boolean
}

const appContext = createContext<AppContext | undefined>(undefined)

export function AppProvider({config, children}: PropsWithChildren<AppProps>) {
  const db = useMemo(() => new LocalDB(config), [config])
  const {route, navigate, isNavigating} = useRouteState(config)
  const ctx = useMemo(
    () => ({config, db, route, navigate, isNavigating}),
    [config, db, route, navigate, isNavigating]
  )
  return <appContext.Provider value={ctx}>{children}</appContext.Provider>
}

export function useApp() {
  const ctx = useContext(appContext)
  if (!ctx) throw new Error('App context is missing')
  return ctx
}
