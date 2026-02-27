import '@alinea/components/css'
import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import {type ComponentType, useMemo} from 'react'
import './index.css'
import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import {AppShell} from './app/AppShell'
import {configAtom} from './atoms/config.js'
import {dbAtom} from './atoms/db.js'
import {useRequiredAtoms} from './atoms/util/RequiredAtom.js'

export interface AppProps {
  config: Config
  db: LocalDB
  views: Record<string, ComponentType>
}

const requiredAtoms = {
  config: configAtom,
  db: dbAtom
}

export function App(props: AppProps) {
  const {config} = props
  useRequiredAtoms(requiredAtoms, {
    config,
    db: props.db
  })
  return <AppShell />
}
