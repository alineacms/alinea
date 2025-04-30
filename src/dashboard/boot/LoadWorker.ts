import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import * as Comlink from 'comlink'
import type {ConfigGenerator} from './Boot.js'
import {DashboardWorker} from './DashboardWorker.js'

export async function loadWorker(gen: ConfigGenerator) {
  const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
  const worker = new DashboardWorker(source)

  globalThis.onconnect = event => {
    console.info('Worker connected')
    const port = event.ports[0]
    Comlink.expose(worker, port)
    const listen = (event: Event) => {
      try {
        port.postMessage({...event, type: event.type})
      } catch (error) {
        worker.removeEventListener(IndexEvent.type, listen)
      }
    }
    worker.addEventListener(IndexEvent.type, listen)
  }

  for await (const batch of gen) {
    await worker.load(batch.revision, batch.config, batch.client)
  }
}
