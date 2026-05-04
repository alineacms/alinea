import {ProgressCircle} from '#/components.js'
import type {Config} from '#/core/Config'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph'
import type {User} from '#/core/User.js'
import {useAtomValue} from 'jotai'
import {useSetAtom} from 'jotai'
import {ComponentType, Suspense, useCallback, useEffect, useState} from 'react'
import {AppShell} from './app/AppShell.js'
import {AuthView} from './app/AuthView.js'
import {Rail} from './app/ui/Rail.js'
import './global.css'
import {Dashboard} from './store/Dashboard.js'

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
  const theme = useAtomValue(dashboard.theme)
  return (
    <Suspense
      fallback={
        <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
          <ProgressCircle isIndeterminate aria-label="loading" />
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
  const isDev = useAtomValue(dashboard.alineaDev)
  const local = useAtomValue(dashboard.local)
  const client = useAtomValue(dashboard.client)
  const authRevision = useAtomValue(dashboard.authRevision)
  const authenticate = useSetAtom(dashboard.authenticate)
  const [authenticated, setAuthenticated] = useState(false)
  const forceAuth = Boolean(
    typeof process !== 'undefined' && process.env.ALINEA_FORCE_AUTH
  )
  const requiresAuth = !isDev && (!local || forceAuth)

  useEffect(() => {
    if (requiresAuth) setAuthenticated(false)
  }, [authRevision, requiresAuth])

  const onAuthenticated = useCallback(
    (user: User) => {
      authenticate(user)
      setAuthenticated(true)
    },
    [authenticate]
  )

  if (requiresAuth && !authenticated) {
    return <AuthView client={client} onAuthenticated={onAuthenticated} />
  }

  return <AppShell dashboard={dashboard} />
}
