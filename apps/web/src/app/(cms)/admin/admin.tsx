'use client'

import {cms} from '@/cms'
import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'
import {Client} from 'alinea/core/Client'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import {App} from 'alinea/dashboard/App'
import {DashboardWorker} from 'alinea/dashboard/boot/DashboardWorker'
import {WorkerDB} from 'alinea/dashboard/boot/WorkerDB'
import {defaultViews} from 'alinea/dashboard/editor/DefaultViews'

const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
const worker = new DashboardWorker(source)
const apiKey =
  process.env.NODE_ENV === 'development'
    ? 'dev'
    : (process.env.ALINEA_API_KEY ?? (await generatedRelease))
const client = new Client({
  config: cms.config,
  url: '/api/cms',
  applyAuth(request) {
    return {
      ...request,
      headers: {
        ...request?.headers,
        Authorization: `Bearer ${apiKey}`
      }
    }
  }
})
const db = new WorkerDB(cms.config, worker, client, worker)
worker.load(apiKey, cms.config, client)

export function Admin() {
  return (
    <App
      local
      config={cms.config}
      db={db}
      client={client}
      views={defaultViews}
    />
  )
}
