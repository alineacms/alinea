import type {Config} from '#/core/Config'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph'
import {ComponentType, useState} from 'react'
import {AppShell} from './app/AppShell.js'
import './global.css'
import {Dashboard} from './store/Dashboard.js'

export interface AppProps {
  graph: WriteableGraph
  events: EventTarget
  config: Config
  client: LocalConnection
  views: Record<string, ComponentType>
}

export function App({graph, events, config, client, views}: AppProps) {
  const [dashboard] = useState(
    () => new Dashboard(graph, config, events, client, views)
  )
  return <AppShell dashboard={dashboard} />
}
