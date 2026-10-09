import type {Client} from '#/core/Client.js'
import type {Config} from '#/core/Config.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import * as Comlink from 'comlink'
import type {ComponentType} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from '../App.js'
import {ActivityEvent} from './ActivityEvent.js'
import {DashboardWorker} from './DashboardWorker.js'
import {loadWorker} from './LoadWorker.js'
import {WorkerDB} from './WorkerDB.js'

export interface ConfigBatch {
  local: boolean
  revision: string
  /** A browser store derives its entries again only when this changes. */
  configFingerprint: string
  config: Config
  client: Client
  views: Record<string, ComponentType>
  alineaDev?: boolean
}

export type ConfigGenerator = AsyncGenerator<ConfigBatch>

export async function boot(gen: ConfigGenerator) {
  const inWorker = isWorkerScope()
  if (inWorker) {
    loadWorker(gen)
  } else {
    const [events, worker] = connect()
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const into = document.createElement('div')
    into.id = 'root'
    if (element.parentElement === document.head) document.body.append(into)
    else element.parentElement!.replaceChild(into, element)
    const root = createRoot(into)
    let lastRevision: string | undefined
    for await (const batch of gen) {
      if (batch.local && batch.revision !== lastRevision) {
        // Earlier batches replace the link with a revisioned href, so match
        // on the file name rather than the exact attribute value.
        const link = document.querySelector<HTMLLinkElement>(
          'link[rel="stylesheet"][href^="config.css"]'
        )
        if (link) {
          const copy = link.cloneNode() as HTMLLinkElement
          copy.href = `config.css?${batch.revision}`
          copy.onload = () => link.remove()
          link.after(copy)
        }
      }
      const isLocal = worker instanceof DashboardWorker
      if (isLocal)
        await worker.load(batch.configFingerprint, batch.config, batch.client)
      const db = new WorkerDB(batch.config, worker, batch.client, events)
      root.render(<App graph={db} events={events} {...batch} />)
      lastRevision = batch.revision
    }
  }
}

function connect(): [EventTarget, DashboardWorker] {
  const options = {type: 'module', name: 'Alinea dashboard'} as const
  try {
    const worker = new SharedWorker(import.meta.url, options)
    return [listen(worker.port), wrap(worker.port)]
  } catch {
    console.warn('Shared worker not supported, falling back to a worker.')
  }
  try {
    const worker = new Worker(import.meta.url, options)
    return [listen(worker), wrap(worker)]
  } catch {
    console.warn('Worker not supported, running on the main thread.')
    const worker = new DashboardWorker()
    return [worker, worker]
  }
}

function wrap(endpoint: Comlink.Endpoint) {
  return Comlink.wrap<DashboardWorker>(endpoint) as unknown as DashboardWorker
}

function listen(source: EventTarget) {
  const events = new EventTarget()
  source.addEventListener('message', event => {
    const {data} = event as MessageEvent
    if (data.type === IndexEvent.type) {
      events.dispatchEvent(new IndexEvent(data.data))
    } else if (data.type === ActivityEvent.type) {
      events.dispatchEvent(new ActivityEvent(data.activities))
    }
  })
  return events
}

function isWorkerScope() {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    globalThis instanceof WorkerGlobalScope
  )
}
