import '@alinea/components/css'
import type {Config} from 'alinea/core/Config'
import './index.css'
import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import {AppShell} from './app/AppShell.js'
import {configAtom} from './atoms/config.js'
import {dbAtom} from './atoms/db.js'
import {useRequiredAtoms} from './atoms/util/RequiredAtom.js'
import type {EntryViews} from './fields/FieldView.js'

export interface AppProps {
  config: Config
  db: LocalDB
  views: EntryViews
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
  return <AppShell views={props.views} />
}
