import type {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import * as Comlink from 'comlink'
import type {ComponentType} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from '../App.js'
import {DashboardWorker} from './DashboardWorker.js'
import {loadWorker} from './LoadWorker.js'
import {WorkerDB} from './WorkerDB.js'

export interface ConfigBatch {
  local: boolean
  revision: string
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
    let events: EventTarget
    let worker: DashboardWorker
    try {
      ;[events, worker] = await createSharedWorker()
    } catch (error) {
      console.error(error)
      console.warn('Shared worker not supported, falling back to local worker.')
      const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
      events = worker = new DashboardWorker(source)
    }
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const into = document.createElement('div')
    into.id = 'root'
    element.parentElement!.replaceChild(into, element)
    const root = createRoot(into)
    let lastRevision: string | undefined
    for await (const batch of gen) {
      if (batch.local && batch.revision !== lastRevision) {
        const link = document.querySelector(
          'link[href$="/config.css"]'
        ) as HTMLLinkElement
        const copy = link.cloneNode() as HTMLLinkElement
        const revised = new URL(`?${batch.revision}`, link.href)
        copy.href = revised.href
        copy.onload = () => link.remove()
        link.after(copy)
      }
      const isLocal = worker instanceof DashboardWorker
      if (isLocal) await worker.load(batch.revision, batch.config, batch.client)
      if (batch.revision !== lastRevision) {
        const db = new WorkerDB(batch.config, worker, batch.client, events)
        root.render(<App db={db} {...batch} />)
      }
      lastRevision = batch.revision
    }
  }
}

async function createSharedWorker(): Promise<[EventTarget, DashboardWorker]> {
  const events = new EventTarget()
  const response = await fetch(import.meta.url)
  if (!response.ok) throw new Error('Could not loader worker script')
  const blob = new Blob([await response.text()], {
    type: 'application/javascript'
  })
  const url = URL.createObjectURL(blob)
  const worker = new SharedWorker(url, {
    type: 'module',
    name: 'Alinea dashboard'
  })
  worker.port.addEventListener('message', ({data}) => {
    if (data.type === IndexEvent.type) {
      events.dispatchEvent(new IndexEvent(data.data))
    }
  })
  return [events, Comlink.wrap(worker.port) as any] as const
}

function isWorkerScope() {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    globalThis instanceof WorkerGlobalScope
  )
}
