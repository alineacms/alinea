import '@alinea/components/css'
import type {Config} from 'alinea/core/Config'
import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import type {Atom} from 'jotai'
import {ComponentType, useMemo} from 'react'
import {AppShell} from './app/AppShell.js'
import './index.css'
import {Dashboard} from './store/Dashboard.js'

export interface AppProps {
  db: Atom<LocalDB>
  config: Atom<Config>
  views: Atom<Record<string, ComponentType>>
}

export function App({db, config, views}: AppProps) {
  const dashboard = useMemo(
    () => new Dashboard(db, config, undefined!, views),
    [db, config, views]
  )
  return <AppShell dashboard={dashboard} />
}
