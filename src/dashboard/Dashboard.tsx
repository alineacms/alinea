import type {CMS} from 'alinea/core/CMS'
import {Client} from 'alinea/core/Client'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import type {ComponentType} from 'react'
import {App} from './App.js'
import {DashboardWorker} from './boot/DashboardWorker.js'
import {WorkerDB} from './boot/WorkerDB.js'
import {defaultViews} from './editor/DefaultViews.js'

export interface DashboardProps {
  cms: CMS
  handler: string
}

export function Dashboard({cms, handler}: DashboardProps) {
  const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
  const client = new Client({
    config: cms.config,
    url: handler
  })
  const worker = new DashboardWorker(source)
  const db = new WorkerDB(cms.config, worker, client, worker)
  worker.load('dev', cms.config, client)
  return (
    <App
      db={db}
      client={client}
      config={cms.config}
      local
      views={defaultViews as Record<string, ComponentType>}
    />
  )
}
