import {ProgressCircle} from '#/components.js'
import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {
  ComponentType,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import css from './App.module.css'
import {AppShell} from './app/AppShell.js'
import {AuthView} from './app/AuthView.js'
import {Rail} from './app/ui/Rail.js'
import './global.css'
import {DashboardScopeInternal} from './hooks.js'
import {authAtom} from './atoms/AuthAtoms.js'
import {createDashboard} from './atoms/Dashboard.js'
import {
  prepareInitialContentAtom,
  themeAtom
} from './atoms/DashboardViewAtoms.js'

const styles = styler(css)

export interface AppProps {
  graph: WriteableGraph
  events: EventTarget
  config: Config
  client: LocalConnection
  views: Record<string, ComponentType>
  local?: boolean
  alineaDev?: boolean
}

export function App({
  graph,
  events,
  config,
  client,
  views,
  local,
  alineaDev
}: AppProps) {
  const [dashboard] = useState(() =>
    createDashboard(graph, config, events, client, views, {
      alineaDev,
      local
    })
  )
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <DashboardApp />
    </DashboardScopeInternal>
  )
}

function DashboardApp() {
  useAtomValue(themeAtom)
  const auth = useAtomValue(authAtom)
  if (auth.status !== 'authenticated') {
    return <AuthView />
  }
  return <DashboardContent />
}

function DashboardLoading() {
  return (
    <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
      <div className={styles.AppLoading.progress()}>
        <ProgressCircle isIndeterminate aria-label="loading" />
      </div>
    </Rail>
  )
}

interface DashboardBootProps {
  setReady: Dispatch<SetStateAction<boolean>>
}

function DashboardBoot({setReady}: DashboardBootProps) {
  const [error, setError] = useState<Error>()
  const prepare = useSetAtom(prepareInitialContentAtom)
  useEffect(() => {
    void prepare().then(
      () => setReady(true),
      cause =>
        setError(cause instanceof Error ? cause : new Error(String(cause)))
    )
  }, [prepare, setReady])
  if (error) throw error
  return <DashboardLoading />
}

function DashboardContent() {
  const [ready, setReady] = useState(false)
  if (ready) return <AppShell />
  return <DashboardBoot setReady={setReady} />
}
