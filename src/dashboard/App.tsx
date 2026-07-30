import {useAtomValue} from './AtomHooks.js'
import {ProgressCircle} from '#/components.js'
import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import styler from '@alinea/styler'
import {loadable} from 'jotai/utils'
import {ComponentType, useState} from 'react'
import css from './App.module.css'
import {AppShell} from './app/AppShell.js'
import {AuthView} from './app/AuthView.js'
import {Rail} from './app/ui/Rail.js'
import './global.css'
import {DashboardScopeInternal} from './hooks.js'
import type {Dashboard} from './atoms/dashboard.js'
import {pageAtom} from './atoms/routing.js'
import {authAtom, themeAtom} from './atoms/user.js'

const styles = styler(css)
const loadablePageAtom = loadable(pageAtom)

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
      ({
        graph,
        config,
        events,
        client,
        views,
        options: {alineaDev, local}
      }) satisfies Dashboard
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

function DashboardContent() {
  const page = useAtomValue(loadablePageAtom)
  if (page.state === 'loading') return <DashboardLoading />
  if (page.state === 'hasError') throw page.error
  return <AppShell page={page.data} />
}
