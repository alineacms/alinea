import {IndexEvent} from '#/core/db/IndexEvent.js'
import * as Comlink from 'comlink'
import type {ConfigGenerator} from './Boot.js'
import {ContentStateEvent} from './ContentStateEvent.js'
import {DashboardWorker} from './DashboardWorker.js'
import {MutationQueueEvent} from './MutationQueueEvent.js'

export async function loadWorker(gen: ConfigGenerator) {
  const worker = new DashboardWorker(globalThis.indexedDB)

  addEventListener('connect', event => {
    if (!(event instanceof MessageEvent)) return
    console.info('Worker connected')
    const port = event.ports[0]
    Comlink.expose(worker, port)
    const listen = (event: Event) => {
      try {
        port.postMessage({...event, type: event.type})
      } catch {
        worker.removeEventListener(IndexEvent.type, listen)
        worker.removeEventListener(ContentStateEvent.type, listen)
        worker.removeEventListener(MutationQueueEvent.type, listen)
      }
    }
    worker.addEventListener(IndexEvent.type, listen)
    worker.addEventListener(ContentStateEvent.type, listen)
    worker.addEventListener(MutationQueueEvent.type, listen)
  })

  for await (const batch of gen) {
    await worker.load(
      batch.revision,
      batch.config,
      batch.client,
      batch.cacheKey,
      batch.configId
    )
  }
}
