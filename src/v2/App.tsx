import '@alinea/components/css'
import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import type {ComponentType} from 'react'
import './index.css'
import {AppShell} from './app/AppShell'
import {AppProvider} from './hooks'

export interface AppProps {
  config: Config
  client: LocalConnection
  views: Record<string, ComponentType>
}

export function App(props: AppProps) {
  return (
    <AppProvider {...props}>
      <AppShell />
    </AppProvider>
  )
}
