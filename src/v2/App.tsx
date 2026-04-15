import '@alinea/components/css'
import type {Config} from '#/core/Config.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {ComponentType, useState} from 'react'
import '../global.css'
import {AppShell} from './app/AppShell.js'
import {Dashboard} from './store/Dashboard.js'

export interface AppProps {
  graph: WriteableGraph
  events: EventTarget
  config: Config
  views: Record<string, ComponentType>
}

export function App({graph, events, config, views}: AppProps) {
  const [dashboard] = useState(
    () => new Dashboard(graph, config, events, undefined!, views)
  )
  return <AppShell dashboard={dashboard} />
}
