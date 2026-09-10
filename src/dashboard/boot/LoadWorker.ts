import {IndexEvent} from '#/core/db/IndexEvent.js'
import {IndexedDBSource} from '#/core/source/IndexedDBSource.js'
import * as Comlink from 'comlink'
import {ActivityEvent} from '#/core/db/ActivityEvent.js'
import type {ConfigGenerator} from './Boot.js'
import {DashboardWorker} from './DashboardWorker.js'
import {ReplicaWorkerHost} from './ReplicaWorkerHost.js'

export function loadReplicaWorker(gen: ConfigGenerator): void {
  const batch = gen.next().then(batch => {
    if (batch.done) throw new Error('Missing replica worker configuration')
    return batch.value
  })
  // Install the port listener before awaiting the dynamic config import.
  Comlink.expose(new ReplicaWorkerHost(batch))
}

export async function loadWorker(gen: ConfigGenerator) {
  const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
  const worker = new DashboardWorker(source)

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
        worker.removeEventListener(ActivityEvent.type, listen)
      }
    }
    worker.addEventListener(IndexEvent.type, listen)
    worker.addEventListener(ActivityEvent.type, listen)
  })

  for await (const batch of gen) {
    await worker.load(batch.revision, batch.config, batch.client)
  }
}
