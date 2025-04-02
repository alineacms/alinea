import {} from 'alinea/core/db/IndexEvent'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import * as Comlink from 'comlink'
import type {ConfigGenerator} from './Boot.js'
import {DashboardWorker} from './DashboardWorker.js'

export async function loadWorker(gen: ConfigGenerator) {
  const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
  const worker = new DashboardWorker(source)

  globalThis.onconnect = event => {
    console.log('Worker connected')
    const port = event.ports[0]
    Comlink.expose(worker.add(port), port)
  }

  for await (const batch of gen) {
    worker.load(batch.revision, batch.config, batch.client)
  }
}
