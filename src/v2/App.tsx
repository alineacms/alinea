import '@alinea/components/css'
import type {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import type {Atom} from 'jotai'
import {ComponentType, useMemo} from 'react'
import {AppShell} from './app/AppShell.js'
import './index.css'
import {Dashboard} from './store/Dashboard.js'

export interface AppProps {
  writeableGraph: Atom<WriteableGraph>
  indexEvents: Atom<EventTarget>
  config: Atom<Config>
  views: Atom<Record<string, ComponentType>>
}

export function App({
  writeableGraph,
  indexEvents,
  config,
  views
}: AppProps) {
  const dashboard = useMemo(
    () => new Dashboard(writeableGraph, config, indexEvents, undefined!, views),
    [writeableGraph, config, indexEvents, views]
  )
  return <AppShell dashboard={dashboard} />
}
