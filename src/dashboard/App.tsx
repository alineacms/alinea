import {ProgressCircle} from '#/components.js'
import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {
  ComponentType,
  Suspense,
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
import {createStore, type Store} from './store/Dashboard.js'

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
  const [dashboard] = useState(
    () =>
      createStore(graph, config, events, client, views, {
        alineaDev,
        local
      })
  )
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <DashboardApp dashboard={dashboard} />
    </DashboardScopeInternal>
  )
}

interface StoreAppProps {
  dashboard: Store
}

function DashboardApp({dashboard}: StoreAppProps) {
  useAtomValue(dashboard.theme)
  const auth = useAtomValue(dashboard.auth)
  if (auth.status !== 'authenticated') {
    return <AuthView dashboard={dashboard} />
  }
  return <DashboardContent dashboard={dashboard} />
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

interface DashboardBootProps extends StoreAppProps {
  setReady: Dispatch<SetStateAction<boolean>>
}

function DashboardBoot({dashboard, setReady}: DashboardBootProps) {
  useAtomValue(dashboard.initialContentAvailable)
  useEffect(() => setReady(true), [setReady])
  return <AppShell dashboard={dashboard} />
}

function DashboardContent({dashboard}: StoreAppProps) {
  const [ready, setReady] = useState(false)
  if (ready) return <AppShell dashboard={dashboard} />
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardBoot dashboard={dashboard} setReady={setReady} />
    </Suspense>
  )
}
