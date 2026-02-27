import {Config} from 'alinea/core/Config'
import './index.css'
import {Button} from '@alinea/components'
import type {LocalConnection} from 'alinea/core/Connection'
import {
  type ComponentType,
  createContext,
  type FunctionComponent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef
} from 'react'
import '@alinea/components/css'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {AppProvider, useApp} from './hooks.js'

export interface AppProps {
  config: Config
  client: LocalConnection
  views: Record<string, ComponentType>
}

export function App(props: AppProps) {
  return (
    <AppProvider {...props}>
      <AppRoot />
    </AppProvider>
  )
}

function AppRoot() {
  const {db, config} = useApp()
  const {label} = Config.mainWorkspace(config)
  return (
    <div className="app">
      <h1>
        {label} {db.sha}
      </h1>
      <p>
        Edit <code>src/App.tsx</code> and save to test
        <Button>Test 123</Button>
      </p>
    </div>
  )
}
