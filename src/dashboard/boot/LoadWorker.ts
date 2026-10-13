import {IndexEvent} from '#/core/db/IndexEvent.js'
import * as Comlink from 'comlink'
import {ActivityEvent} from './ActivityEvent.js'
import type {ConfigGenerator} from './Boot.js'
import {DashboardWorker} from './DashboardWorker.js'

interface Target {
  postMessage(message: unknown): void
}

export async function loadWorker(gen: ConfigGenerator) {
  const worker = new DashboardWorker()

  function forward(target: Target) {
    const listen = (event: Event) => {
      try {
        target.postMessage({...event, type: event.type})
      } catch {
        worker.removeEventListener(IndexEvent.type, listen)
        worker.removeEventListener(ActivityEvent.type, listen)
      }
    }
    worker.addEventListener(IndexEvent.type, listen)
    worker.addEventListener(ActivityEvent.type, listen)
  }

  // A shared worker serves every tab through a port per connection, while a
  // dedicated worker (where SharedWorker is unsupported) talks to its page
  // over its own global scope.
  if ('onconnect' in globalThis) {
    addEventListener('connect', event => {
      if (!(event instanceof MessageEvent)) return
      console.info('Worker connected')
      const port = event.ports[0]
      Comlink.expose(worker, port)
      forward(port)
    })
  } else {
    Comlink.expose(worker, globalThis)
    forward(globalThis)
  }

  for await (const batch of gen) {
    await worker.load(batch.configFingerprint, batch.config, batch.client)
  }
}
