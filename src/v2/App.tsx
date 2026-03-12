import '@alinea/components/css'
import type {Config} from 'alinea/core/Config'
import './index.css'
import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import type {Atom} from 'jotai'
import {useMemo} from 'react'
import {AppShell} from './app/AppShell.js'
import {Dashboard} from './dashboard/Dashboard.js'
import type {EntryViews} from './fields/FieldView.js'

export interface AppProps {
  db: Atom<LocalDB>
  config: Atom<Config>
  views: Atom<EntryViews>
}

export function App({db, config, views}: AppProps) {
  const dashboard = useMemo(
    () => new Dashboard(db, config, undefined!),
    [db, config, views]
  )
  return <AppShell dashboard={dashboard} />
}
