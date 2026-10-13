import {IndexEvent} from '#/core/db/IndexEvent.js'
import * as Comlink from 'comlink'
import {ActivityEvent} from './ActivityEvent.js'
import type {ConfigGenerator} from './Boot.js'
import {CompactEvent} from './CompactEvent.js'
import {DashboardWorker} from './DashboardWorker.js'

interface Target {
  postMessage(message: unknown): void
}

/** The events of the worker that its pages receive. */
const forwarded = [IndexEvent.type, ActivityEvent.type, CompactEvent.type]

export async function loadWorker(gen: ConfigGenerator) {
  const worker = new DashboardWorker()

  function forward(target: Target) {
    const listen = (event: Event) => {
      try {
        target.postMessage({...event, type: event.type})
      } catch {
        for (const type of forwarded) worker.removeEventListener(type, listen)
      }
    }
    for (const type of forwarded) worker.addEventListener(type, listen)
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
