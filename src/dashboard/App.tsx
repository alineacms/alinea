import {ProgressCircle} from '#/components.js'
import type {Config} from '#/core/Config'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {ComponentType, Suspense, useState} from 'react'
import css from './App.module.css'
import {AppShell} from './app/AppShell.js'
import {AuthView} from './app/AuthView.js'
import {Rail} from './app/ui/Rail.js'
import './global.css'
import {Dashboard} from './store/Dashboard.js'

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
      new Dashboard(graph, config, events, client, views, {
        alineaDev,
        local
      })
  )
  useAtomValue(dashboard.theme)
  return (
    <Suspense
      fallback={
        <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
          <div className={styles.AppLoading.progress()}>
            <ProgressCircle isIndeterminate aria-label="loading" />
          </div>
        </Rail>
      }
    >
      <AppRoot dashboard={dashboard} />
    </Suspense>
  )
}

interface AppRootProps {
  dashboard: Dashboard
}

function AppRoot({dashboard}: AppRootProps) {
  const auth = useAtomValue(dashboard.auth)

  if (auth.status !== 'authenticated') {
    return <AuthView dashboard={dashboard} />
  }

  return <AppShell dashboard={dashboard} />
}
