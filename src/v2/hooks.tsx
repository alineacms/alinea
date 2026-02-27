import type {Config} from 'alinea/core/Config'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {createContext, type PropsWithChildren, useContext, useMemo} from 'react'
import {currentWorkspaceAtom} from './atoms/cms/workspaces.js'
import {configAtom} from './atoms/config.js'
import {dbAtom} from './atoms/db.js'
import {useRequiredAtoms} from './atoms/util/RequiredAtom.js'
import type {AppProps} from './App.js'

interface AppContext {
  config: Config
  db: LocalDB
}

const appContext = createContext<AppContext | undefined>(undefined)

export function AppProvider({config, children}: PropsWithChildren<AppProps>) {
  const db = useMemo(function createDb() {
    return new LocalDB(config)
  }, [config])
  const currentWorkspace = Object.keys(config.workspaces)[0] ?? ''

  useRequiredAtoms(
    {
      config: configAtom,
      db: dbAtom,
      currentWorkspace: currentWorkspaceAtom
    },
    {
      config,
      db,
      currentWorkspace
    }
  )

  const ctx = useMemo(() => ({config, db}), [config, db])
  return <appContext.Provider value={ctx}>{children}</appContext.Provider>
}

export function useApp() {
  const ctx = useContext(appContext)
  if (!ctx) throw new Error('App context is missing')
  return ctx
}
